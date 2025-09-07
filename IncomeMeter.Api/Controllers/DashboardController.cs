using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Middleware;
using System.Security.Claims;
using Serilog;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class DashboardController : ControllerBase
{
    private readonly IRouteService _routeService;
    private readonly ITransactionService _transactionService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(IRouteService routeService, ITransactionService transactionService, ILogger<DashboardController> logger)
    {
        _routeService = routeService;
        _transactionService = transactionService;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet("stats")]
    [RequireScopes("read:dashboard")]
    public async Task<IActionResult> GetDashboardStats()
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "DashboardStatsRequested")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .Information("User requested dashboard statistics");

        try
        {
            // Get all user routes
            var allRoutes = await _routeService.GetRoutesByUserIdAsync(userId);
            
            var now = DateTime.UtcNow;
            var startOfWeek = now.AddDays(-7);
            var startOfPreviousWeek = now.AddDays(-14);
            var startOfMonth = new DateTime(now.Year, now.Month, 1);
            
            // Calculate stats from routes
            var last7DaysRoutes = allRoutes.Where(r => r.ScheduleStart >= startOfWeek).ToList();
            var previous7DaysRoutes = allRoutes.Where(r => r.ScheduleStart >= startOfPreviousWeek && r.ScheduleStart < startOfWeek).ToList();
            var currentMonthRoutes = allRoutes.Where(r => r.ScheduleStart >= startOfMonth).ToList();
            var completedRoutes = allRoutes.Where(r => r.Status == "completed").ToList();
            
            var last7DaysIncome = last7DaysRoutes.Where(r => r.Status == "completed").Sum(r => r.TotalIncome);
            var previous7DaysIncome = previous7DaysRoutes.Where(r => r.Status == "completed").Sum(r => r.TotalIncome);
            var currentMonthIncome = currentMonthRoutes.Where(r => r.Status == "completed").Sum(r => r.TotalIncome);
            
            var last7DaysMileage = last7DaysRoutes.Where(r => r.Status == "completed").Sum(r => r.Distance);
            var currentMonthMileage = currentMonthRoutes.Where(r => r.Status == "completed").Sum(r => r.Distance);
            
            // Calculate income, scheduled time, and mileage by work type from current month's routes
            var incomeBySource = currentMonthRoutes
                .Where(r => r.Status == "completed")
                .GroupBy(r => r.WorkType ?? "Other")
                .ToDictionary(
                    g => g.Key, 
                    g => new WorkTypeStatsDto
                    {
                        Income = g.Sum(r => r.TotalIncome),
                        Routes = g.Count(),
                        TotalWorkingHours = g.Sum(r => (r.ScheduleEnd - r.ScheduleStart).TotalHours),
                        TotalMileage = g.Sum(r => r.Distance),
                        HourlyRate = g.Sum(r => (r.ScheduleEnd - r.ScheduleStart).TotalHours) > 0 
                            ? g.Sum(r => r.TotalIncome) / (decimal)g.Sum(r => (r.ScheduleEnd - r.ScheduleStart).TotalHours) 
                            : 0,
                        EarningsPerMile = g.Sum(r => r.Distance) > 0 
                            ? g.Sum(r => r.TotalIncome) / (decimal)g.Sum(r => r.Distance) 
                            : 0
                    }
                );

            // Generate daily income data for the last 7 days
            var dailyIncomeData = new List<DailyIncomeDto>();
            for (int i = 6; i >= 0; i--)
            {
                var day = now.AddDays(-i);
                var dayStart = day.Date;
                var dayEnd = dayStart.AddDays(1);
                
                var dayIncome = allRoutes
                    .Where(r => r.ScheduleStart >= dayStart && r.ScheduleStart < dayEnd && r.Status == "completed")
                    .Sum(r => r.TotalIncome);
                
                dailyIncomeData.Add(new DailyIncomeDto
                {
                    Date = dayStart.ToString("yyyy-MM-dd"),
                    Income = dayIncome
                });
            }

            var stats = new DashboardStatsDto
            {
                Last7DaysIncome = last7DaysIncome,
                Previous7DaysIncome = previous7DaysIncome,
                CurrentMonthIncome = currentMonthIncome,
                NetIncome = currentMonthIncome, // For now, same as gross income
                Last7DaysMileage = last7DaysMileage,
                CurrentMonthMileage = currentMonthMileage,
                IncomeBySource = incomeBySource,
                DailyIncomeData = dailyIncomeData
            };

            Log.Logger
                .ForContext("EventType", "DashboardStatsCalculated")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("Last7DaysIncome", last7DaysIncome)
                .ForContext("CurrentMonthIncome", currentMonthIncome)
                .ForContext("IncomeSourcesCount", incomeBySource.Count)
                .ForContext("TotalRoutesAnalyzed", allRoutes.Count())
                .ForContext("CompletedRoutesCount", completedRoutes.Count)
                .Information("Dashboard statistics calculated successfully");

            return Ok(stats);
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "DashboardStatsError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Error(ex, "Failed to calculate dashboard statistics");
                
            return StatusCode(500, new { error = "Failed to fetch dashboard stats", details = ex.Message });
        }
    }

    [HttpGet("todays-routes")]
    [RequireScopes("read:dashboard")]
    public async Task<IActionResult> GetTodaysRoutes()
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "TodaysRoutesRequested")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .Information("User requested today's routes");

        try
        {
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);

            var allRoutes = await _routeService.GetRoutesByUserIdAsync(userId);
            
            var todaysRoutes = allRoutes
                .Where(r => r.ScheduleStart >= today && r.ScheduleStart < tomorrow)
                .OrderBy(r => r.ScheduleStart)
                .Take(10) // Limit to reasonable number
                .ToList();

            Log.Logger
                .ForContext("EventType", "TodaysRoutesRetrieved")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("TodaysRoutesCount", todaysRoutes.Count)
                .ForContext("Date", today.ToString("yyyy-MM-dd"))
                .Information("Today's routes retrieved successfully");

            return Ok(todaysRoutes);
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "TodaysRoutesError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Error(ex, "Failed to retrieve today's routes");
                
            return StatusCode(500, new { error = "Failed to fetch today's routes", details = ex.Message });
        }
    }

    [HttpPost("period-stats")]
    [RequireScopes("read:dashboard")]
    public async Task<IActionResult> GetPeriodStats([FromBody] PeriodIncomeRequestDto request)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "PeriodStatsRequested")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("Period", request.Period)
            .ForContext("Offset", request.Offset)
            .Information("User requested period-based statistics");

        try
        {
            // Default fiscal start date if not provided
            var fiscalStartDate = request.FiscalStartDate ?? "04-06"; // UK default
            var baseDate = DateTime.UtcNow;
            
            // Get all user routes
            var allRoutes = await _routeService.GetRoutesByUserIdAsync(userId);
            var completedRoutes = allRoutes.Where(r => r.Status == "completed").ToList();

            PeriodIncomeResponseDto response = request.Period.ToLower() switch
            {
                "weekly" => await GenerateWeeklyStatsAsync(completedRoutes, request.Offset, fiscalStartDate, baseDate),
                "monthly" => await GenerateMonthlyStatsAsync(completedRoutes, request.Offset, fiscalStartDate, baseDate),
                "annual" => await GenerateAnnualStatsAsync(completedRoutes, request.Offset, fiscalStartDate, baseDate),
                _ => throw new ArgumentException($"Unsupported period type: {request.Period}")
            };

            Log.Logger
                .ForContext("EventType", "PeriodStatsCalculated")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("Period", request.Period)
                .ForContext("TotalIncome", response.TotalIncome)
                .ForContext("CompletedRoutes", response.CompletedRoutes)
                .Information("Period statistics calculated successfully");

            return Ok(response);
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "PeriodStatsError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("Period", request.Period)
                .Error(ex, "Failed to calculate period statistics");
                
            return StatusCode(500, new { error = "Failed to fetch period stats", details = ex.Message });
        }
    }

    private async Task<WeeklyIncomeResponseDto> GenerateWeeklyStatsAsync(
        List<IncomeMeter.Api.Models.Route> routes, int offset, string fiscalStartDate, DateTime baseDate)
    {
        // Calculate target date with offset
        var targetDate = baseDate.AddDays(offset * 7);
        
        // Parse fiscal start date
        var fiscalParts = fiscalStartDate.Split('-');
        var fiscalMonth = int.Parse(fiscalParts[0]) - 1; // 0-based for DateTime
        var fiscalDay = int.Parse(fiscalParts[1]);
        
        // Get fiscal year info
        var fiscalYear = targetDate.Month > fiscalMonth || 
                        (targetDate.Month == fiscalMonth + 1 && targetDate.Day >= fiscalDay)
                        ? targetDate.Year 
                        : targetDate.Year - 1;
        
        var fiscalYearStart = new DateTime(fiscalYear, fiscalMonth + 1, fiscalDay);
        
        // Calculate week number (1-based)
        var daysSinceFiscalStart = (targetDate - fiscalYearStart).Days;
        var weekNumber = Math.Max(1, (daysSinceFiscalStart / 7) + 1);
        
        // Get start of week (Monday)
        var dayOfWeek = (int)targetDate.DayOfWeek;
        var daysToSubtract = dayOfWeek == 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
        var weekStart = targetDate.Date.AddDays(-daysToSubtract);
        var weekEnd = weekStart.AddDays(7).AddTicks(-1);
        
        // Filter routes for this week
        var weekRoutes = routes.Where(r => 
            r.ScheduleStart >= weekStart && r.ScheduleStart <= weekEnd).ToList();
        
        // Generate daily chart data (Monday to Sunday)
        var chartData = new List<PeriodChartDataDto>();
        for (int i = 0; i < 7; i++)
        {
            var day = weekStart.AddDays(i);
            var dayEnd = day.AddDays(1).AddTicks(-1);
            var dayRoutes = weekRoutes.Where(r => 
                r.ScheduleStart >= day && r.ScheduleStart <= dayEnd).ToList();
            
            var dayName = day.ToString("ddd"); // Mon, Tue, Wed, etc.
            
            chartData.Add(new PeriodChartDataDto
            {
                Label = dayName,
                Date = day,
                Income = dayRoutes.Sum(r => r.TotalIncome),
                Routes = dayRoutes.Count,
                Distance = dayRoutes.Sum(r => r.Distance)
            });
        }
        
        // Calculate totals
        var totalIncome = weekRoutes.Sum(r => r.TotalIncome);
        var incomeBySource = CalculateWorkTypeStats(weekRoutes);
        
        return new WeeklyIncomeResponseDto
        {
            Period = "weekly",
            StartDate = weekStart,
            EndDate = weekEnd,
            TotalIncome = totalIncome,
            CompletedRoutes = weekRoutes.Count,
            TotalDistance = weekRoutes.Sum(r => r.Distance),
            IncomeBySource = incomeBySource,
            ChartData = chartData,
            WeekNumber = weekNumber,
            FiscalYear = fiscalYear,
            Navigation = new PeriodNavigationDto
            {
                CurrentPeriodDisplay = $"Week {weekNumber}, {fiscalYear}",
                PreviousPeriodDisplay = $"Week {weekNumber - 1}, {fiscalYear}",
                NextPeriodDisplay = $"Week {weekNumber + 1}, {fiscalYear}",
                CanGoPrevious = true,
                CanGoNext = DateTime.UtcNow.Date > weekEnd.Date
            }
        };
    }

    private async Task<MonthlyIncomeResponseDto> GenerateMonthlyStatsAsync(
        List<IncomeMeter.Api.Models.Route> routes, int offset, string fiscalStartDate, DateTime baseDate)
    {
        var targetDate = baseDate.AddMonths(offset);
        var monthStart = new DateTime(targetDate.Year, targetDate.Month, 1);
        var monthEnd = monthStart.AddMonths(1).AddTicks(-1);
        
        // Filter routes for this month
        var monthRoutes = routes.Where(r => 
            r.ScheduleStart >= monthStart && r.ScheduleStart <= monthEnd).ToList();
        
        // Parse fiscal start date for week calculations
        var fiscalParts = fiscalStartDate.Split('-');
        var fiscalMonth = int.Parse(fiscalParts[0]) - 1;
        var fiscalDay = int.Parse(fiscalParts[1]);
        
        // Generate weekly chart data for the month
        var chartData = new List<PeriodChartDataDto>();
        var weeksInMonth = new List<WeekInMonthDto>();
        
        var currentWeekStart = monthStart;
        var weekNumber = 1;
        
        while (currentWeekStart.Month == targetDate.Month)
        {
            // Adjust to Monday
            var dayOfWeek = (int)currentWeekStart.DayOfWeek;
            var daysToSubtract = dayOfWeek == 0 ? 6 : dayOfWeek - 1;
            var weekStart = currentWeekStart.AddDays(-daysToSubtract);
            var weekEnd = weekStart.AddDays(7).AddTicks(-1);
            
            // Ensure week overlaps with month
            if (weekEnd >= monthStart && weekStart <= monthEnd)
            {
                var weekRoutes = monthRoutes.Where(r => 
                    r.ScheduleStart >= weekStart && r.ScheduleStart <= weekEnd).ToList();
                
                var weekIncome = weekRoutes.Sum(r => r.TotalIncome);
                var isPartialWeek = weekStart < monthStart || weekEnd > monthEnd;
                
                chartData.Add(new PeriodChartDataDto
                {
                    Label = $"Week {weekNumber}",
                    Date = weekStart,
                    Income = weekIncome,
                    Routes = weekRoutes.Count,
                    Distance = weekRoutes.Sum(r => r.Distance)
                });
                
                weeksInMonth.Add(new WeekInMonthDto
                {
                    WeekNumber = weekNumber,
                    WeekStartDate = weekStart,
                    WeekEndDate = weekEnd,
                    Income = weekIncome,
                    IsPartialWeek = isPartialWeek
                });
            }
            
            currentWeekStart = currentWeekStart.AddDays(7);
            weekNumber++;
        }
        
        var totalIncome = monthRoutes.Sum(r => r.TotalIncome);
        var incomeBySource = CalculateWorkTypeStats(monthRoutes);
        
        return new MonthlyIncomeResponseDto
        {
            Period = "monthly",
            StartDate = monthStart,
            EndDate = monthEnd,
            TotalIncome = totalIncome,
            CompletedRoutes = monthRoutes.Count,
            TotalDistance = monthRoutes.Sum(r => r.Distance),
            IncomeBySource = incomeBySource,
            ChartData = chartData,
            Month = targetDate.Month,
            Year = targetDate.Year,
            WeeksInMonth = weeksInMonth,
            Navigation = new PeriodNavigationDto
            {
                CurrentPeriodDisplay = targetDate.ToString("MMMM yyyy"),
                PreviousPeriodDisplay = targetDate.AddMonths(-1).ToString("MMMM yyyy"),
                NextPeriodDisplay = targetDate.AddMonths(1).ToString("MMMM yyyy"),
                CanGoPrevious = true,
                CanGoNext = DateTime.UtcNow.Date > monthEnd.Date
            }
        };
    }

    private async Task<AnnualIncomeResponseDto> GenerateAnnualStatsAsync(
        List<IncomeMeter.Api.Models.Route> routes, int offset, string fiscalStartDate, DateTime baseDate)
    {
        // Parse fiscal start date
        var fiscalParts = fiscalStartDate.Split('-');
        var fiscalMonth = int.Parse(fiscalParts[0]) - 1; // 0-based for DateTime
        var fiscalDay = int.Parse(fiscalParts[1]);
        
        // Calculate fiscal year
        var currentFiscalYear = baseDate.Month > fiscalMonth || 
                              (baseDate.Month == fiscalMonth + 1 && baseDate.Day >= fiscalDay)
                              ? baseDate.Year 
                              : baseDate.Year - 1;
        
        var targetFiscalYear = currentFiscalYear + offset;
        var fiscalYearStart = new DateTime(targetFiscalYear, fiscalMonth + 1, fiscalDay);
        var fiscalYearEnd = fiscalYearStart.AddYears(1).AddTicks(-1);
        
        // Filter routes for this fiscal year
        var yearRoutes = routes.Where(r => 
            r.ScheduleStart >= fiscalYearStart && r.ScheduleStart <= fiscalYearEnd).ToList();
        
        // Generate monthly chart data for the fiscal year
        var chartData = new List<PeriodChartDataDto>();
        var monthsInFiscalYear = new List<MonthInFiscalYearDto>();
        
        for (int i = 0; i < 12; i++)
        {
            var monthStart = fiscalYearStart.AddMonths(i);
            var monthEnd = monthStart.AddMonths(1).AddTicks(-1);
            
            var monthRoutes = yearRoutes.Where(r => 
                r.ScheduleStart >= monthStart && r.ScheduleStart <= monthEnd).ToList();
            
            var monthIncome = monthRoutes.Sum(r => r.TotalIncome);
            var monthName = monthStart.ToString("MMM");
            
            chartData.Add(new PeriodChartDataDto
            {
                Label = monthName,
                Date = monthStart,
                Income = monthIncome,
                Routes = monthRoutes.Count,
                Distance = monthRoutes.Sum(r => r.Distance)
            });
            
            monthsInFiscalYear.Add(new MonthInFiscalYearDto
            {
                Month = monthStart.Month,
                Year = monthStart.Year,
                MonthName = monthName,
                Income = monthIncome,
                Routes = monthRoutes.Count
            });
        }
        
        var totalIncome = yearRoutes.Sum(r => r.TotalIncome);
        var incomeBySource = CalculateWorkTypeStats(yearRoutes);
        
        return new AnnualIncomeResponseDto
        {
            Period = "annual",
            StartDate = fiscalYearStart,
            EndDate = fiscalYearEnd,
            TotalIncome = totalIncome,
            CompletedRoutes = yearRoutes.Count,
            TotalDistance = yearRoutes.Sum(r => r.Distance),
            IncomeBySource = incomeBySource,
            ChartData = chartData,
            FiscalYear = targetFiscalYear,
            MonthsInFiscalYear = monthsInFiscalYear,
            Navigation = new PeriodNavigationDto
            {
                CurrentPeriodDisplay = $"FY {targetFiscalYear}-{targetFiscalYear + 1}",
                PreviousPeriodDisplay = $"FY {targetFiscalYear - 1}-{targetFiscalYear}",
                NextPeriodDisplay = $"FY {targetFiscalYear + 1}-{targetFiscalYear + 2}",
                CanGoPrevious = true,
                CanGoNext = DateTime.UtcNow.Date > fiscalYearEnd.Date
            }
        };
    }

    private static Dictionary<string, WorkTypeStatsDto> CalculateWorkTypeStats(List<IncomeMeter.Api.Models.Route> routes)
    {
        return routes.GroupBy(r => r.WorkType ?? "Other")
            .ToDictionary(g => g.Key, g =>
            {
                var groupRoutes = g.ToList();
                var totalIncome = groupRoutes.Sum(r => r.TotalIncome);
                var totalDistance = groupRoutes.Sum(r => r.Distance);
                
                // Calculate total working hours
                var totalWorkingHours = groupRoutes
                    .Where(r => r.ActualStartTime.HasValue && r.ActualEndTime.HasValue)
                    .Sum(r => (r.ActualEndTime!.Value - r.ActualStartTime!.Value).TotalHours);
                
                // If no actual times, use scheduled times as fallback
                if (totalWorkingHours == 0)
                {
                    totalWorkingHours = groupRoutes
                        .Sum(r => (r.ScheduleEnd - r.ScheduleStart).TotalHours);
                }

                // Calculate income by source for this work type
                var incomeBySource = new Dictionary<string, decimal>();
                foreach (var route in groupRoutes)
                {
                    foreach (var incomeItem in route.Incomes)
                    {
                        var sourceName = incomeItem.Source ?? "Other";
                        incomeBySource[sourceName] = incomeBySource.GetValueOrDefault(sourceName, 0) + incomeItem.Amount;
                    }
                }

                return new WorkTypeStatsDto
                {
                    Income = totalIncome,
                    Routes = groupRoutes.Count,
                    TotalWorkingHours = totalWorkingHours,
                    TotalMileage = totalDistance,
                    HourlyRate = totalWorkingHours > 0 ? totalIncome / (decimal)totalWorkingHours : 0,
                    EarningsPerMile = totalDistance > 0 ? totalIncome / (decimal)totalDistance : 0,
                    IncomeBySource = incomeBySource
                };
            });
    }
}