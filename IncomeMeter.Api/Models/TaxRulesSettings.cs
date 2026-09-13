namespace IncomeMeter.Api.Models;

/// <summary>
/// HMRC figures used by the tax-year report. Kept in configuration ("TaxRules" section) because they
/// change with Budgets – the defaults reflect the rules in force for 2024/25 – 2025/26 and MUST be
/// checked against current HMRC guidance before each filing.
/// </summary>
public class TaxRulesSettings
{
    // --- Simplified expenses (flat-rate mileage) ---
    public decimal MileageRateFirstBand { get; set; } = 0.45m;
    public decimal MileageRateSecondBand { get; set; } = 0.25m;
    public int MileageFirstBandMiles { get; set; } = 10_000;
    public decimal MotorcycleMileageRate { get; set; } = 0.24m;

    // --- Capital allowances ---
    /// <summary>Writing-down allowance for the main rate pool (cars with CO2 at or below the threshold, second-hand zero-emission cars).</summary>
    public decimal MainRateWda { get; set; } = 0.18m;
    /// <summary>Writing-down allowance for the special rate pool (cars with CO2 above the threshold).</summary>
    public decimal SpecialRateWda { get; set; } = 0.06m;
    /// <summary>Cars at or below this CO2 g/km figure go in the main rate pool.</summary>
    public int MainRateCo2Threshold { get; set; } = 50;
    /// <summary>First-year allowance for NEW zero-emission cars.</summary>
    public decimal ZeroEmissionCarFya { get; set; } = 1.00m;
    /// <summary>Annual Investment Allowance rate – applies to vans and motorcycles (not cars).</summary>
    public decimal AiaRate { get; set; } = 1.00m;

    // --- Record-keeping sanity checks ---
    /// <summary>Warn when consecutive odometer readings are further apart than this.</summary>
    public int OdometerGapWarningDays { get; set; } = 60;
    /// <summary>Accept an odometer reading this many days outside the tax year as the opening/closing figure.</summary>
    public int OdometerBoundaryToleranceDays { get; set; } = 14;
}
