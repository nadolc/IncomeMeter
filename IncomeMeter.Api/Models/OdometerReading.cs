using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace IncomeMeter.Api.Models;

/// <summary>
/// A dashboard odometer reading, used to derive total (business + private) mileage.
/// </summary>
public class OdometerReading
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    [BsonRepresentation(BsonType.ObjectId)]
    public string? VehicleId { get; set; }

    public DateTime Date { get; set; }
    public double Miles { get; set; }

    /// <summary>"fuelStop" | "taxYearStart" | "taxYearEnd" | "manual"</summary>
    public string Source { get; set; } = "manual";

    [BsonRepresentation(BsonType.ObjectId)]
    public string? PhotoAttachmentId { get; set; }

    /// <summary>"exif" | "filename" | "ocr" | "manual"</summary>
    public string DateSource { get; set; } = "manual";

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
