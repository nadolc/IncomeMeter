using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace IncomeMeter.Api.Models;

public static class VehicleTypes
{
    public const string Car = "car";
    public const string Van = "van";
    public const string Motorcycle = "motorcycle";
    public static readonly string[] All = { Car, Van, Motorcycle };
}

public static class ClaimMethods
{
    /// <summary>Actual running costs apportioned by business use + capital allowances.</summary>
    public const string ActualCost = "actualCost";
    /// <summary>HMRC simplified expenses flat rate per business mile.</summary>
    public const string Mileage = "mileage";
    public static readonly string[] All = { ActualCost, Mileage };
}

/// <summary>
/// A vehicle used for business. Holds the facts needed for capital allowances and the
/// HMRC "method lock" (once the flat-rate mileage method is used for a vehicle it must be kept).
/// </summary>
public class Vehicle
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    public string Registration { get; set; } = null!;
    public string? Make { get; set; }
    public string? Model { get; set; }

    /// <summary>"car" | "van" | "motorcycle"</summary>
    public string VehicleType { get; set; } = VehicleTypes.Car;

    /// <summary>"petrol" | "diesel" | "hybrid" | "electric" | "other"</summary>
    public string? FuelType { get; set; }

    /// <summary>Official CO2 figure in g/km – decides the capital allowance rate for cars.</summary>
    public int? Co2GPerKm { get; set; }

    public DateTime? PurchaseDate { get; set; }
    /// <summary>Date the vehicle was sold / stopped being used. Routes and expenses after this go to the next vehicle.</summary>
    public DateTime? DisposalDate { get; set; }
    public decimal? PurchasePrice { get; set; }

    /// <summary>True if bought new (unused). Matters for the 100% zero-emission first-year allowance.</summary>
    public bool IsNew { get; set; }

    /// <summary>"cash" | "hp" | "lease" | "none"</summary>
    public string FinanceType { get; set; } = "cash";

    /// <summary>"actualCost" | "mileage"</summary>
    public string ClaimMethod { get; set; } = ClaimMethods.ActualCost;

    /// <summary>Tax year (start year, e.g. 2024 for 2024/25) in which the claim method was first used. Null = not yet filed.</summary>
    public int? ClaimMethodLockedFromTaxYear { get; set; }

    /// <summary>Written-down value of the vehicle's capital allowance pool brought forward into <see cref="PoolBroughtForwardTaxYear"/>.</summary>
    public decimal? CapitalAllowancePoolBroughtForward { get; set; }
    public int? PoolBroughtForwardTaxYear { get; set; }

    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
