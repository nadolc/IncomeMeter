using System.ComponentModel.DataAnnotations;

namespace IncomeMeter.Api.DTOs;

public class CreateVehicleDto
{
    [Required]
    [StringLength(16)]
    public string Registration { get; set; } = null!;
    public string? Make { get; set; }
    public string? Model { get; set; }
    /// <summary>"car" | "van" | "motorcycle"</summary>
    public string VehicleType { get; set; } = "car";
    public string? FuelType { get; set; }
    [Range(0, 1000)]
    public int? Co2GPerKm { get; set; }
    public DateTime? PurchaseDate { get; set; }
    [Range(0, 10_000_000)]
    public decimal? PurchasePrice { get; set; }
    public bool IsNew { get; set; }
    public string FinanceType { get; set; } = "cash";
    /// <summary>"actualCost" | "mileage"</summary>
    public string ClaimMethod { get; set; } = "actualCost";
    public int? ClaimMethodLockedFromTaxYear { get; set; }
    [Range(0, 10_000_000)]
    public decimal? CapitalAllowancePoolBroughtForward { get; set; }
    public int? PoolBroughtForwardTaxYear { get; set; }
    public string? Notes { get; set; }
}

public class UpdateVehicleDto
{
    [StringLength(16)]
    public string? Registration { get; set; }
    public string? Make { get; set; }
    public string? Model { get; set; }
    public string? VehicleType { get; set; }
    public string? FuelType { get; set; }
    [Range(0, 1000)]
    public int? Co2GPerKm { get; set; }
    public DateTime? PurchaseDate { get; set; }
    [Range(0, 10_000_000)]
    public decimal? PurchasePrice { get; set; }
    public bool? IsNew { get; set; }
    public string? FinanceType { get; set; }
    public string? ClaimMethod { get; set; }
    public int? ClaimMethodLockedFromTaxYear { get; set; }
    [Range(0, 10_000_000)]
    public decimal? CapitalAllowancePoolBroughtForward { get; set; }
    public int? PoolBroughtForwardTaxYear { get; set; }
    public bool? IsActive { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Assign a vehicle to existing routes / expenses / odometer readings in bulk.</summary>
public class BackfillVehicleDto
{
    public bool Routes { get; set; } = true;
    public bool Expenses { get; set; } = true;
    public bool OdometerReadings { get; set; } = true;
    /// <summary>Only touch records that have no vehicle yet (default). False = reassign everything in range.</summary>
    public bool OnlyUnassigned { get; set; } = true;
    /// <summary>Optional date range (inclusive). Defaults to the vehicle's purchase date → now.</summary>
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}

public class BackfillVehicleResultDto
{
    public string VehicleId { get; set; } = null!;
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public long RoutesUpdated { get; set; }
    public long ExpensesUpdated { get; set; }
    public long OdometerReadingsUpdated { get; set; }
}
