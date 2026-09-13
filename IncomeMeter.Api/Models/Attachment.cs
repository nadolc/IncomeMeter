using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace IncomeMeter.Api.Models;

/// <summary>
/// An uploaded file (receipt / odometer photo) stored in blob or local storage.
/// </summary>
public class Attachment
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    public string FileName { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long SizeBytes { get; set; }

    /// <summary>SHA-256 hex of the file bytes, used for duplicate detection.</summary>
    public string Sha256 { get; set; } = null!;

    /// <summary>Key/path inside the configured storage provider.</summary>
    public string StorageKey { get; set; } = null!;

    /// <summary>When the photo was taken, derived from EXIF or the filename. Null if unknown.</summary>
    public DateTime? TakenAt { get; set; }

    /// <summary>"exif" | "filename" | null</summary>
    public string? DateSource { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
