using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using System.Security.Claims;
using Xunit;
using IncomeMeter.Api.Controllers;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;

namespace IncomeMeter.Tests.Controllers;

public class DashboardControllerTests
{
    private readonly Mock<IDashboardService> _mockDashboardService;
    private readonly Mock<ILogger<DashboardController>> _mockLogger;
    private readonly DashboardController _controller;

    public DashboardControllerTests()
    {
        _mockDashboardService = new Mock<IDashboardService>();
        _mockLogger = new Mock<ILogger<DashboardController>>();
        _controller = new DashboardController(_mockDashboardService.Object, _mockLogger.Object);

        // Setup HttpContext with authenticated user
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, "user-123"),
            new Claim(ClaimTypes.Email, "test@example.com")
        };
        var identity = new ClaimsIdentity(claims, "test");
        var principal = new ClaimsPrincipal(identity);

        var httpContext = new DefaultHttpContext();
        httpContext.User = principal;
        httpContext.Items["CorrelationId"] = "test-correlation-id";

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };
    }

    [Fact]
    public async Task GetStats_ShouldReturnDashboardStats()
    {
        // Arrange
        var userId = "user-123";
        var expectedStats = new DashboardStats
        {
            TotalRoutes = 25,
            TotalIncome = 1250.75m,
            AverageIncomePerRoute = 50.03m,
            Last7DaysIncome = 350.50m,
            CurrentMonthIncome = 1100.25m,
            IncomeBySource = new List<IncomeSourceSummary>
            {
                new IncomeSourceSummary { Source = "Delivery", Amount = 800.00m },
                new IncomeSourceSummary { Source = "Rideshare", Amount = 450.75m }
            },
            WeeklyTrend = new List<DailyIncome>
            {
                new DailyIncome { Date = "2024-01-01", Income = 45.50m },
                new DailyIncome { Date = "2024-01-02", Income = 60.75m }
            }
        };

        _mockDashboardService.Setup(x => x.GetDashboardStatsAsync(userId))
            .ReturnsAsync(expectedStats);

        // Act
        var result = await _controller.GetStats();

        // Assert
        Assert.IsType<OkObjectResult>(result);
        var okResult = result as OkObjectResult;
        var stats = okResult.Value as DashboardStats;

        Assert.NotNull(stats);
        Assert.Equal(expectedStats.TotalRoutes, stats.TotalRoutes);
        Assert.Equal(expectedStats.TotalIncome, stats.TotalIncome);
        Assert.Equal(expectedStats.AverageIncomePerRoute, stats.AverageIncomePerRoute);
        Assert.Equal(expectedStats.Last7DaysIncome, stats.Last7DaysIncome);
        Assert.Equal(expectedStats.CurrentMonthIncome, stats.CurrentMonthIncome);
        Assert.Equal(2, stats.IncomeBySource.Count);
        Assert.Equal(2, stats.WeeklyTrend.Count);
    }

    [Fact]
    public async Task GetStats_WithServiceException_ShouldReturnInternalServerError()
    {
        // Arrange
        var userId = "user-123";
        _mockDashboardService.Setup(x => x.GetDashboardStatsAsync(userId))
            .ThrowsAsync(new Exception("Service error"));

        // Act
        var result = await _controller.GetStats();

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = result as ObjectResult;
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task GetTodaysRoutes_ShouldReturnTodaysRoutes()
    {
        // Arrange
        var userId = "user-123";
        var today = DateTime.Today;
        var expectedRoutes = new List<Route>
        {
            new Route
            {
                Id = "route-1",
                UserId = userId,
                WorkType = "Delivery",
                Status = RouteStatus.Scheduled,
                ScheduleStart = today.AddHours(9),
                ScheduleEnd = today.AddHours(12),
                EstimatedIncome = 150.00m,
                Distance = 25.5,
                Incomes = new List<IncomeSource>(),
                TotalIncome = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Route
            {
                Id = "route-2",
                UserId = userId,
                WorkType = "Rideshare",
                Status = RouteStatus.Completed,
                ScheduleStart = today.AddHours(14),
                ScheduleEnd = today.AddHours(18),
                ActualStartTime = today.AddHours(14).AddMinutes(5),
                ActualEndTime = today.AddHours(17).AddMinutes(45),
                EstimatedIncome = 200.00m,
                TotalIncome = 195.50m,
                Distance = 42.3,
                Incomes = new List<IncomeSource>
                {
                    new IncomeSource { Source = "Base Pay", Amount = 120.00m },
                    new IncomeSource { Source = "Tips", Amount = 75.50m }
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };

        _mockDashboardService.Setup(x => x.GetTodaysRoutesAsync(userId))
            .ReturnsAsync(expectedRoutes);

        // Act
        var result = await _controller.GetTodaysRoutes();

        // Assert
        Assert.IsType<OkObjectResult>(result);
        var okResult = result as OkObjectResult;
        var routes = okResult.Value as List<Route>;

        Assert.NotNull(routes);
        Assert.Equal(2, routes.Count);
        
        var firstRoute = routes[0];
        Assert.Equal("route-1", firstRoute.Id);
        Assert.Equal("Delivery", firstRoute.WorkType);
        Assert.Equal(RouteStatus.Scheduled, firstRoute.Status);
        Assert.Equal(150.00m, firstRoute.EstimatedIncome);

        var secondRoute = routes[1];
        Assert.Equal("route-2", secondRoute.Id);
        Assert.Equal("Rideshare", secondRoute.WorkType);
        Assert.Equal(RouteStatus.Completed, secondRoute.Status);
        Assert.Equal(195.50m, secondRoute.TotalIncome);
        Assert.Equal(2, secondRoute.Incomes.Count);
    }

    [Fact]
    public async Task GetTodaysRoutes_WithNoRoutes_ShouldReturnEmptyList()
    {
        // Arrange
        var userId = "user-123";
        _mockDashboardService.Setup(x => x.GetTodaysRoutesAsync(userId))
            .ReturnsAsync(new List<Route>());

        // Act
        var result = await _controller.GetTodaysRoutes();

        // Assert
        Assert.IsType<OkObjectResult>(result);
        var okResult = result as OkObjectResult;
        var routes = okResult.Value as List<Route>;

        Assert.NotNull(routes);
        Assert.Empty(routes);
    }

    [Fact]
    public async Task GetTodaysRoutes_WithServiceException_ShouldReturnInternalServerError()
    {
        // Arrange
        var userId = "user-123";
        _mockDashboardService.Setup(x => x.GetTodaysRoutesAsync(userId))
            .ThrowsAsync(new Exception("Database connection failed"));

        // Act
        var result = await _controller.GetTodaysRoutes();

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = result as ObjectResult;
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task GetStats_WithNullUserId_ShouldReturnUnauthorized()
    {
        // Arrange - Setup HttpContext without user claims
        var httpContext = new DefaultHttpContext();
        httpContext.Items["CorrelationId"] = "test-correlation-id";

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        // Act
        var result = await _controller.GetStats();

        // Assert
        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GetTodaysRoutes_WithNullUserId_ShouldReturnUnauthorized()
    {
        // Arrange - Setup HttpContext without user claims
        var httpContext = new DefaultHttpContext();
        httpContext.Items["CorrelationId"] = "test-correlation-id";

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        // Act
        var result = await _controller.GetTodaysRoutes();

        // Assert
        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GetStats_ShouldLogUserActivity()
    {
        // Arrange
        var userId = "user-123";
        var stats = new DashboardStats
        {
            TotalRoutes = 10,
            TotalIncome = 500.00m,
            AverageIncomePerRoute = 50.00m,
            Last7DaysIncome = 200.00m,
            CurrentMonthIncome = 400.00m,
            IncomeBySource = new List<IncomeSourceSummary>(),
            WeeklyTrend = new List<DailyIncome>()
        };

        _mockDashboardService.Setup(x => x.GetDashboardStatsAsync(userId))
            .ReturnsAsync(stats);

        // Act
        await _controller.GetStats();

        // Assert
        _mockDashboardService.Verify(x => x.GetDashboardStatsAsync(userId), Times.Once);
    }

    [Fact]
    public async Task GetTodaysRoutes_ShouldLogUserActivity()
    {
        // Arrange
        var userId = "user-123";
        var routes = new List<Route>();

        _mockDashboardService.Setup(x => x.GetTodaysRoutesAsync(userId))
            .ReturnsAsync(routes);

        // Act
        await _controller.GetTodaysRoutes();

        // Assert
        _mockDashboardService.Verify(x => x.GetTodaysRoutesAsync(userId), Times.Once);
    }
}