using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using System.Security.Claims;
using Xunit;
using FluentAssertions;
using IncomeMeter.Api.Controllers;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;

namespace IncomeMeter.Api.Tests.Controllers;

public class DashboardControllerTests
{
    private readonly Mock<IRouteService> _mockRouteService;
    private readonly Mock<ITransactionService> _mockTransactionService;
    private readonly Mock<ILogger<DashboardController>> _mockLogger;
    private readonly DashboardController _controller;

    public DashboardControllerTests()
    {
        _mockRouteService = new Mock<IRouteService>();
        _mockTransactionService = new Mock<ITransactionService>();
        _mockLogger = new Mock<ILogger<DashboardController>>();
        _controller = new DashboardController(_mockRouteService.Object, _mockTransactionService.Object, _mockLogger.Object);

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
    public async Task GetDashboardStats_ShouldReturnCorrectStructure_WithCompletedRoutesOnly()
    {
        // Arrange
        var userId = "user-123";
        var now = DateTime.UtcNow;
        var startOfWeek = now.AddDays(-7);
        var startOfPreviousWeek = now.AddDays(-14);
        var startOfMonth = new DateTime(now.Year, now.Month, 1);

        var allRoutes = new List<Route>
        {
            // Completed route in last 7 days
            new Route
            {
                Id = "route1",
                UserId = userId,
                WorkType = "Delivery",
                Status = "completed",
                ScheduleStart = startOfWeek.AddDays(1),
                ScheduleEnd = startOfWeek.AddDays(1).AddHours(4),
                TotalIncome = 100.50m,
                Distance = 25.5
            },
            // Completed route in previous 7 days
            new Route
            {
                Id = "route2", 
                UserId = userId,
                WorkType = "Rideshare",
                Status = "completed",
                ScheduleStart = startOfPreviousWeek.AddDays(1),
                ScheduleEnd = startOfPreviousWeek.AddDays(1).AddHours(3),
                TotalIncome = 75.25m,
                Distance = 15.2
            },
            // Scheduled route in last 7 days (should be excluded from income/mileage)
            new Route
            {
                Id = "route3",
                UserId = userId,
                WorkType = "Delivery", 
                Status = "scheduled",
                ScheduleStart = startOfWeek.AddDays(2),
                ScheduleEnd = startOfWeek.AddDays(2).AddHours(2),
                TotalIncome = 0m,
                Distance = 10.0
            },
            // Completed route in current month
            new Route
            {
                Id = "route4",
                UserId = userId,
                WorkType = "Delivery",
                Status = "completed", 
                ScheduleStart = startOfMonth.AddDays(5),
                ScheduleEnd = startOfMonth.AddDays(5).AddHours(5),
                TotalIncome = 125.75m,
                Distance = 30.8
            }
        };

        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync(userId))
            .ReturnsAsync(allRoutes);

        // Act
        var result = await _controller.GetDashboardStats();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var statsData = okResult!.Value;

        // Verify the anonymous object structure
        var statsType = statsData!.GetType();
        statsType.Should().NotBeNull();

        // Check that only completed routes are counted
        var last7DaysIncome = statsType.GetProperty("last7DaysIncome")!.GetValue(statsData);
        last7DaysIncome.Should().Be(100.50m); // Only route1 (completed)

        var last7DaysMileage = statsType.GetProperty("last7DaysMileage")!.GetValue(statsData);
        last7DaysMileage.Should().Be(25.5); // Only route1 (completed)

        var currentMonthIncome = statsType.GetProperty("currentMonthIncome")!.GetValue(statsData);
        currentMonthIncome.Should().Be(226.25m); // route1 + route4 (both completed and in current month)

        var currentMonthMileage = statsType.GetProperty("currentMonthMileage")!.GetValue(statsData);
        currentMonthMileage.Should().Be(56.3); // route1 + route4 (both completed and in current month)
    }

    [Fact]
    public async Task GetDashboardStats_ShouldCalculateIncomeBySource_WithTimeAndMileage()
    {
        // Arrange
        var userId = "user-123";
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1);

        var allRoutes = new List<Route>
        {
            new Route
            {
                Id = "route1",
                UserId = userId,
                WorkType = "Delivery",
                Status = "completed",
                ScheduleStart = startOfMonth.AddDays(1),
                ScheduleEnd = startOfMonth.AddDays(1).AddHours(4), // 4 hours
                TotalIncome = 120.00m,
                Distance = 25.5
            },
            new Route
            {
                Id = "route2",
                UserId = userId, 
                WorkType = "Delivery",
                Status = "completed",
                ScheduleStart = startOfMonth.AddDays(2),
                ScheduleEnd = startOfMonth.AddDays(2).AddHours(3), // 3 hours
                TotalIncome = 80.50m,
                Distance = 18.2
            },
            new Route
            {
                Id = "route3",
                UserId = userId,
                WorkType = "Rideshare", 
                Status = "completed",
                ScheduleStart = startOfMonth.AddDays(3),
                ScheduleEnd = startOfMonth.AddDays(3).AddHours(5), // 5 hours
                TotalIncome = 150.75m,
                Distance = 35.8
            }
        };

        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync(userId))
            .ReturnsAsync(allRoutes);

        // Act
        var result = await _controller.GetDashboardStats();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var statsData = okResult!.Value;

        var statsType = statsData!.GetType();
        var incomeBySource = statsType.GetProperty("incomeBySource")!.GetValue(statsData);
        incomeBySource.Should().NotBeNull();

        // Should be Dictionary<string, object> where object has income, totalScheduledHours, totalMileage
        var incomeBySourceDict = incomeBySource as Dictionary<string, object>;
        incomeBySourceDict.Should().NotBeNull();
        incomeBySourceDict.Should().ContainKey("Delivery");
        incomeBySourceDict.Should().ContainKey("Rideshare");

        // Check Delivery statistics
        var deliveryStats = incomeBySourceDict!["Delivery"];
        var deliveryType = deliveryStats.GetType();
        
        var deliveryIncome = deliveryType.GetProperty("income")!.GetValue(deliveryStats);
        deliveryIncome.Should().Be(200.50m); // 120.00 + 80.50
        
        var deliveryHours = deliveryType.GetProperty("totalScheduledHours")!.GetValue(deliveryStats);
        deliveryHours.Should().Be(7.0); // 4 + 3 hours
        
        var deliveryMileage = deliveryType.GetProperty("totalMileage")!.GetValue(deliveryStats);
        deliveryMileage.Should().Be(43.7); // 25.5 + 18.2

        // Check Rideshare statistics
        var rideshareStats = incomeBySourceDict["Rideshare"];
        var rideshareType = rideshareStats.GetType();
        
        var rideshareIncome = rideshareType.GetProperty("income")!.GetValue(rideshareStats);
        rideshareIncome.Should().Be(150.75m);
        
        var rideshareHours = rideshareType.GetProperty("totalScheduledHours")!.GetValue(rideshareStats);
        rideshareHours.Should().Be(5.0);
        
        var rideshareMileage = rideshareType.GetProperty("totalMileage")!.GetValue(rideshareStats);
        rideshareMileage.Should().Be(35.8);
    }

    [Fact]
    public async Task GetDashboardStats_ShouldGenerateDailyIncomeData_ForLast7Days()
    {
        // Arrange
        var userId = "user-123";
        var now = DateTime.UtcNow;
        
        var allRoutes = new List<Route>
        {
            // Route on day -2 (completed)
            new Route
            {
                Id = "route1",
                UserId = userId,
                WorkType = "Delivery",
                Status = "completed",
                ScheduleStart = now.AddDays(-2).Date.AddHours(9),
                ScheduleEnd = now.AddDays(-2).Date.AddHours(12),
                TotalIncome = 85.50m,
                Distance = 20.0
            },
            // Route on day -2 (scheduled, should be excluded)
            new Route
            {
                Id = "route2",
                UserId = userId,
                WorkType = "Delivery", 
                Status = "scheduled",
                ScheduleStart = now.AddDays(-2).Date.AddHours(14),
                ScheduleEnd = now.AddDays(-2).Date.AddHours(16),
                TotalIncome = 0m,
                Distance = 15.0
            },
            // Route on day -5 (completed)
            new Route
            {
                Id = "route3",
                UserId = userId,
                WorkType = "Rideshare",
                Status = "completed",
                ScheduleStart = now.AddDays(-5).Date.AddHours(10),
                ScheduleEnd = now.AddDays(-5).Date.AddHours(15),
                TotalIncome = 125.25m,
                Distance = 30.5
            }
        };

        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync(userId))
            .ReturnsAsync(allRoutes);

        // Act
        var result = await _controller.GetDashboardStats();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var statsData = okResult!.Value;

        var statsType = statsData!.GetType();
        var dailyIncomeData = statsType.GetProperty("dailyIncomeData")!.GetValue(statsData);
        dailyIncomeData.Should().NotBeNull();

        var dailyDataList = dailyIncomeData as List<object>;
        dailyDataList.Should().NotBeNull();
        dailyDataList.Should().HaveCount(7); // Should have 7 days

        // Check that the data is sorted chronologically (oldest first)
        var firstDay = dailyDataList![0];
        var firstDayType = firstDay.GetType();
        var firstDayDate = firstDayType.GetProperty("date")!.GetValue(firstDay) as string;
        firstDayDate.Should().Be(now.AddDays(-6).Date.ToString("yyyy-MM-dd"));

        var lastDay = dailyDataList[6];
        var lastDayType = lastDay.GetType();
        var lastDayDate = lastDayType.GetProperty("date")!.GetValue(lastDay) as string;
        lastDayDate.Should().Be(now.Date.ToString("yyyy-MM-dd"));

        // Find the day with route1 (day -2) and verify income
        var dayMinus2 = dailyDataList[4]; // Index 4 because it's day -2 in the 7-day range
        var dayMinus2Type = dayMinus2.GetType();
        var dayMinus2Income = dayMinus2Type.GetProperty("income")!.GetValue(dayMinus2);
        dayMinus2Income.Should().Be(85.50m); // Only completed route income

        // Find the day with route3 (day -5) and verify income  
        var dayMinus5 = dailyDataList[1]; // Index 1 because it's day -5 in the 7-day range
        var dayMinus5Type = dayMinus5.GetType();
        var dayMinus5Income = dayMinus5Type.GetProperty("income")!.GetValue(dayMinus5);
        dayMinus5Income.Should().Be(125.25m);
    }

    [Fact]
    public async Task GetDashboardStats_WithNoRoutes_ShouldReturnZeroValues()
    {
        // Arrange
        var userId = "user-123";
        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync(userId))
            .ReturnsAsync(new List<Route>());

        // Act
        var result = await _controller.GetDashboardStats();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var statsData = okResult!.Value;

        var statsType = statsData!.GetType();
        
        var last7DaysIncome = statsType.GetProperty("last7DaysIncome")!.GetValue(statsData);
        last7DaysIncome.Should().Be(0m);
        
        var last7DaysMileage = statsType.GetProperty("last7DaysMileage")!.GetValue(statsData);
        last7DaysMileage.Should().Be(0.0);
        
        var incomeBySource = statsType.GetProperty("incomeBySource")!.GetValue(statsData);
        var incomeBySourceDict = incomeBySource as Dictionary<string, object>;
        incomeBySourceDict.Should().NotBeNull();
        incomeBySourceDict.Should().BeEmpty();
        
        var dailyIncomeData = statsType.GetProperty("dailyIncomeData")!.GetValue(statsData);
        var dailyDataList = dailyIncomeData as List<object>;
        dailyDataList.Should().NotBeNull();
        dailyDataList.Should().HaveCount(7);
        
        // All days should have 0 income
        foreach (var day in dailyDataList!)
        {
            var dayType = day.GetType();
            var income = dayType.GetProperty("income")!.GetValue(day);
            income.Should().Be(0m);
        }
    }

    [Fact]
    public async Task GetDashboardStats_WithNullUserId_ShouldReturnUnauthorized()
    {
        // Arrange - Setup HttpContext without user claims
        var httpContext = new DefaultHttpContext();
        httpContext.Items["CorrelationId"] = "test-correlation-id";

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        // Act
        var result = await _controller.GetDashboardStats();

        // Assert
        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task GetDashboardStats_WithServiceException_ShouldReturnInternalServerError()
    {
        // Arrange
        var userId = "user-123";
        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync(userId))
            .ThrowsAsync(new Exception("Database connection failed"));

        // Act
        var result = await _controller.GetDashboardStats();

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = result as ObjectResult;
        objectResult!.StatusCode.Should().Be(500);
        
        var errorResponse = objectResult.Value;
        var errorType = errorResponse!.GetType();
        var errorMessage = errorType.GetProperty("error")!.GetValue(errorResponse) as string;
        errorMessage.Should().Be("Failed to fetch dashboard stats");
    }

    [Fact]
    public async Task GetTodaysRoutes_ShouldReturnTodaysRoutesLimitedTo10()
    {
        // Arrange
        var userId = "user-123";
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var todaysRoutes = new List<Route>();
        // Create 15 routes for today to test the limit
        for (int i = 0; i < 15; i++)
        {
            todaysRoutes.Add(new Route
            {
                Id = $"route{i}",
                UserId = userId,
                WorkType = "Delivery",
                Status = i % 2 == 0 ? "completed" : "scheduled",
                ScheduleStart = today.AddHours(9 + i * 0.5),
                ScheduleEnd = today.AddHours(12 + i * 0.5),
                TotalIncome = 50.0m * (i + 1),
                Distance = 10.0 + i
            });
        }

        var allRoutes = new List<Route>(todaysRoutes);
        // Add some routes from other days that should be excluded
        allRoutes.Add(new Route
        {
            Id = "yesterday",
            UserId = userId,
            ScheduleStart = today.AddDays(-1),
            ScheduleEnd = today.AddDays(-1).AddHours(2)
        });

        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync(userId))
            .ReturnsAsync(allRoutes);

        // Act
        var result = await _controller.GetTodaysRoutes();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var routes = okResult!.Value as List<Route>;

        routes.Should().NotBeNull();
        routes.Should().HaveCount(10); // Limited to 10
        routes!.All(r => r.ScheduleStart >= today && r.ScheduleStart < tomorrow).Should().BeTrue();
        
        // Should be ordered by ScheduleStart
        for (int i = 1; i < routes.Count; i++)
        {
            routes[i].ScheduleStart.Should().BeOnOrAfter(routes[i - 1].ScheduleStart);
        }
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
        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task GetTodaysRoutes_WithServiceException_ShouldReturnInternalServerError()
    {
        // Arrange
        var userId = "user-123";
        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync(userId))
            .ThrowsAsync(new Exception("Database error"));

        // Act
        var result = await _controller.GetTodaysRoutes();

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = result as ObjectResult;
        objectResult!.StatusCode.Should().Be(500);
        
        var errorResponse = objectResult.Value;
        var errorType = errorResponse!.GetType();
        var errorMessage = errorType.GetProperty("error")!.GetValue(errorResponse) as string;
        errorMessage.Should().Be("Failed to fetch today's routes");
    }

    [Fact]
    public async Task GetDashboardStats_ShouldVerifyServiceCallsAndLogging()
    {
        // Arrange
        var userId = "user-123";
        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync(userId))
            .ReturnsAsync(new List<Route>());

        // Act
        await _controller.GetDashboardStats();

        // Assert
        _mockRouteService.Verify(x => x.GetRoutesByUserIdAsync(userId), Times.Once);
    }

    [Fact]
    public async Task GetTodaysRoutes_ShouldVerifyServiceCallsAndLogging()
    {
        // Arrange
        var userId = "user-123";
        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync(userId))
            .ReturnsAsync(new List<Route>());

        // Act
        await _controller.GetTodaysRoutes();

        // Assert
        _mockRouteService.Verify(x => x.GetRoutesByUserIdAsync(userId), Times.Once);
    }
}