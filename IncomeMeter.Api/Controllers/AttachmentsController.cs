using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class AttachmentsController : ControllerBase
{
    private readonly IAttachmentService _attachmentService;
    private readonly StorageSettings _storageSettings;

    public AttachmentsController(IAttachmentService attachmentService, IOptions<StorageSettings> storageSettings)
    {
        _attachmentService = attachmentService;
        _storageSettings = storageSettings.Value;
    }

    /// <summary>
    /// Upload many receipt / odometer photos at once. Returns one result per file (in the same order),
    /// including the capture date read from EXIF or the filename so the client can pre-fill the review screen.
    /// </summary>
    [HttpPost("batch")]
    [RequestSizeLimit(512L * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 512L * 1024 * 1024, ValueCountLimit = 1024)]
    public async Task<IActionResult> UploadBatch([FromForm] List<IFormFile> files, CancellationToken ct)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        if (files == null || files.Count == 0)
            return BadRequest(new { error = "No files were uploaded" });

        if (files.Count > _storageSettings.MaxFilesPerBatch)
            return BadRequest(new { error = $"Too many files – maximum {_storageSettings.MaxFilesPerBatch} per batch" });

        var results = new List<AttachmentUploadResultDto>(files.Count);
        foreach (var file in files)
        {
            try
            {
                results.Add(await _attachmentService.UploadAsync(file, userId, ct));
            }
            catch (Exception ex)
            {
                results.Add(new AttachmentUploadResultDto
                {
                    FileName = file.FileName,
                    ContentType = file.ContentType,
                    SizeBytes = file.Length,
                    Error = ex.Message
                });
            }
        }

        return Ok(results);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var attachment = await _attachmentService.GetByIdAsync(id, userId);
        if (attachment == null) return NotFound();

        return Ok(ToDto(attachment));
    }

    /// <summary>Stream the original file. Private – requires the owner's bearer token.</summary>
    [HttpGet("{id}/content")]
    public async Task<IActionResult> GetContent(string id, CancellationToken ct)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var attachment = await _attachmentService.GetByIdAsync(id, userId);
        if (attachment == null) return NotFound();

        var stream = await _attachmentService.OpenContentAsync(attachment, ct);
        if (stream == null) return NotFound(new { error = "File content is missing from storage" });

        Response.Headers.CacheControl = "private, max-age=86400";
        return File(stream, attachment.ContentType, attachment.FileName, enableRangeProcessing: true);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var deleted = await _attachmentService.DeleteAsync(id, userId, ct);
        return deleted ? NoContent() : NotFound();
    }

    private static AttachmentDto ToDto(Attachment a) => new()
    {
        Id = a.Id!,
        FileName = a.FileName,
        ContentType = a.ContentType,
        SizeBytes = a.SizeBytes,
        TakenAt = a.TakenAt,
        DateSource = a.DateSource,
        UploadedAt = a.UploadedAt
    };
}
