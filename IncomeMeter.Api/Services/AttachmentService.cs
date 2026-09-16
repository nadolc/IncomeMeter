using System.Security.Cryptography;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
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

        // Small preview for lists so the browser never has to pull the multi-megabyte original just to show a row.
        var thumbnailKey = await TryCreateThumbnailAsync(buffer, contentType, storageKey, ct);
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
            ThumbnailStorageKey = thumbnailKey,
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
        Kind = ocr.Kind,
        Merchant = ocr.Merchant,
        Date = ocr.Date,
        Total = ocr.Total,
        Currency = ocr.Currency,
        Litres = ocr.Litres,
        PricePerLitre = ocr.PricePerLitre,
        FuelType = ocr.FuelType,
        OdometerMiles = ocr.OdometerMiles,
        TripMiles = ocr.TripMiles,
        Mpg = ocr.Mpg,
        Confidence = ocr.Confidence,
        RawText = ocr.RawText
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

    public async Task<Stream?> OpenThumbnailAsync(Attachment attachment, CancellationToken ct = default)
    {
        if (attachment.ThumbnailStorageKey != null)
        {
            var existing = await _storage.OpenReadAsync(attachment.ThumbnailStorageKey, ct);
            if (existing != null) return existing;
        }
        if (!attachment.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)) return null;

        // Uploaded before thumbnails existed (or the file went missing): build it now and remember it.
        await using var original = await _storage.OpenReadAsync(attachment.StorageKey, ct);
        if (original == null) return null;
        await using var buffer = new MemoryStream();
        await original.CopyToAsync(buffer, ct);
        buffer.Position = 0;
        var key = await TryCreateThumbnailAsync(buffer, attachment.ContentType, attachment.StorageKey, ct);
        if (key == null) return null;

        await _attachments.UpdateOneAsync(a => a.Id == attachment.Id,
            Builders<Attachment>.Update.Set(a => a.ThumbnailStorageKey, key), cancellationToken: ct);
        return await _storage.OpenReadAsync(key, ct);
    }

    /// <summary>Resize to a 320px JPEG (honouring EXIF orientation). Returns the storage key, or null if the file is not a decodable image.</summary>
    private async Task<string?> TryCreateThumbnailAsync(Stream source, string contentType, string storageKey, CancellationToken ct)
    {
        if (!contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)) return null;
        try
        {
            source.Position = 0;
            using var image = await Image.LoadAsync(source, ct);
            image.Mutate(x => x.AutoOrient().Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(320, 320) }));
            await using var thumb = new MemoryStream();
            await image.SaveAsync(thumb, new JpegEncoder { Quality = 72 }, ct);
            thumb.Position = 0;

            var key = Path.ChangeExtension(storageKey, null) + "_thumb.jpg";
            await _storage.SaveAsync(key, thumb, "image/jpeg", ct);
            return key;
        }
        catch (Exception ex)
        {
            // HEIC and other formats ImageSharp cannot decode simply get no thumbnail.
            _logger.LogDebug(ex, "No thumbnail for {Key}", storageKey);
            return null;
        }
    }

    public async Task<bool> DeleteAsync(string id, string userId, CancellationToken ct = default)
    {
        var attachment = await GetByIdAsync(id, userId);
        if (attachment == null) return false;

        await _storage.DeleteAsync(attachment.StorageKey, ct);
        if (attachment.ThumbnailStorageKey != null) await _storage.DeleteAsync(attachment.ThumbnailStorageKey, ct);
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
