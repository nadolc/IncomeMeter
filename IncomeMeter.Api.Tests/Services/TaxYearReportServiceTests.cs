using FluentAssertions;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using Route = IncomeMeter.Api.Models.Route;

namespace IncomeMeter.Api.Tests.Services;

public class TaxYearReportServiceTests
{
    private const string UserId = "user-1";
    private const int TaxYear = 2025; // 6 Apr 2025 – 5 Apr 2026

    private readonly Mock<IRouteService> _routes = new();
    private readonly Mock<IExpenseService> _expenses = new();
    private readonly Mock<IVehicleService> _vehicles = new();
    private readonly Mock<IAttachmentService> _attachments = new();

    private readonly List<Route> _routeData = new();
    private readonly List<Expense> _expenseData = new();
    private readonly List<OdometerReading> _readingData = new();
    private readonly List<Vehicle> _vehicleData = new();

    private TaxYearReportService CreateSut()
    {
        _routes.Setup(r => r.GetRoutesByDateRangeAsync(UserId, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(_routeData);
        _expenses.Setup(e => e.GetExpensesAsync(UserId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null))
            .ReturnsAsync((string _, DateTime? from, DateTime? to, string? _) =>
                _expenseData.Where(e => e.Date >= from && e.Date <= to).ToList());
        _expenses.Setup(e => e.GetOdometerReadingsAsync(UserId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync((string _, DateTime? from, DateTime? to) =>
                _readingData.Where(r => r.Date >= from && r.Date <= to).ToList());
        _vehicles.Setup(v => v.GetVehiclesAsync(UserId, false)).ReturnsAsync(_vehicleData);
        _vehicles.Setup(v => v.GetVehicleByIdAsync(It.IsAny<string>(), UserId))
            .ReturnsAsync((string id, string _) => _vehicleData.FirstOrDefault(v => v.Id == id));
        _attachments.Setup(a => a.GetByIdsAsync(It.IsAny<IEnumerable<string>>(), UserId))
            .ReturnsAsync((IEnumerable<string> ids, string _) =>
                ids.Select(id => new Attachment { Id = id, UserId = UserId, FileName = "r.jpg", ContentType = "image/jpeg", Sha256 = "x", StorageKey = "k" }).ToList());

        return new TaxYearReportService(_routes.Object, _expenses.Object, _vehicles.Object, _attachments.Object,
            Options.Create(new TaxRulesSettings()));
    }

    private static DateTime D(int month, int day, int year = TaxYear) => new(year, month, day, 12, 0, 0, DateTimeKind.Utc);

    private void AddRoute(double start, double end, DateTime? when = null) => _routeData.Add(new Route
    {
        UserId = UserId, Status = "completed", StartMile = start, EndMile = end,
        ScheduleStart = when ?? D(6, 1), Distance = end - start
    });

    private void AddExpense(string category, decimal amount, bool fullyBusiness = false, string? attachmentId = "att", DateTime? when = null, double? odometer = null) =>
        _expenseData.Add(new Expense
        {
            UserId = UserId, Category = category, Amount = amount, Date = when ?? D(7, 1), IsFullyBusiness = fullyBusiness,
            AttachmentIds = attachmentId == null ? new List<string>() : new List<string> { attachmentId },
            Fuel = odometer.HasValue ? new FuelDetails { OdometerMiles = odometer } : null
        });

    private void AddReading(DateTime when, double miles) =>
        _readingData.Add(new OdometerReading { UserId = UserId, Date = when, Miles = miles, Source = "manual" });

    private Vehicle AddCar(int? co2 = 120, bool isNew = false, DateTime? purchaseDate = null, decimal? price = null,
        decimal? poolBf = null, int? poolYear = null, string type = VehicleTypes.Car, string claimMethod = ClaimMethods.ActualCost,
        int? lockedFrom = null, string fuel = "petrol")
    {
        var v = new Vehicle
        {
            Id = "veh-1", UserId = UserId, Registration = "AB12CDE", VehicleType = type, Co2GPerKm = co2, IsNew = isNew,
            PurchaseDate = purchaseDate, PurchasePrice = price, CapitalAllowancePoolBroughtForward = poolBf,
            PoolBroughtForwardTaxYear = poolYear, ClaimMethod = claimMethod, ClaimMethodLockedFromTaxYear = lockedFrom, FuelType = fuel
        };
        _vehicleData.Add(v);
        return v;
    }

    // ---------- tax year helpers ----------

    [Theory]
    [InlineData(2025, 4, 5, 2024)]
    [InlineData(2025, 4, 6, 2025)]
    [InlineData(2026, 1, 31, 2025)]
    public void TaxYearFor_uses_6_April_boundary(int y, int m, int d, int expected)
    {
        CreateSut().TaxYearFor(new DateTime(y, m, d, 0, 0, 0, DateTimeKind.Utc)).Should().Be(expected);
    }

    // ---------- business use % and apportioning ----------

    [Fact]
    public async Task Apportions_running_costs_by_business_miles_over_odometer_total()
    {
        AddCar();
        AddReading(D(4, 6), 50_000);
        AddReading(D(4, 5, TaxYear + 1), 60_000);           // 10,000 total miles
        AddRoute(50_000, 54_000);
        AddRoute(54_000, 57_500);                          // 7,500 business miles → 75%
        AddExpense(ExpenseCategories.Fuel, 1000m);
        AddExpense(ExpenseCategories.Insurance, 400m);
        AddExpense(ExpenseCategories.Parking, 20m, fullyBusiness: true);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear);

        report.Mileage.BusinessMiles.Should().Be(7500);
        report.Mileage.TotalMiles.Should().Be(10_000);
        report.Mileage.BusinessUsePercent.Should().Be(75);
        report.Mileage.BusinessUseSource.Should().Be("odometer");

        report.Totals.TotalExpenses.Should().Be(1420m);
        report.Totals.Allowable.Should().Be(750m + 300m + 20m);
        report.Totals.Disallowable.Should().Be(250m + 100m);

        var parking = report.Categories.Single(c => c.Category == ExpenseCategories.Parking);
        parking.Allowable.Should().Be(20m);
        parking.Disallowable.Should().Be(0m);

        report.Sa103Boxes.Single(b => b.Box == "20" && b.Form == "SA103F").Amount.Should().Be(1420m);
        report.Sa103Boxes.Single(b => b.Box == "35").Amount.Should().Be(350m);
        report.Sa103Boxes.Single(b => b.Form == "SA103S").Amount.Should().Be(1070m);
    }

    [Fact]
    public async Task Uses_fuel_receipt_odometer_figures_as_readings()
    {
        AddCar();
        AddExpense(ExpenseCategories.Fuel, 60m, when: D(4, 7), odometer: 20_000);
        AddExpense(ExpenseCategories.Fuel, 60m, when: D(4, 1, TaxYear + 1), odometer: 24_000);
        AddRoute(20_000, 22_000);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear);

        report.Mileage.TotalMiles.Should().Be(4000);
        report.Mileage.OdometerStart!.Source.Should().Be("fuelReceipt");
        report.Mileage.BusinessUsePercent.Should().Be(50);
    }

    [Fact]
    public async Task Without_two_readings_only_fully_business_items_are_allowable_and_a_warning_is_raised()
    {
        AddCar();
        AddRoute(0, 1000);
        AddExpense(ExpenseCategories.Fuel, 500m);
        AddExpense(ExpenseCategories.Tolls, 12m, fullyBusiness: true);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear);

        report.Mileage.BusinessUsePercent.Should().BeNull();
        report.Totals.Allowable.Should().Be(12m);
        report.Warnings.Should().Contain(w => w.Code == "NO_TOTAL_MILES");
        report.Warnings.Should().Contain(w => w.Code == "NO_BUSINESS_PERCENT");
    }

    [Fact]
    public async Task Override_percentage_is_used_when_supplied()
    {
        AddCar();
        AddExpense(ExpenseCategories.Fuel, 200m);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 80);

        report.Mileage.BusinessUseSource.Should().Be("override");
        report.Totals.Allowable.Should().Be(160m);
    }

    [Fact]
    public async Task Business_miles_exceeding_total_are_capped_with_an_error()
    {
        AddCar();
        AddReading(D(4, 6), 1000);
        AddReading(D(4, 5, TaxYear + 1), 2000);
        AddRoute(0, 5000);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear);

        report.Mileage.BusinessUsePercent.Should().Be(100);
        report.Warnings.Should().Contain(w => w.Code == "BUSINESS_EXCEEDS_TOTAL" && w.Severity == "error");
    }

    [Fact]
    public async Task Vehicle_purchase_expenses_are_excluded_from_running_costs()
    {
        AddCar();
        AddExpense(ExpenseCategories.VehiclePurchase, 12_000m);
        AddExpense(ExpenseCategories.Fuel, 100m);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 100);

        report.Totals.TotalExpenses.Should().Be(100m);
        report.Categories.Single(c => c.Category == ExpenseCategories.VehiclePurchase).ExcludedFromRunningCosts.Should().BeTrue();
    }

    [Fact]
    public async Task Missing_receipts_are_counted_and_warned()
    {
        AddCar();
        AddExpense(ExpenseCategories.Fuel, 50m, attachmentId: null);
        AddExpense(ExpenseCategories.Fuel, 50m);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 100);

        report.Totals.ReceiptsMissing.Should().Be(1);
        report.Warnings.Should().Contain(w => w.Code == "RECEIPTS_MISSING");
    }

    // ---------- capital allowances ----------

    [Fact]
    public async Task New_zero_emission_car_bought_this_year_gets_100_percent_FYA_reduced_for_private_use()
    {
        AddCar(co2: 0, isNew: true, purchaseDate: D(9, 1), price: 30_000m, fuel: "electric");

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 75);

        var ca = report.CapitalAllowance;
        ca.Applicable.Should().BeTrue();
        ca.AllowanceType.Should().Be("fyaZeroEmission");
        ca.QualifyingExpenditure.Should().Be(30_000m);
        ca.GrossAllowance.Should().Be(30_000m);
        ca.Allowance.Should().Be(22_500m);
        ca.PoolCarriedForward.Should().Be(0m);
        ca.Sa103Box.Should().Be("52");
        report.Sa103Boxes.Should().Contain(b => b.Box == "52" && b.Amount == 22_500m);
    }

    [Fact]
    public async Task Low_co2_car_bought_this_year_uses_18_percent_main_rate()
    {
        AddCar(co2: 45, purchaseDate: D(5, 10), price: 10_000m);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 50);

        var ca = report.CapitalAllowance;
        ca.AllowanceType.Should().Be("mainRateWda");
        ca.GrossAllowance.Should().Be(1800m);
        ca.Allowance.Should().Be(900m);
        ca.PoolCarriedForward.Should().Be(8200m);
        ca.Sa103Box.Should().Be("50");
    }

    [Fact]
    public async Task High_co2_car_with_pool_brought_forward_uses_6_percent_special_rate()
    {
        AddCar(co2: 140, purchaseDate: D(1, 1, 2023), poolBf: 8000m, poolYear: TaxYear);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 100);

        var ca = report.CapitalAllowance;
        ca.AllowanceType.Should().Be("specialRateWda");
        ca.PoolBroughtForward.Should().Be(8000m);
        ca.GrossAllowance.Should().Be(480m);
        ca.Allowance.Should().Be(480m);
        ca.PoolCarriedForward.Should().Be(7520m);
        ca.Sa103Box.Should().Be("51");
    }

    [Fact]
    public async Task Van_bought_this_year_qualifies_for_AIA()
    {
        AddCar(co2: 200, purchaseDate: D(6, 1), price: 15_000m, type: VehicleTypes.Van);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 90);

        report.CapitalAllowance.AllowanceType.Should().Be("aia");
        report.CapitalAllowance.Allowance.Should().Be(13_500m);
        report.CapitalAllowance.Sa103Box.Should().Be("49");
    }

    [Fact]
    public async Task Pool_for_a_different_tax_year_is_not_used()
    {
        AddCar(co2: 100, purchaseDate: D(1, 1, 2023), poolBf: 8000m, poolYear: TaxYear - 1);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 100);

        report.CapitalAllowance.Applicable.Should().BeFalse();
        report.Warnings.Should().Contain(w => w.Code == "POOL_YEAR_MISMATCH");
    }

    [Fact]
    public async Task Car_without_co2_defaults_to_special_rate_with_a_warning()
    {
        AddCar(co2: null, purchaseDate: D(6, 1), price: 9000m);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 100);

        report.CapitalAllowance.Applicable.Should().BeTrue();
        report.CapitalAllowance.AllowanceType.Should().Be("specialRateWda");
        report.CapitalAllowance.Allowance.Should().Be(540m);   // 9,000 × 6%
        report.CapitalAllowance.Sa103Box.Should().Be("51");
        report.Warnings.Should().Contain(w => w.Code == "NO_CO2");
    }

    // ---------- simplified expenses & comparison ----------

    [Fact]
    public async Task Simplified_expenses_use_45p_then_25p_bands()
    {
        AddCar();
        AddRoute(0, 12_000);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 100);

        report.SimplifiedExpenses.FirstBandMiles.Should().Be(10_000);
        report.SimplifiedExpenses.SecondBandMiles.Should().Be(2_000);
        report.SimplifiedExpenses.Amount.Should().Be(4500m + 500m);
    }

    [Fact]
    public async Task Comparison_picks_the_larger_deduction()
    {
        AddCar(co2: 45, purchaseDate: D(5, 10), price: 10_000m);
        AddRoute(0, 1_000);                                   // simplified = £450
        AddExpense(ExpenseCategories.Fuel, 2_000m);            // allowable = £2,000 @100% + CA £1,800

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 100);

        report.Comparison.SimplifiedTotal.Should().Be(450m);
        report.Comparison.ActualCostTotal.Should().Be(3800m);
        report.Comparison.BetterMethod.Should().Be(ClaimMethods.ActualCost);
        report.Comparison.LockedToOtherMethod.Should().BeFalse();
    }

    [Fact]
    public async Task Vehicle_locked_to_mileage_method_blocks_capital_allowance_and_warns()
    {
        AddCar(co2: 45, purchaseDate: D(5, 10), price: 10_000m, claimMethod: ClaimMethods.Mileage, lockedFrom: 2023);
        AddRoute(0, 1_000);
        AddExpense(ExpenseCategories.Fuel, 2_000m);

        var report = await CreateSut().BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 100);

        report.CapitalAllowance.Applicable.Should().BeFalse();
        report.Warnings.Should().Contain(w => w.Code == "METHOD_LOCKED_MILEAGE" && w.Severity == "error");
        report.Comparison.LockedToOtherMethod.Should().BeTrue();
    }

    // ---------- CSV ----------

    [Fact]
    public async Task Csv_export_contains_key_sections_and_escapes_commas()
    {
        AddCar();
        _expenseData.Add(new Expense { UserId = UserId, Category = ExpenseCategories.Fuel, Amount = 10m, Date = D(7, 1), Merchant = "Shell, Watford", AttachmentIds = new List<string> { "a" } });

        var sut = CreateSut();
        var csv = sut.ToCsv(await sut.BuildReportAsync(UserId, TaxYear, businessUsePercentOverride: 100));

        csv.Should().Contain("MILEAGE").And.Contain("EXPENSES").And.Contain("CAPITAL ALLOWANCE").And.Contain("SA103 BOXES");
        csv.Should().Contain("fuel,1,10.00");
    }
}
