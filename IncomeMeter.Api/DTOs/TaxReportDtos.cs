namespace IncomeMeter.Api.DTOs;

public class TaxYearReportDto
{
    /// <summary>Start year of the UK tax year, e.g. 2025 for 6 Apr 2025 – 5 Apr 2026.</summary>
    public int TaxYear { get; set; }
    public string TaxYearLabel { get; set; } = null!;
    public DateTime PeriodFrom { get; set; }
    public DateTime PeriodTo { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    public TaxReportVehicleDto? Vehicle { get; set; }
    public TaxReportMileageDto Mileage { get; set; } = new();
    public List<TaxReportCategoryDto> Categories { get; set; } = new();
    public TaxReportTotalsDto Totals { get; set; } = new();
    public TaxReportCapitalAllowanceDto CapitalAllowance { get; set; } = new();
    public TaxReportSimplifiedDto SimplifiedExpenses { get; set; } = new();
    public TaxReportComparisonDto Comparison { get; set; } = new();
    public List<TaxReportBoxDto> Sa103Boxes { get; set; } = new();
    public List<TaxReportWarningDto> Warnings { get; set; } = new();

    public string Disclaimer { get; set; } =
        "Figures are calculated from your own records using configurable HMRC rates. They are a working aid, not tax advice: " +
        "check the rates, the SA103 box numbers and your eligibility (including the flat-rate method lock) against current HMRC guidance or with an accountant before filing.";
}

public class TaxReportVehicleDto
{
    public string Id { get; set; } = null!;
    public string Registration { get; set; } = null!;
    public string? Description { get; set; }
    public string VehicleType { get; set; } = null!;
    public string ClaimMethod { get; set; } = null!;
    public int? ClaimMethodLockedFromTaxYear { get; set; }
    public int? Co2GPerKm { get; set; }
    public bool IsNew { get; set; }
    public DateTime? PurchaseDate { get; set; }
    public decimal? PurchasePrice { get; set; }
}

public class TaxReportMileageDto
{
    /// <summary>Sum of (EndMile − StartMile) over completed routes in the period (falls back to route distance).</summary>
    public double BusinessMiles { get; set; }
    public int RoutesCounted { get; set; }
    public int RoutesWithoutMileage { get; set; }

    public TaxReportOdometerPointDto? OdometerStart { get; set; }
    public TaxReportOdometerPointDto? OdometerEnd { get; set; }
    public int OdometerReadingsInPeriod { get; set; }
    /// <summary>Total miles driven (business + private) between the opening and closing odometer readings.</summary>
    public double? TotalMiles { get; set; }

    /// <summary>Business ÷ total, as a percentage 0–100. Null when total miles are unknown and no override was supplied.</summary>
    public double? BusinessUsePercent { get; set; }
    /// <summary>"odometer" | "override" | "unavailable"</summary>
    public string BusinessUseSource { get; set; } = "unavailable";
}

public class TaxReportOdometerPointDto
{
    public DateTime Date { get; set; }
    public double Miles { get; set; }
    /// <summary>"reading" (OdometerReading) | "fuelReceipt" (Expense.Fuel.OdometerMiles)</summary>
    public string Source { get; set; } = "reading";
}

public class TaxReportCategoryDto
{
    public string Category { get; set; } = null!;
    public int Count { get; set; }
    public decimal Total { get; set; }
    /// <summary>Amount flagged as 100% business and therefore not apportioned.</summary>
    public decimal FullyBusinessTotal { get; set; }
    public decimal Allowable { get; set; }
    public decimal Disallowable { get; set; }
    public int ReceiptsMissing { get; set; }
    /// <summary>Excluded from running costs because it is handled via capital allowances.</summary>
    public bool ExcludedFromRunningCosts { get; set; }
}

public class TaxReportTotalsDto
{
    public decimal TotalExpenses { get; set; }
    public decimal Allowable { get; set; }
    public decimal Disallowable { get; set; }
    public int ReceiptsMissing { get; set; }
}

public class TaxReportCapitalAllowanceDto
{
    public bool Applicable { get; set; }
    public string? Reason { get; set; }
    /// <summary>"aia" | "fyaZeroEmission" | "mainRateWda" | "specialRateWda"</summary>
    public string? AllowanceType { get; set; }
    public string? AllowanceLabel { get; set; }
    public decimal Rate { get; set; }
    /// <summary>Cost of the vehicle when it was bought in this tax year.</summary>
    public decimal QualifyingExpenditure { get; set; }
    /// <summary>Written-down value brought forward when the vehicle was bought in an earlier year.</summary>
    public decimal PoolBroughtForward { get; set; }
    public decimal GrossAllowance { get; set; }
    public double? BusinessUsePercent { get; set; }
    public decimal Allowance { get; set; }
    public decimal PoolCarriedForward { get; set; }
    public string? Sa103Box { get; set; }
}

public class TaxReportSimplifiedDto
{
    public double BusinessMiles { get; set; }
    public double FirstBandMiles { get; set; }
    public decimal FirstBandRate { get; set; }
    public double SecondBandMiles { get; set; }
    public decimal SecondBandRate { get; set; }
    public decimal Amount { get; set; }
}

public class TaxReportComparisonDto
{
    /// <summary>Allowable running costs + capital allowance.</summary>
    public decimal ActualCostTotal { get; set; }
    public decimal SimplifiedTotal { get; set; }
    public decimal Difference { get; set; }
    /// <summary>"actualCost" | "mileage" | "equal"</summary>
    public string BetterMethod { get; set; } = "equal";
    /// <summary>True when the vehicle is locked to a method and the better one is not available.</summary>
    public bool LockedToOtherMethod { get; set; }
}

public class TaxReportBoxDto
{
    public string Form { get; set; } = "SA103F";
    public string Box { get; set; } = null!;
    public string Label { get; set; } = null!;
    public decimal Amount { get; set; }
    public string? Note { get; set; }
}

public class TaxReportWarningDto
{
    /// <summary>"info" | "warning" | "error"</summary>
    public string Severity { get; set; } = "warning";
    public string Code { get; set; } = null!;
    public string Message { get; set; } = null!;
}
