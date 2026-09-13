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

    /// <summary>
    /// When the photo was taken, derived from EXIF or the filename. Null if unknown.
    /// EXIF has no timezone, so this is a wall-clock value stored and returned without UTC conversion.
    /// </summary>
    [BsonDateTimeOptions(Kind = DateTimeKind.Unspecified)]
    public DateTime? TakenAt { get; set; }

    /// <summary>"exif" | "filename" | null</summary>
    public string? DateSource { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Fields read from the receipt by OCR, if enabled. Best-effort only.</summary>
    public AttachmentOcr? Ocr { get; set; }
}

public class AttachmentOcr
{
    /// <summary>"receipt" | "dashboard" – what the photo appears to be.</summary>
    public string? Kind { get; set; }

    public string? Merchant { get; set; }
    /// <summary>Transaction date printed on the receipt (local wall-clock, no zone).</summary>
    [BsonDateTimeOptions(Kind = DateTimeKind.Unspecified)]
    public DateTime? Date { get; set; }
    public decimal? Total { get; set; }
    public string? Currency { get; set; }

    // Fuel receipt details
    public double? Litres { get; set; }
    public decimal? PricePerLitre { get; set; }
    /// <summary>"unleaded" | "premiumUnleaded" | "diesel" | "lpg"</summary>
    public string? FuelType { get; set; }

    // Dashboard / trip-computer screen
    public double? OdometerMiles { get; set; }
    /// <summary>Trip distance shown on the screen (e.g. miles since last refuel).</summary>
    public double? TripMiles { get; set; }
    public double? Mpg { get; set; }

    public float Confidence { get; set; }

    /// <summary>Plain text returned by the OCR engine (truncated). Kept so photos can be re-parsed and problems diagnosed.</summary>
    public string? RawText { get; set; }
}
