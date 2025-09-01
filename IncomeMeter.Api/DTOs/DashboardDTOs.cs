namespace IncomeMeter.Api.DTOs;

public class PeriodIncomeRequestDto
{
    public string Period { get; set; } = "weekly"; // weekly, monthly, annual
    public int Offset { get; set; } = 0; // 0 = current period, -1 = previous, +1 = next
    public string? FiscalStartDate { get; set; } // MM-DD format, e.g., "04-06"
}

public class PeriodIncomeResponseDto
{
    public string Period { get; set; } = null!;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal TotalIncome { get; set; }
    public int CompletedRoutes { get; set; }
    public double TotalDistance { get; set; }
    public Dictionary<string, WorkTypeStatsDto> IncomeBySource { get; set; } = new();
    public List<PeriodChartDataDto> ChartData { get; set; } = new();
    public PeriodNavigationDto Navigation { get; set; } = new();
}

public class PeriodChartDataDto
{
    public string Label { get; set; } = null!;
    public DateTime Date { get; set; }
    public decimal Income { get; set; }
    public int Routes { get; set; }
    public double Distance { get; set; }
}

public class PeriodNavigationDto
{
    public string CurrentPeriodDisplay { get; set; } = null!;
    public string PreviousPeriodDisplay { get; set; } = null!;
    public string NextPeriodDisplay { get; set; } = null!;
    public bool CanGoPrevious { get; set; } = true;
    public bool CanGoNext { get; set; } = true;
}

public class WeeklyIncomeResponseDto : PeriodIncomeResponseDto
{
    public int WeekNumber { get; set; }
    public int FiscalYear { get; set; }
}

public class MonthlyIncomeResponseDto : PeriodIncomeResponseDto
{
    public int Month { get; set; }
    public int Year { get; set; }
    public List<WeekInMonthDto> WeeksInMonth { get; set; } = new();
}

public class AnnualIncomeResponseDto : PeriodIncomeResponseDto
{
    public int FiscalYear { get; set; }
    public List<MonthInFiscalYearDto> MonthsInFiscalYear { get; set; } = new();
}

public class WeekInMonthDto
{
    public int WeekNumber { get; set; }
    public DateTime WeekStartDate { get; set; }
    public DateTime WeekEndDate { get; set; }
    public decimal Income { get; set; }
    public bool IsPartialWeek { get; set; }
}

public class MonthInFiscalYearDto
{
    public int Month { get; set; }
    public int Year { get; set; }
    public string MonthName { get; set; } = null!;
    public decimal Income { get; set; }
    public int Routes { get; set; }
}

public class DashboardStatsDto
{
    public decimal Last7DaysIncome { get; set; }
    public decimal Previous7DaysIncome { get; set; }
    public decimal CurrentMonthIncome { get; set; }
    public decimal NetIncome { get; set; }
    public double Last7DaysMileage { get; set; }
    public double CurrentMonthMileage { get; set; }
    public Dictionary<string, WorkTypeStatsDto> IncomeBySource { get; set; } = new();
    public List<DailyIncomeDto> DailyIncomeData { get; set; } = new();
}

public class WorkTypeStatsDto
{
    public decimal Income { get; set; }
    public int Routes { get; set; }
    public double TotalWorkingHours { get; set; }
    public double TotalMileage { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal EarningsPerMile { get; set; }
    public Dictionary<string, decimal> IncomeBySource { get; set; } = new();
}

public class DailyIncomeDto
{
    public string Date { get; set; } = null!;
    public decimal Income { get; set; }
}