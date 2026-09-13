using System.Security.Cryptography;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace IncomeMeter.Api.Services;

public class AttachmentService : IAttachmentService
{
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp", "image/gif", "image/bmp", "image/tiff",
        "application/pdf"
    };

    private readonly IMongoCollection<Attachment> _attachments;
    private readonly IFileStorageService _storage;
    private readonly IReceiptOcrService _ocr;
    private readonly StorageSettings _settings;
    private readonly ILogger<AttachmentService> _logger;

    public AttachmentService(
        MongoDbContext context,
        IFileStorageService storage,
        IReceiptOcrService ocr,
        IOptions<StorageSettings> settings,
        ILogger<AttachmentService> logger)
    {
        _attachments = context.Attachments;
        _storage = storage;
        _ocr = ocr;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<AttachmentUploadResultDto> UploadAsync(IFormFile file, string userId, CancellationToken ct = default)
    {
        var result = new AttachmentUploadResultDto
        {
            FileName = file.FileName,
            ContentType = file.ContentType,
            SizeBytes = file.Length
        };

        if (file.Length == 0)
        {
            result.Error = "File is empty";
            return result;
        }

        var maxBytes = (long)_settings.MaxFileSizeMb * 1024 * 1024;
        if (file.Length > maxBytes)
        {
            result.Error = $"File exceeds the {_settings.MaxFileSizeMb} MB limit";
            return result;
        }

        var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? GuessContentType(file.FileName) : file.ContentType;
        if (!AllowedContentTypes.Contains(contentType))
        {
            result.Error = $"Unsupported file type: {contentType}";
            return result;
        }
        result.ContentType = contentType;

        // Buffer in memory so we can hash, read EXIF, and upload from the same bytes.
        await using var buffer = new MemoryStream((int)Math.Min(file.Length, int.MaxValue));
        await file.CopyToAsync(buffer, ct);
        buffer.Position = 0;

        var sha256 = Convert.ToHexString(await SHA256.HashDataAsync(buffer, ct)).ToLowerInvariant();
        buffer.Position = 0;
        result.Sha256 = sha256;

        // Duplicate check: same user, same bytes.
        var existing = await _attachments
            .Find(a => a.UserId == userId && a.Sha256 == sha256)
            .FirstOrDefaultAsync(ct);
        if (existing != null)
        {
            result.IsDuplicate = true;
            result.AttachmentId = existing.Id;
            result.TakenAt = existing.TakenAt;
            result.DateSource = existing.DateSource;
            result.Ocr = ToOcrDto(existing.Ocr);
            return result;
        }

        var (takenAt, dateSource) = PhotoDateExtractor.Extract(buffer, file.FileName);
        buffer.Position = 0;

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension) || extension.Length > 10) extension = string.Empty;
        var storageKey = $"{userId}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{extension.ToLowerInvariant()}";

        await _storage.SaveAsync(storageKey, buffer, contentType, ct);
        buffer.Position = 0;

        // Optional OCR pre-fill (merchant / date / total). Never blocks the upload.
        AttachmentOcr? ocr = null;
        if (_ocr.IsEnabled)
        {
            ocr = await _ocr.AnalyseAsync(buffer, contentType, ct);
            buffer.Position = 0;
        }

        var attachment = new Attachment
        {
            UserId = userId,
            FileName = Path.GetFileName(file.FileName),
            ContentType = contentType,
            SizeBytes = file.Length,
            Sha256 = sha256,
            StorageKey = storageKey,
            TakenAt = takenAt,
            DateSource = dateSource,
            UploadedAt = DateTime.UtcNow,
            Ocr = ocr
        };

        await _attachments.InsertOneAsync(attachment, cancellationToken: ct);

        _logger.LogInformation("Attachment {AttachmentId} uploaded for user {UserId} ({Size} bytes, date source: {DateSource})",
            attachment.Id, userId[..Math.Min(8, userId.Length)] + "***", file.Length, dateSource ?? "none");

        result.AttachmentId = attachment.Id;
        result.TakenAt = takenAt;
        result.DateSource = dateSource;
        result.Ocr = ToOcrDto(ocr);
        return result;
    }

    private static AttachmentOcrDto? ToOcrDto(AttachmentOcr? ocr) => ocr == null ? null : new AttachmentOcrDto
    {
        Merchant = ocr.Merchant,
        Date = ocr.Date,
        Total = ocr.Total,
        Currency = ocr.Currency,
        Confidence = ocr.Confidence
    };

    public async Task<Attachment?> GetByIdAsync(string id, string userId) =>
        await _attachments.Find(a => a.Id == id && a.UserId == userId).FirstOrDefaultAsync();

    public async Task<List<Attachment>> GetByIdsAsync(IEnumerable<string> ids, string userId)
    {
        var idList = ids.Distinct().ToList();
        if (idList.Count == 0) return new List<Attachment>();
        var filter = Builders<Attachment>.Filter.And(
            Builders<Attachment>.Filter.Eq(a => a.UserId, userId),
            Builders<Attachment>.Filter.In(a => a.Id, idList));
        return await _attachments.Find(filter).ToListAsync();
    }

    public Task<Stream?> OpenContentAsync(Attachment attachment, CancellationToken ct = default) =>
        _storage.OpenReadAsync(attachment.StorageKey, ct);

    public async Task<bool> DeleteAsync(string id, string userId, CancellationToken ct = default)
    {
        var attachment = await GetByIdAsync(id, userId);
        if (attachment == null) return false;

        await _storage.DeleteAsync(attachment.StorageKey, ct);
        await _attachments.DeleteOneAsync(a => a.Id == id && a.UserId == userId, ct);
        return true;
    }

    private static string GuessContentType(string fileName) =>
        Path.GetExtension(fileName).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".heic" => "image/heic",
            ".heif" => "image/heif",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            ".bmp" => "image/bmp",
            ".tif" or ".tiff" => "image/tiff",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream"
        };
}
