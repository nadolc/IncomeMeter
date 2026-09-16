using System.Globalization;
using System.IO.Compression;
using System.Text;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using Microsoft.Extensions.Options;

namespace IncomeMeter.Api.Services;

public interface ITaxYearReportService
{
    /// <summary>Start year of the UK tax year (6 Apr – 5 Apr) containing <paramref name="date"/>.</summary>
    int TaxYearFor(DateTime date);
    (DateTime from, DateTime to) TaxYearRange(int taxYear);

    /// <param name="strictVehicle">When true, only records explicitly tagged with the vehicle count (unassigned ones are excluded) – used for the combined view so nothing is counted twice.</param>
    Task<TaxYearReportDto> BuildReportAsync(string userId, int taxYear, string? vehicleId = null, double? businessUsePercentOverride = null, bool strictVehicle = false);
    /// <summary>Every vehicle in use during the tax year (including sold / inactive ones), reported separately and summed.</summary>
    Task<TaxYearCombinedReportDto> BuildCombinedReportAsync(string userId, int taxYear, IReadOnlyDictionary<string, double>? businessUseOverrides = null);
    string ToCsv(TaxYearReportDto report);
    Task<byte[]> BuildReceiptsZipAsync(string userId, int taxYear, string? vehicleId = null, CancellationToken ct = default);
}

/// <summary>
/// Turns routes (business miles), odometer readings (total miles), expenses and the vehicle record
/// into the figures needed for the Self Assessment "actual cost" method, plus the simplified-expenses
/// equivalent for comparison.
/// </summary>
public class TaxYearReportService : ITaxYearReportService
{
    private readonly IRouteService _routes;
    private readonly IExpenseService _expenses;
    private readonly IVehicleService _vehicles;
    private readonly IAttachmentService _attachments;
    private readonly TaxRulesSettings _rules;

    public TaxYearReportService(
        IRouteService routes,
        IExpenseService expenses,
        IVehicleService vehicles,
        IAttachmentService attachments,
        IOptions<TaxRulesSettings> rules)
    {
        _routes = routes;
        _expenses = expenses;
        _vehicles = vehicles;
        _attachments = attachments;
        _rules = rules.Value;
    }

    // ---------- Tax year helpers ----------

    public int TaxYearFor(DateTime date)
    {
        var startThisYear = new DateTime(date.Year, 4, 6, 0, 0, 0, DateTimeKind.Utc);
        return date >= startThisYear ? date.Year : date.Year - 1;
    }

    public (DateTime from, DateTime to) TaxYearRange(int taxYear) =>
        (new DateTime(taxYear, 4, 6, 0, 0, 0, DateTimeKind.Utc),
         new DateTime(taxYear + 1, 4, 5, 23, 59, 59, 999, DateTimeKind.Utc));

    private static string Label(int taxYear) => $"{taxYear}/{(taxYear + 1) % 100:00}";

    // ---------- Report ----------

    public async Task<TaxYearReportDto> BuildReportAsync(string userId, int taxYear, string? vehicleId = null, double? businessUsePercentOverride = null, bool strictVehicle = false)
    {
        var (from, to) = TaxYearRange(taxYear);
        var report = new TaxYearReportDto
        {
            TaxYear = taxYear,
            TaxYearLabel = Label(taxYear),
            PeriodFrom = from,
            PeriodTo = to
        };
        var warnings = report.Warnings;

        // --- Vehicle ---
        Vehicle? vehicle = null;
        if (!string.IsNullOrWhiteSpace(vehicleId))
        {
            vehicle = await _vehicles.GetVehicleByIdAsync(vehicleId, userId);
            if (vehicle == null) throw new ArgumentException("Vehicle not found");
        }
        else
        {
            var active = await _vehicles.GetVehiclesAsync(userId);
            vehicle = active.FirstOrDefault();
            if (active.Count > 1)
                warnings.Add(Warn("info", "MULTIPLE_VEHICLES", $"You have {active.Count} active vehicles; this report uses {vehicle!.Registration}. Pass vehicleId to choose another."));
        }

        if (vehicle != null)
        {
            report.Vehicle = new TaxReportVehicleDto
            {
                Id = vehicle.Id!,
                Registration = vehicle.Registration,
                DisposalDate = vehicle.DisposalDate,
                DisposalProceeds = vehicle.DisposalProceeds,
                Description = string.Join(" ", new[] { vehicle.Make, vehicle.Model }.Where(s => !string.IsNullOrWhiteSpace(s))),
                VehicleType = vehicle.VehicleType,
                ClaimMethod = vehicle.ClaimMethod,
                ClaimMethodLockedFromTaxYear = vehicle.ClaimMethodLockedFromTaxYear,
                Co2GPerKm = vehicle.Co2GPerKm,
                IsNew = vehicle.IsNew,
                PurchaseDate = vehicle.PurchaseDate,
                PurchasePrice = vehicle.PurchasePrice
            };

            if (vehicle.ClaimMethod == ClaimMethods.Mileage)
                warnings.Add(Warn("info", "FLAT_RATE_VEHICLE",
                    $"{vehicle.Registration} is claimed with the flat-rate mileage method" +
                    (vehicle.ClaimMethodLockedFromTaxYear.HasValue ? $" (since {Label(vehicle.ClaimMethodLockedFromTaxYear.Value)}; HMRC does not allow switching this vehicle to actual costs)" : "") +
                    ". Fuel, insurance, servicing and the vehicle cost are covered by the rate; only parking and tolls can be claimed on top."));
        }
        else
        {
            warnings.Add(Warn("warning", "NO_VEHICLE", "No vehicle is set up. Add your vehicle (CO2, purchase price/date) to calculate capital allowances."));
        }

        // --- Business miles from routes ---
        var routes = await _routes.GetRoutesByDateRangeAsync(userId, from, to);
        if (vehicle != null)
            routes = routes.Where(r => r.VehicleId == vehicle.Id || (!strictVehicle && r.VehicleId == null)).ToList();
        var completed = routes.Where(r => r.Status == "completed").ToList();
        double businessMiles = 0;
        int withoutMileage = 0;
        foreach (var r in completed)
        {
            if (r.StartMile.HasValue && r.EndMile.HasValue && r.EndMile > r.StartMile)
                businessMiles += r.EndMile.Value - r.StartMile.Value;
            else if (r.Distance > 0)
                businessMiles += r.Distance;
            else
                withoutMileage++;
        }
        report.Mileage.BusinessMiles = Math.Round(businessMiles, 1);
        report.Mileage.RoutesCounted = completed.Count;
        report.Mileage.RoutesWithoutMileage = withoutMileage;
        if (withoutMileage > 0)
            warnings.Add(Warn("warning", "ROUTES_WITHOUT_MILEAGE", $"{withoutMileage} completed route(s) have no start/end mileage and were not counted."));
        if (completed.Count == 0)
            warnings.Add(Warn("warning", "NO_ROUTES", "No completed routes in this tax year – business miles are zero."));

        // --- Total miles from odometer readings (+ odometer noted on fuel receipts) ---
        var tolerance = TimeSpan.FromDays(_rules.OdometerBoundaryToleranceDays);
        var readings = await _expenses.GetOdometerReadingsAsync(userId, from - tolerance, to + tolerance);
        var expenses = await _expenses.GetExpensesAsync(userId, from, to);
        if (vehicle != null)
        {
            readings = readings.Where(r => r.VehicleId == vehicle.Id || (!strictVehicle && r.VehicleId == null)).ToList();
            expenses = expenses.Where(e => e.VehicleId == vehicle.Id || (!strictVehicle && e.VehicleId == null)).ToList();
        }

        var points = readings
            .Select(r => new TaxReportOdometerPointDto { Date = r.Date, Miles = r.Miles, Source = "reading" })
            .Concat(expenses
                .Where(e => e.Fuel?.OdometerMiles is > 0)
                .Select(e => new TaxReportOdometerPointDto { Date = e.Date, Miles = e.Fuel!.OdometerMiles!.Value, Source = "fuelReceipt" }))
            .OrderBy(p => p.Date)
            .ToList();

        report.Mileage.OdometerReadingsInPeriod = points.Count(p => p.Date >= from && p.Date <= to);

        // Opening reading: latest point at/before the start (within tolerance), else the first inside the year.
        var opening = points.LastOrDefault(p => p.Date <= from) ?? points.FirstOrDefault(p => p.Date >= from);
        // Closing reading: earliest point at/after the end (within tolerance), else the last inside the year.
        var closing = points.FirstOrDefault(p => p.Date >= to) ?? points.LastOrDefault(p => p.Date <= to);

        if (opening != null && closing != null && closing.Date > opening.Date && closing.Miles > opening.Miles)
        {
            report.Mileage.OdometerStart = opening;
            report.Mileage.OdometerEnd = closing;
            report.Mileage.TotalMiles = Math.Round(closing.Miles - opening.Miles, 1);

            if (opening.Date > from.AddDays(7))
                warnings.Add(Warn("warning", "NO_OPENING_READING", $"No odometer reading near 6 April {taxYear}; the earliest reading ({opening.Date:d MMM yyyy}) is used as the opening figure. Miles before it are not counted."));
            if (closing.Date < to.AddDays(-7))
                warnings.Add(Warn("warning", "NO_CLOSING_READING", $"No odometer reading near 5 April {taxYear + 1}; the latest reading ({closing.Date:d MMM yyyy}) is used as the closing figure. Miles after it are not counted."));

            // Gaps between consecutive readings.
            var inRange = points.Where(p => p.Date >= opening.Date && p.Date <= closing.Date).ToList();
            for (var i = 1; i < inRange.Count; i++)
            {
                var gap = inRange[i].Date - inRange[i - 1].Date;
                if (gap.TotalDays > _rules.OdometerGapWarningDays)
                {
                    warnings.Add(Warn("info", "ODOMETER_GAP", $"{Math.Round(gap.TotalDays)} days between odometer readings on {inRange[i - 1].Date:d MMM} and {inRange[i].Date:d MMM}."));
                    break;
                }
                if (inRange[i].Miles < inRange[i - 1].Miles)
                    warnings.Add(Warn("error", "ODOMETER_DECREASING", $"Odometer reading on {inRange[i].Date:d MMM yyyy} ({inRange[i].Miles:N0}) is lower than the previous one ({inRange[i - 1].Miles:N0}). Check for a typo."));
            }
        }
        else
        {
            warnings.Add(Warn("warning", "NO_TOTAL_MILES", "At least two odometer readings (ideally on 6 April and 5 April) are needed to work out total miles and the business-use percentage."));
        }

        // --- Business-use percentage ---
        if (businessUsePercentOverride.HasValue)
        {
            report.Mileage.BusinessUsePercent = Math.Clamp(Math.Round(businessUsePercentOverride.Value, 2), 0, 100);
            report.Mileage.BusinessUseSource = "override";
        }
        else if (report.Mileage.TotalMiles is > 0)
        {
            var pct = businessMiles / report.Mileage.TotalMiles.Value * 100.0;
            if (pct > 100)
            {
                warnings.Add(Warn("error", "BUSINESS_EXCEEDS_TOTAL", $"Business miles ({businessMiles:N0}) exceed total odometer miles ({report.Mileage.TotalMiles:N0}). One of the two records is wrong; capped at 100%."));
                pct = 100;
            }
            report.Mileage.BusinessUsePercent = Math.Round(pct, 2);
            report.Mileage.BusinessUseSource = "odometer";
        }
        var businessFraction = report.Mileage.BusinessUsePercent.HasValue ? (decimal)(report.Mileage.BusinessUsePercent.Value / 100.0) : (decimal?)null;

        // --- Expense categories ---
        var attachmentIds = expenses.SelectMany(e => e.AttachmentIds).Distinct().ToList();
        var owned = (await _attachments.GetByIdsAsync(attachmentIds, userId)).Select(a => a.Id!).ToHashSet();

        var flatRate = vehicle?.ClaimMethod == ClaimMethods.Mileage;
        report.Totals.FlatRateVehicle = flatRate;

        foreach (var group in expenses.GroupBy(e => e.Category).OrderBy(g => Array.IndexOf(ExpenseCategories.All, g.Key)))
        {
            var cat = new TaxReportCategoryDto
            {
                Category = group.Key,
                Count = group.Count(),
                Total = group.Sum(e => e.Amount),
                FullyBusinessTotal = group.Where(e => e.IsFullyBusiness).Sum(e => e.Amount),
                ReceiptsMissing = group.Count(e => !e.AttachmentIds.Any(owned.Contains)),
                ExcludedFromRunningCosts = group.Key == ExpenseCategories.VehiclePurchase,
                // Flat rate covers purchase, fuel, insurance, servicing, repairs, MOT, tax, breakdown … – only parking and tolls are extra.
                CoveredByFlatRate = flatRate && group.Key is not (ExpenseCategories.Parking or ExpenseCategories.Tolls)
            };

            if (cat.ExcludedFromRunningCosts || cat.CoveredByFlatRate)
            {
                // Capital expenditure (capital allowances) or already inside the flat rate – nothing to claim here.
                cat.Allowable = 0;
                cat.Disallowable = cat.CoveredByFlatRate ? cat.Total : 0;
            }
            else if (businessFraction.HasValue)
            {
                var apportionable = cat.Total - cat.FullyBusinessTotal;
                cat.Allowable = Round2(cat.FullyBusinessTotal + apportionable * businessFraction.Value);
                cat.Disallowable = Round2(cat.Total - cat.Allowable);
            }
            else
            {
                // Unknown business % – only the 100%-business items can be counted with confidence.
                cat.Allowable = cat.FullyBusinessTotal;
                cat.Disallowable = Round2(cat.Total - cat.FullyBusinessTotal);
            }

            report.Categories.Add(cat);
        }

        report.Totals.TotalExpenses = report.Categories.Where(c => !c.ExcludedFromRunningCosts).Sum(c => c.Total);
        report.Totals.Allowable = report.Categories.Sum(c => c.Allowable);
        report.Totals.Disallowable = report.Categories.Where(c => !c.ExcludedFromRunningCosts).Sum(c => c.Disallowable);
        if (flatRate && report.Categories.Any(c => c.CoveredByFlatRate && c.Total > 0))
            warnings.Add(Warn("info", "COSTS_COVERED_BY_FLAT_RATE",
                $"£{report.Categories.Where(c => c.CoveredByFlatRate).Sum(c => c.Total):N2} of recorded costs are covered by the flat rate and are not claimable separately (kept for your records)."));
        report.Totals.ReceiptsMissing = report.Categories.Sum(c => c.ReceiptsMissing);

        if (!businessFraction.HasValue && report.Totals.TotalExpenses > 0)
            warnings.Add(Warn("warning", "NO_BUSINESS_PERCENT", "Business-use % is unknown, so only items marked 100% business are counted as allowable. Add odometer readings or supply a percentage override."));
        if (report.Totals.ReceiptsMissing > 0)
            warnings.Add(Warn("warning", "RECEIPTS_MISSING", $"{report.Totals.ReceiptsMissing} expense(s) have no receipt attached. HMRC can ask for evidence for 5 years after the filing deadline."));
        if (expenses.Count == 0)
            warnings.Add(Warn("info", "NO_EXPENSES", "No expenses recorded in this tax year."));

        // --- Capital allowance ---
        report.CapitalAllowance = CalculateCapitalAllowance(vehicle, taxYear, from, to, businessFraction, expenses, warnings);

        // --- Simplified expenses for comparison ---
        report.SimplifiedExpenses = CalculateSimplified(businessMiles, vehicle?.VehicleType ?? VehicleTypes.Car);

        // --- Comparison ---
        var actualTotal = Round2(report.Totals.Allowable + report.CapitalAllowance.Allowance);
        var simplifiedTotal = report.SimplifiedExpenses.Amount;
        if (flatRate)
            report.Totals.FlatRateClaim = Round2(simplifiedTotal + report.Totals.Allowable);   // mileage + parking/tolls
        report.Comparison = new TaxReportComparisonDto
        {
            ActualCostTotal = actualTotal,
            SimplifiedTotal = simplifiedTotal,
            Difference = Round2(actualTotal - simplifiedTotal),
            BetterMethod = actualTotal > simplifiedTotal ? ClaimMethods.ActualCost : actualTotal < simplifiedTotal ? ClaimMethods.Mileage : "equal",
            LockedToOtherMethod = vehicle != null && vehicle.ClaimMethodLockedFromTaxYear.HasValue
                                  && ((vehicle.ClaimMethod == ClaimMethods.Mileage && actualTotal > simplifiedTotal)
                                      || (vehicle.ClaimMethod == ClaimMethods.ActualCost && simplifiedTotal > actualTotal))
        };
        if (report.Comparison.LockedToOtherMethod)
            warnings.Add(Warn("info", "BETTER_METHOD_LOCKED", "The other method would give a larger deduction this year, but this vehicle is locked to its current method."));

        // --- SA103 box mapping ---
        report.Sa103Boxes = BuildBoxes(report);

        return report;
    }

    // ---------- Combined (all vehicles) ----------

    public async Task<TaxYearCombinedReportDto> BuildCombinedReportAsync(string userId, int taxYear, IReadOnlyDictionary<string, double>? businessUseOverrides = null)
    {
        var (from, to) = TaxYearRange(taxYear);
        var combined = new TaxYearCombinedReportDto
        {
            TaxYear = taxYear,
            TaxYearLabel = Label(taxYear),
            PeriodFrom = from,
            PeriodTo = to,
            Disclaimer = new TaxYearReportDto().Disclaimer
        };

        // Vehicles whose ownership window overlaps the tax year – sold / inactive ones included.
        var all = await _vehicles.GetVehiclesAsync(userId, includeInactive: true);
        var inYear = all
            .Where(v => (!v.PurchaseDate.HasValue || v.PurchaseDate.Value <= to) && (!v.DisposalDate.HasValue || v.DisposalDate.Value >= from))
            .OrderBy(v => v.PurchaseDate ?? DateTime.MinValue)
            .ToList();

        foreach (var v in inYear)
        {
            double? pct = null;
            if (businessUseOverrides != null && businessUseOverrides.TryGetValue(v.Id!, out var o)) pct = o;
            var report = await BuildReportAsync(userId, taxYear, v.Id, pct, strictVehicle: true);
            combined.Vehicles.Add(report);
            combined.TotalBusinessMiles += report.Mileage.BusinessMiles;
            combined.TotalClaim += report.Totals.FlatRateVehicle
                ? report.Totals.FlatRateClaim
                : Round2(report.Totals.Allowable + report.CapitalAllowance.Allowance);
        }
        combined.TotalClaim = Round2(combined.TotalClaim);

        // Records with no vehicle are excluded from every per-vehicle report – tell the user.
        var routes = await _routes.GetRoutesByDateRangeAsync(userId, from, to);
        combined.UnassignedRoutes = routes.Count(r => r.Status == "completed" && r.VehicleId == null);
        combined.UnassignedExpenses = (await _expenses.GetExpensesAsync(userId, from, to)).Count(e => e.VehicleId == null);
        combined.UnassignedOdometerReadings = (await _expenses.GetOdometerReadingsAsync(userId, from, to)).Count(r => r.VehicleId == null);
        if (combined.UnassignedRoutes + combined.UnassignedExpenses + combined.UnassignedOdometerReadings > 0)
            combined.Warnings.Add(Warn("warning", "UNASSIGNED_RECORDS",
                $"{combined.UnassignedRoutes} route(s), {combined.UnassignedExpenses} expense(s) and {combined.UnassignedOdometerReadings} odometer reading(s) have no vehicle and are not included. Use \"Assign by date\" on the Vehicles page."));
        if (inYear.Count == 0)
            combined.Warnings.Add(Warn("warning", "NO_VEHICLES_IN_YEAR", "No vehicle was in use during this tax year (check purchase / disposal dates)."));

        // Sum boxes across vehicles (same form + box number).
        combined.Sa103Boxes = combined.Vehicles
            .SelectMany(r => r.Sa103Boxes.Select(b => (b, r.Vehicle?.Registration ?? "?")))
            .GroupBy(x => (x.b.Form, x.b.Box))
            .OrderBy(g => g.Key.Form == "SA103F" ? 0 : 1).ThenBy(g => int.TryParse(g.Key.Box, out var n) ? n : 999)
            .Select(g => new TaxReportBoxDto
            {
                Form = g.Key.Form,
                Box = g.Key.Box,
                Label = g.First().b.Label.Replace(" (flat-rate mileage + parking/tolls)", "").Replace(" (total)", ""),
                Amount = Round2(g.Sum(x => x.b.Amount)),
                Note = string.Join(" + ", g.Select(x => $"{x.Item2} £{x.b.Amount:N2}"))
            })
            .ToList();

        // Simplified-expenses 10,000-mile band is per business, not per vehicle.
        var flatRateMiles = combined.Vehicles.Where(r => r.Totals.FlatRateVehicle).Sum(r => r.SimplifiedExpenses.BusinessMiles);
        if (flatRateMiles > _rules.MileageFirstBandMiles && combined.Vehicles.Count(r => r.Totals.FlatRateVehicle) > 1)
            combined.Warnings.Add(Warn("warning", "FLAT_RATE_BAND_SHARED",
                $"Flat-rate vehicles together exceed {_rules.MileageFirstBandMiles:N0} business miles; the {_rules.MileageRateSecondBand:P0} band applies across the business, so the summed mileage claim is slightly overstated."));

        return combined;
    }

    // ---------- Capital allowances ----------

    private TaxReportCapitalAllowanceDto CalculateCapitalAllowance(
        Vehicle? vehicle, int taxYear, DateTime from, DateTime to, decimal? businessFraction,
        List<Expense> expenses, List<TaxReportWarningDto> warnings)
    {
        var ca = new TaxReportCapitalAllowanceDto { BusinessUsePercent = businessFraction.HasValue ? (double)(businessFraction.Value * 100) : null };

        if (vehicle == null)
        {
            ca.Reason = "No vehicle configured.";
            return ca;
        }
        if (vehicle.ClaimMethod == ClaimMethods.Mileage)
        {
            ca.Reason = vehicle.DisposalDate.HasValue && vehicle.DisposalDate.Value >= from && vehicle.DisposalDate.Value <= to
                ? "Flat-rate mileage vehicle: no capital allowances were ever claimed, so its disposal has no balancing allowance or charge."
                : "Capital allowances cannot be claimed alongside the flat-rate mileage method (the rate already includes the cost of the vehicle).";
            return ca;
        }
        if (vehicle.FinanceType == "lease")
        {
            ca.Reason = "Leased vehicles are not owned, so no capital allowance – the lease payments are a running cost instead.";
            return ca;
        }

        // Purchase in this tax year → qualifying expenditure; otherwise use the pool brought forward.
        var boughtThisYear = vehicle.PurchaseDate.HasValue && vehicle.PurchaseDate.Value >= from && vehicle.PurchaseDate.Value <= to;
        var purchasePrice = vehicle.PurchasePrice
                            ?? expenses.Where(e => e.Category == ExpenseCategories.VehiclePurchase).Sum(e => (decimal?)e.Amount);

        // Disposal in this tax year → no writing-down allowance; instead a balancing adjustment on the single-asset pool:
        // written-down value b/f (or cost, if bought and sold in the same year) minus proceeds (capped at cost).
        var disposedThisYear = vehicle.DisposalDate.HasValue && vehicle.DisposalDate.Value >= from && vehicle.DisposalDate.Value <= to;
        if (disposedThisYear)
        {
            ca.IsDisposal = true;
            ca.DisposalDate = vehicle.DisposalDate;

            decimal wdv;
            if (boughtThisYear)
            {
                if (purchasePrice is null or <= 0)
                {
                    ca.Reason = "Vehicle was bought and disposed of this tax year but no purchase price is recorded.";
                    warnings.Add(Warn("warning", "NO_PURCHASE_PRICE", "Enter the vehicle purchase price to calculate the balancing adjustment."));
                    return ca;
                }
                wdv = purchasePrice.Value;
                ca.QualifyingExpenditure = wdv;
            }
            else
            {
                if (vehicle.PoolBroughtForwardTaxYear.HasValue && vehicle.PoolBroughtForwardTaxYear.Value != taxYear)
                {
                    ca.Reason = $"The pool value on record is for {Label(vehicle.PoolBroughtForwardTaxYear.Value)}, not {Label(taxYear)}. Enter the written-down value carried forward into the disposal year.";
                    warnings.Add(Warn("warning", "POOL_YEAR_MISMATCH", ca.Reason));
                    return ca;
                }
                if (vehicle.CapitalAllowancePoolBroughtForward is null or <= 0)
                {
                    ca.Reason = $"Disposed of in {Label(taxYear)} but no written-down value brought forward is recorded. Enter the pool b/f (value after last year's allowance) on the Vehicles page.";
                    warnings.Add(Warn("warning", "NO_POOL_BF_DISPOSAL", ca.Reason));
                    return ca;
                }
                wdv = vehicle.CapitalAllowancePoolBroughtForward.Value;
                ca.PoolBroughtForward = wdv;
            }

            var proceeds = vehicle.DisposalProceeds ?? 0m;
            if (vehicle.DisposalProceeds == null)
                warnings.Add(Warn("warning", "NO_DISPOSAL_PROCEEDS", "No disposal proceeds recorded – treated as £0 (scrapped for nothing). Enter the sale / scrap / insurance amount on the Vehicles page if you received anything."));
            if (purchasePrice.HasValue && proceeds > purchasePrice.Value)
            {
                warnings.Add(Warn("info", "PROCEEDS_CAPPED", $"Disposal proceeds (£{proceeds:N0}) exceed the original cost (£{purchasePrice:N0}); the balancing charge is capped at cost."));
                proceeds = purchasePrice.Value;
            }
            ca.DisposalProceeds = proceeds;

            var gross = Round2(wdv - proceeds);
            ca.BalancingAdjustmentGross = gross;
            ca.Applicable = true;
            ca.Rate = 0;
            ca.PoolCarriedForward = 0;
            if (gross >= 0)
            {
                ca.BalancingType = "balancingAllowance";
                (ca.AllowanceType, ca.AllowanceLabel, ca.Sa103Box) = ("balancingAllowance", $"Balancing allowance on disposal ({vehicle.DisposalDate:d MMM yyyy}): written-down value £{wdv:N2} − proceeds £{proceeds:N2}", "56");
                ca.GrossAllowance = gross;
                ca.Allowance = businessFraction.HasValue ? Round2(gross * businessFraction.Value) : 0;
            }
            else
            {
                ca.BalancingType = "balancingCharge";
                (ca.AllowanceType, ca.AllowanceLabel, ca.Sa103Box) = ("balancingCharge", $"Balancing charge on disposal ({vehicle.DisposalDate:d MMM yyyy}): proceeds £{proceeds:N2} − written-down value £{wdv:N2}", "58");
                ca.GrossAllowance = gross;                       // negative
                ca.Allowance = businessFraction.HasValue ? Round2(gross * businessFraction.Value) : 0;   // negative = added to profit
                warnings.Add(Warn("info", "BALANCING_CHARGE", $"Proceeds exceed the written-down value: a balancing charge of £{-ca.Allowance:N2} (business share) is added to your profit."));
            }
            if (!businessFraction.HasValue)
                warnings.Add(Warn("warning", "CA_NO_BUSINESS_PERCENT", "The balancing adjustment is shown as £0 because the business-use % is unknown."));
            return ca;
        }

        decimal baseAmount;
        if (boughtThisYear)
        {
            if (purchasePrice is null or <= 0)
            {
                ca.Reason = "Vehicle was bought this tax year but no purchase price is recorded.";
                warnings.Add(Warn("warning", "NO_PURCHASE_PRICE", "Enter the vehicle purchase price to calculate the capital allowance."));
                return ca;
            }
            ca.QualifyingExpenditure = purchasePrice.Value;
            baseAmount = purchasePrice.Value;
        }
        else
        {
            if (vehicle.PoolBroughtForwardTaxYear.HasValue && vehicle.PoolBroughtForwardTaxYear.Value != taxYear)
            {
                ca.Reason = $"The pool value on record is for {Label(vehicle.PoolBroughtForwardTaxYear.Value)}, not {Label(taxYear)}. Update the vehicle with the written-down value carried forward into this year.";
                warnings.Add(Warn("warning", "POOL_YEAR_MISMATCH", ca.Reason));
                return ca;
            }
            if (vehicle.CapitalAllowancePoolBroughtForward is null or <= 0)
            {
                if (vehicle.PurchaseDate.HasValue && vehicle.PurchaseDate.Value > to)
                {
                    ca.Reason = $"The vehicle's purchase date ({vehicle.PurchaseDate:d MMM yyyy}) is after this tax year – check the year on the Vehicles page.";
                    warnings.Add(Warn("warning", "PURCHASE_AFTER_YEAR", ca.Reason));
                }
                else if (vehicle.PurchaseDate.HasValue && vehicle.PurchaseDate.Value < from)
                {
                    ca.Reason = $"Bought in an earlier year: enter the written-down value carried forward into {Label(taxYear)} on the Vehicles page (pool b/f) to claim the writing-down allowance.";
                    warnings.Add(Warn("warning", "NO_POOL_BF", ca.Reason));
                }
                else
                {
                    ca.Reason = "No purchase date recorded for this vehicle.";
                    warnings.Add(Warn("warning", "NO_PURCHASE_DATE", "Enter the vehicle's purchase date and price to calculate the capital allowance."));
                }
                return ca;
            }
            ca.PoolBroughtForward = vehicle.CapitalAllowancePoolBroughtForward.Value;
            baseAmount = ca.PoolBroughtForward;
        }

        // Rate selection.
        var isZeroEmission = vehicle.Co2GPerKm == 0 || string.Equals(vehicle.FuelType, "electric", StringComparison.OrdinalIgnoreCase);
        if (vehicle.VehicleType is VehicleTypes.Van or VehicleTypes.Motorcycle)
        {
            if (boughtThisYear)
            {
                (ca.AllowanceType, ca.AllowanceLabel, ca.Rate, ca.Sa103Box) = ("aia", "Annual Investment Allowance (van / motorcycle)", _rules.AiaRate, "49");
            }
            else
            {
                (ca.AllowanceType, ca.AllowanceLabel, ca.Rate, ca.Sa103Box) = ("mainRateWda", $"{_rules.MainRateWda:P0} main rate writing-down allowance", _rules.MainRateWda, "50");
            }
        }
        else if (boughtThisYear && vehicle.IsNew && isZeroEmission)
        {
            (ca.AllowanceType, ca.AllowanceLabel, ca.Rate, ca.Sa103Box) = ("fyaZeroEmission", "100% first-year allowance (new zero-emission car)", _rules.ZeroEmissionCarFya, "52");
        }
        else if (vehicle.Co2GPerKm.HasValue && vehicle.Co2GPerKm.Value <= _rules.MainRateCo2Threshold)
        {
            (ca.AllowanceType, ca.AllowanceLabel, ca.Rate, ca.Sa103Box) = ("mainRateWda", $"{_rules.MainRateWda:P0} main rate writing-down allowance (CO2 ≤ {_rules.MainRateCo2Threshold} g/km)", _rules.MainRateWda, "50");
        }
        else if (vehicle.Co2GPerKm.HasValue)
        {
            (ca.AllowanceType, ca.AllowanceLabel, ca.Rate, ca.Sa103Box) = ("specialRateWda", $"{_rules.SpecialRateWda:P0} special rate writing-down allowance (CO2 > {_rules.MainRateCo2Threshold} g/km)", _rules.SpecialRateWda, "51");
        }
        else
        {
            // CAA 2001 s104AA: a car registered on/after 1 March 2001 with no CO2 figure is not a "main rate car",
            // so it falls into the special rate pool. (Pre-March-2001 cars are main rate – rare enough to leave to the user.)
            (ca.AllowanceType, ca.AllowanceLabel, ca.Rate, ca.Sa103Box) = ("specialRateWda", $"{_rules.SpecialRateWda:P0} special rate writing-down allowance (no CO2 figure recorded)", _rules.SpecialRateWda, "51");
            warnings.Add(Warn("warning", "NO_CO2",
                $"No CO2 figure is recorded for this car, so HMRC's default of the {_rules.SpecialRateWda:P0} special rate has been applied. " +
                $"If the V5C (field V.7) or the DVLA lookup shows {_rules.MainRateCo2Threshold} g/km or less, enter it to get the {_rules.MainRateWda:P0} main rate; " +
                "cars first registered before 1 March 2001 qualify for the main rate regardless."));
        }

        ca.Applicable = true;
        ca.GrossAllowance = Round2(baseAmount * ca.Rate);
        ca.Allowance = businessFraction.HasValue ? Round2(ca.GrossAllowance * businessFraction.Value) : 0;
        ca.PoolCarriedForward = Round2(baseAmount - ca.GrossAllowance);

        if (!businessFraction.HasValue)
            warnings.Add(Warn("warning", "CA_NO_BUSINESS_PERCENT", "The capital allowance is shown as £0 because the business-use % is unknown."));

        return ca;
    }

    // ---------- Simplified expenses ----------

    private TaxReportSimplifiedDto CalculateSimplified(double businessMiles, string vehicleType)
    {
        if (vehicleType == VehicleTypes.Motorcycle)
        {
            return new TaxReportSimplifiedDto
            {
                BusinessMiles = businessMiles,
                FirstBandMiles = businessMiles,
                FirstBandRate = _rules.MotorcycleMileageRate,
                SecondBandMiles = 0,
                SecondBandRate = _rules.MotorcycleMileageRate,
                Amount = Round2((decimal)businessMiles * _rules.MotorcycleMileageRate)
            };
        }

        var first = Math.Min(businessMiles, _rules.MileageFirstBandMiles);
        var second = Math.Max(0, businessMiles - _rules.MileageFirstBandMiles);
        return new TaxReportSimplifiedDto
        {
            BusinessMiles = businessMiles,
            FirstBandMiles = first,
            FirstBandRate = _rules.MileageRateFirstBand,
            SecondBandMiles = second,
            SecondBandRate = _rules.MileageRateSecondBand,
            Amount = Round2((decimal)first * _rules.MileageRateFirstBand + (decimal)second * _rules.MileageRateSecondBand)
        };
    }

    // ---------- SA103 ----------

    private static List<TaxReportBoxDto> BuildBoxes(TaxYearReportDto r)
    {
        if (r.Totals.FlatRateVehicle)
        {
            return new List<TaxReportBoxDto>
            {
                new() { Box = "20", Label = "Car, van and travel expenses (flat-rate mileage + parking/tolls)", Amount = r.Totals.FlatRateClaim,
                        Note = $"{r.SimplifiedExpenses.BusinessMiles:N0} business miles at the flat rate = £{r.SimplifiedExpenses.Amount:N2}, plus £{r.Totals.Allowable:N2} allowable parking/tolls. Enter the same figure on SA103S box 11." },
                new() { Box = "35", Label = "Disallowable car, van and travel expenses", Amount = 0m,
                        Note = "Simplified expenses are entered net – nothing to disallow." }
            };
        }

        var boxes = new List<TaxReportBoxDto>
        {
            new() { Box = "20", Label = "Car, van and travel expenses (total)", Amount = r.Totals.TotalExpenses,
                    Note = "Full amount of running costs before the private-use adjustment." },
            new() { Box = "35", Label = "Disallowable car, van and travel expenses", Amount = r.Totals.Disallowable,
                    Note = "Private-use share (100% − business %)." }
        };

        if (r.CapitalAllowance.Applicable && r.CapitalAllowance.Sa103Box != null)
        {
            boxes.Add(new TaxReportBoxDto
            {
                Box = r.CapitalAllowance.Sa103Box,
                Label = r.CapitalAllowance.Sa103Box switch
                {
                    "49" => "Annual Investment Allowance",
                    "50" => "Capital allowances at 18% on equipment, including cars with lower CO2 emissions",
                    "51" => "Capital allowances at 6% on equipment, including cars with higher CO2 emissions",
                    "52" => "Zero-emission car allowance",
                    "56" => "Other capital allowances (balancing allowance on disposal)",
                    "58" => "Balancing charge on sale or cessation of business use",
                    _ => "Capital allowance"
                },
                Amount = Math.Abs(r.CapitalAllowance.Allowance),
                Note = r.CapitalAllowance.BalancingType == "balancingCharge"
                    ? "Added to profit (business share). Already reduced for private use."
                    : "Already reduced for private use."
            });
        }

        boxes.Add(new TaxReportBoxDto
        {
            Form = "SA103S",
            Box = "11",
            Label = "Car, van and travel expenses (short form – enter the allowable amount)",
            Amount = r.Totals.Allowable,
            Note = "The short form takes the net allowable figure directly."
        });

        return boxes;
    }

    // ---------- Exports ----------

    public string ToCsv(TaxYearReportDto r)
    {
        var sb = new StringBuilder();
        var inv = CultureInfo.InvariantCulture;
        void Row(params object?[] cells) => sb.AppendLine(string.Join(",", cells.Select(Csv)));

        Row("IncomeMeter tax year report", r.TaxYearLabel);
        Row("Period", r.PeriodFrom.ToString("yyyy-MM-dd", inv), r.PeriodTo.ToString("yyyy-MM-dd", inv));
        Row("Generated", r.GeneratedAt.ToString("yyyy-MM-dd HH:mm", inv) + " UTC");
        if (r.Vehicle != null) Row("Vehicle", r.Vehicle.Registration, r.Vehicle.Description, r.Vehicle.VehicleType, "claim method: " + r.Vehicle.ClaimMethod);
        sb.AppendLine();

        Row("MILEAGE");
        Row("Business miles (routes)", r.Mileage.BusinessMiles);
        Row("Routes counted", r.Mileage.RoutesCounted);
        Row("Odometer opening", r.Mileage.OdometerStart?.Date.ToString("yyyy-MM-dd", inv), r.Mileage.OdometerStart?.Miles);
        Row("Odometer closing", r.Mileage.OdometerEnd?.Date.ToString("yyyy-MM-dd", inv), r.Mileage.OdometerEnd?.Miles);
        Row("Total miles", r.Mileage.TotalMiles);
        Row("Business use %", r.Mileage.BusinessUsePercent, r.Mileage.BusinessUseSource);
        sb.AppendLine();

        Row("EXPENSES", "Count", "Total", "100% business", "Allowable", "Disallowable", "Receipts missing");
        foreach (var c in r.Categories)
            Row(c.Category, c.Count, c.Total, c.FullyBusinessTotal, c.Allowable, c.Disallowable, c.ReceiptsMissing);
        Row("TOTAL", r.Categories.Sum(c => c.Count), r.Totals.TotalExpenses, r.Categories.Sum(c => c.FullyBusinessTotal), r.Totals.Allowable, r.Totals.Disallowable, r.Totals.ReceiptsMissing);
        sb.AppendLine();

        Row("CAPITAL ALLOWANCE");
        Row("Applicable", r.CapitalAllowance.Applicable, r.CapitalAllowance.Reason ?? r.CapitalAllowance.AllowanceLabel);
        Row("Qualifying expenditure", r.CapitalAllowance.QualifyingExpenditure);
        Row("Pool brought forward", r.CapitalAllowance.PoolBroughtForward);
        Row("Rate", r.CapitalAllowance.Rate);
        Row("Gross allowance", r.CapitalAllowance.GrossAllowance);
        Row("Allowance (business share)", r.CapitalAllowance.Allowance);
        Row("Pool carried forward", r.CapitalAllowance.PoolCarriedForward);
        sb.AppendLine();

        Row("SIMPLIFIED EXPENSES (for comparison)");
        Row("First band miles", r.SimplifiedExpenses.FirstBandMiles, r.SimplifiedExpenses.FirstBandRate);
        Row("Second band miles", r.SimplifiedExpenses.SecondBandMiles, r.SimplifiedExpenses.SecondBandRate);
        Row("Amount", r.SimplifiedExpenses.Amount);
        sb.AppendLine();

        Row("COMPARISON");
        Row("Actual cost method (allowable + capital allowance)", r.Comparison.ActualCostTotal);
        Row("Simplified expenses", r.Comparison.SimplifiedTotal);
        Row("Better method", r.Comparison.BetterMethod, r.Comparison.LockedToOtherMethod ? "locked to current method" : "");
        sb.AppendLine();

        Row("SA103 BOXES", "Form", "Box", "Amount", "Note");
        foreach (var b in r.Sa103Boxes) Row(b.Label, b.Form, b.Box, b.Amount, b.Note);
        sb.AppendLine();

        Row("WARNINGS");
        foreach (var w in r.Warnings) Row(w.Severity, w.Code, w.Message);
        sb.AppendLine();
        Row("Disclaimer", r.Disclaimer);

        return sb.ToString();
    }

    public async Task<byte[]> BuildReceiptsZipAsync(string userId, int taxYear, string? vehicleId = null, CancellationToken ct = default)
    {
        var (from, to) = TaxYearRange(taxYear);
        var expenses = await _expenses.GetExpensesAsync(userId, from, to);
        var readings = await _expenses.GetOdometerReadingsAsync(userId, from, to);
        if (!string.IsNullOrWhiteSpace(vehicleId))
        {
            expenses = expenses.Where(e => e.VehicleId == null || e.VehicleId == vehicleId).ToList();
            readings = readings.Where(r => r.VehicleId == null || r.VehicleId == vehicleId).ToList();
        }

        var report = await BuildReportAsync(userId, taxYear, vehicleId);

        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            var summary = zip.CreateEntry($"tax-year-{report.TaxYearLabel.Replace('/', '-')}-summary.csv");
            await using (var w = new StreamWriter(summary.Open(), new UTF8Encoding(true)))
                await w.WriteAsync(ToCsv(report));

            // Expense index + receipts
            var index = new StringBuilder();
            index.AppendLine("date,category,merchant,amount,currency,fullyBusiness,litres,odometerMiles,notes,receiptFiles");
            var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var e in expenses.OrderBy(e => e.Date))
            {
                var files = new List<string>();
                var atts = await _attachments.GetByIdsAsync(e.AttachmentIds, userId);
                foreach (var a in atts)
                {
                    var name = UniqueName(usedNames, $"receipts/{e.Date:yyyy-MM-dd}_{e.Category}_{Sanitise(e.Merchant)}{Path.GetExtension(a.FileName)}");
                    if (await AddToZip(zip, a, name, ct)) files.Add(name);
                }
                index.AppendLine(string.Join(",", new object?[]
                {
                    e.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), e.Category, e.Merchant, e.Amount, e.Currency,
                    e.IsFullyBusiness, e.Fuel?.Litres, e.Fuel?.OdometerMiles, e.Notes, string.Join("|", files)
                }.Select(Csv)));
            }
            var idx = zip.CreateEntry("expenses.csv");
            await using (var w = new StreamWriter(idx.Open(), new UTF8Encoding(true)))
                await w.WriteAsync(index.ToString());

            // Odometer index + photos
            var odo = new StringBuilder();
            odo.AppendLine("date,miles,source,notes,photoFile");
            foreach (var r in readings.OrderBy(r => r.Date))
            {
                string? file = null;
                if (r.PhotoAttachmentId != null)
                {
                    var a = await _attachments.GetByIdAsync(r.PhotoAttachmentId, userId);
                    if (a != null)
                    {
                        var name = UniqueName(usedNames, $"odometer/{r.Date:yyyy-MM-dd}_{r.Miles:0}{Path.GetExtension(a.FileName)}");
                        if (await AddToZip(zip, a, name, ct)) file = name;
                    }
                }
                odo.AppendLine(string.Join(",", new object?[] { r.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), r.Miles, r.Source, r.Notes, file }.Select(Csv)));
            }
            var odoEntry = zip.CreateEntry("odometer-readings.csv");
            await using (var w = new StreamWriter(odoEntry.Open(), new UTF8Encoding(true)))
                await w.WriteAsync(odo.ToString());
        }

        return ms.ToArray();
    }

    private async Task<bool> AddToZip(ZipArchive zip, Attachment a, string entryName, CancellationToken ct)
    {
        await using var src = await _attachments.OpenContentAsync(a, ct);
        if (src == null) return false;
        var entry = zip.CreateEntry(entryName, CompressionLevel.Fastest);
        await using var dst = entry.Open();
        await src.CopyToAsync(dst, ct);
        return true;
    }

    // ---------- helpers ----------

    private static TaxReportWarningDto Warn(string severity, string code, string message) =>
        new() { Severity = severity, Code = code, Message = message };

    private static decimal Round2(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    private static string Csv(object? v)
    {
        if (v == null) return "";
        var s = v switch
        {
            decimal d => d.ToString("0.00", CultureInfo.InvariantCulture),
            double d => d.ToString("0.##", CultureInfo.InvariantCulture),
            bool b => b ? "yes" : "no",
            _ => v.ToString() ?? ""
        };
        return s.IndexOfAny(new[] { ',', '"', '\n', '\r' }) >= 0 ? $"\"{s.Replace("\"", "\"\"")}\"" : s;
    }

    private static string Sanitise(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "receipt";
        var cleaned = new string(s.Trim().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray());
        return cleaned.Length > 30 ? cleaned[..30] : cleaned;
    }

    private static string UniqueName(HashSet<string> used, string name)
    {
        if (used.Add(name)) return name;
        var ext = Path.GetExtension(name);
        var stem = name[..^ext.Length];
        for (var i = 2; ; i++)
        {
            var candidate = $"{stem}_{i}{ext}";
            if (used.Add(candidate)) return candidate;
        }
    }
}
