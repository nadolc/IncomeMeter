using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public interface IAttachmentService
{
    /// <summary>
    /// Store one uploaded file: hashes it, de-duplicates per user, extracts the capture date, and persists it.
    /// </summary>
    Task<AttachmentUploadResultDto> UploadAsync(IFormFile file, string userId, CancellationToken ct = default);

    Task<Attachment?> GetByIdAsync(string id, string userId);
    Task<List<Attachment>> GetByIdsAsync(IEnumerable<string> ids, string userId);
    Task<Stream?> OpenContentAsync(Attachment attachment, CancellationToken ct = default);
    /// <summary>Small preview; generated and stored on first request for attachments uploaded before thumbnails existed. Null for non-images.</summary>
    Task<Stream?> OpenThumbnailAsync(Attachment attachment, CancellationToken ct = default);
    Task<bool> DeleteAsync(string id, string userId, CancellationToken ct = default);
}
