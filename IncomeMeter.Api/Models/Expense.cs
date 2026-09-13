using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace IncomeMeter.Api.Models;

public static class ExpenseCategories
{
    public const string Fuel = "fuel";
    public const string Insurance = "insurance";
    public const string Servicing = "servicing";
    public const string Repairs = "repairs";
    public const string Mot = "mot";
    public const string RoadTax = "roadTax";
    public const string Breakdown = "breakdown";
    public const string Parking = "parking";
    public const string Tolls = "tolls";
    public const string Cleaning = "cleaning";
    public const string FinanceInterest = "financeInterest";
    public const string VehiclePurchase = "vehiclePurchase";
    public const string Other = "other";

    public static readonly string[] All =
    {
        Fuel, Insurance, Servicing, Repairs, Mot, RoadTax, Breakdown,
        Parking, Tolls, Cleaning, FinanceInterest, VehiclePurchase, Other
    };

    public static bool IsValid(string? category) =>
        !string.IsNullOrWhiteSpace(category) && All.Contains(category);
}

public static class ExpenseStatus
{
    public const string Draft = "draft";
    public const string Confirmed = "confirmed";
}

/// <summary>
/// A vehicle-related business expense backed by one or more receipt attachments.
/// </summary>
public class Expense
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    [BsonRepresentation(BsonType.ObjectId)]
    public string? VehicleId { get; set; }

    /// <summary>One of <see cref="ExpenseCategories"/>.</summary>
    public string Category { get; set; } = ExpenseCategories.Other;

    public DateTime Date { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "GBP";
    public string? Merchant { get; set; }
    public string? Notes { get; set; }

    /// <summary>Fuel-specific details (only for Category == fuel).</summary>
    public FuelDetails? Fuel { get; set; }

    [BsonRepresentation(BsonType.ObjectId)]
    public List<string> AttachmentIds { get; set; } = new();

    /// <summary>True when the cost is 100% business (e.g. parking on a job) and should not be apportioned.</summary>
    public bool IsFullyBusiness { get; set; }

    /// <summary>"draft" | "confirmed"</summary>
    public string Status { get; set; } = ExpenseStatus.Confirmed;

    /// <summary>"exif" | "filename" | "ocr" | "manual"</summary>
    public string DateSource { get; set; } = "manual";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class FuelDetails
{
    public double? Litres { get; set; }
    public double? OdometerMiles { get; set; }
}
