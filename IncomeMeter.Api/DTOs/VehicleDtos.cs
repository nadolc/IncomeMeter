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
