using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.Models;
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
            var startOfMonth = new DateTime(now.Year, now.Month, 1);
            
            // Calculate stats from routes
            var last7DaysRoutes = allRoutes.Where(r => r.ScheduleStart >= startOfWeek).ToList();
            var currentMonthRoutes = allRoutes.Where(r => r.ScheduleStart >= startOfMonth).ToList();
            var completedRoutes = allRoutes.Where(r => r.Status == "completed").ToList();
            
            var last7DaysIncome = last7DaysRoutes.Sum(r => r.TotalIncome);
            var currentMonthIncome = currentMonthRoutes.Sum(r => r.TotalIncome);
            
            // Calculate income by work type from current month's routes
            var incomeBySource = currentMonthRoutes
                .Where(r => r.Status == "completed")
                .GroupBy(r => r.WorkType ?? "Other")
                .ToDictionary(
                    g => g.Key, 
                    g => g.Sum(r => r.TotalIncome)
                );

            // Generate daily income data for the last 7 days
            var dailyIncomeData = new List<object>();
            for (int i = 6; i >= 0; i--)
            {
                var day = now.AddDays(-i);
                var dayStart = day.Date;
                var dayEnd = dayStart.AddDays(1);
                
                var dayIncome = allRoutes
                    .Where(r => r.ScheduleStart >= dayStart && r.ScheduleStart < dayEnd && r.Status == "completed")
                    .Sum(r => r.TotalIncome);
                
                dailyIncomeData.Add(new
                {
                    date = dayStart.ToString("yyyy-MM-dd"),
                    income = dayIncome
                });
            }

            var stats = new
            {
                last7DaysIncome,
                currentMonthIncome,
                netIncome = currentMonthIncome, // For now, same as gross income
                incomeBySource,
                dailyIncomeData
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
}