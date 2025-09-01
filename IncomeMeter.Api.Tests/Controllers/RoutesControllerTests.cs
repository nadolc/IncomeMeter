using IncomeMeter.Api.Controllers;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using FluentAssertions;
using Xunit;
using System.Security.Claims;

namespace IncomeMeter.Api.Tests.Controllers;

public class RoutesControllerTests
{
    private readonly Mock<IRouteService> _mockRouteService;
    private readonly Mock<ILogger<RoutesController>> _mockLogger;
    private readonly RoutesController _controller;

    public RoutesControllerTests()
    {
        _mockRouteService = new Mock<IRouteService>();
        _mockLogger = new Mock<ILogger<RoutesController>>();
        _controller = new RoutesController(_mockRouteService.Object, _mockLogger.Object);

        SetupControllerUser();
    }

    private void SetupControllerUser()
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "user123")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = principal,
                Items = { ["CorrelationId"] = "test-correlation-id" }
            }
        };
    }

    [Fact]
    public async Task GetRoutes_WhenUserAuthorized_ReturnsRoutes()
    {
        // Arrange
        var routes = new List<IncomeMeter.Api.Models.Route>
        {
            new() { Id = "route1", UserId = "user123", WorkType = "Taxi" },
            new() { Id = "route2", UserId = "user123", WorkType = "Delivery" }
        };

        _mockRouteService.Setup(x => x.GetRoutesByUserIdAsync("user123"))
            .ReturnsAsync(routes);

        // Act
        var result = await _controller.GetRoutes();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(routes);
    }

    [Fact]
    public async Task GetRoutes_WhenUserNotAuthorized_ReturnsUnauthorized()
    {
        // Arrange
        _controller.ControllerContext.HttpContext.User = new ClaimsPrincipal();

        // Act
        var result = await _controller.GetRoutes();

        // Assert
        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task CreateRoute_WhenValidRoute_ReturnsCreated()
    {
        // Arrange
        var dto = new CreateRouteDto
        {
            WorkType = "Taxi",
            ScheduleStart = DateTime.UtcNow,
            ScheduleEnd = DateTime.UtcNow.AddHours(8),
            Incomes = new List<IncomeItemDto>()
        };

        var createdRoute = new IncomeMeter.Api.Models.Route
        {
            Id = "new-route",
            UserId = "user123",
            WorkType = dto.WorkType,
            ScheduleStart = dto.ScheduleStart,
            ScheduleEnd = dto.ScheduleEnd
        };

        _mockRouteService.Setup(x => x.CreateRouteAsync(dto, "user123"))
            .ReturnsAsync(createdRoute);

        // Act
        var result = await _controller.CreateRoute(dto);

        // Assert
        result.Should().BeOfType<CreatedAtActionResult>();
        var createdResult = result as CreatedAtActionResult;
        createdResult!.Value.Should().BeEquivalentTo(createdRoute);
        createdResult.ActionName.Should().Be(nameof(_controller.GetRouteById));
    }

    [Fact]
    public async Task StartRoute_WhenValidData_ReturnsCreated()
    {
        // Arrange
        var dto = new StartRouteDto
        {
            WorkType = "Delivery",
            StartMile = 1000
        };

        var startedRoute = new IncomeMeter.Api.Models.Route
        {
            Id = "started-route",
            UserId = "user123",
            WorkType = dto.WorkType,
            StartMile = dto.StartMile,
            Status = "in_progress"
        };

        _mockRouteService.Setup(x => x.StartRouteAsync(dto, "user123"))
            .ReturnsAsync(startedRoute);

        // Act
        var result = await _controller.StartRoute(dto);

        // Assert
        result.Should().BeOfType<CreatedAtActionResult>();
        var createdResult = result as CreatedAtActionResult;
        createdResult!.Value.Should().BeEquivalentTo(startedRoute);
    }

    [Fact]
    public async Task GetRouteById_WhenRouteExists_ReturnsRoute()
    {
        // Arrange
        var routeId = "route123";
        var route = new IncomeMeter.Api.Models.Route { Id = routeId, UserId = "user123" };

        _mockRouteService.Setup(x => x.GetRouteByIdAsync(routeId, "user123"))
            .ReturnsAsync(route);

        // Act
        var result = await _controller.GetRouteById(routeId);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(route);
    }

    [Fact]
    public async Task GetRouteById_WhenRouteDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var routeId = "nonexistent";

        _mockRouteService.Setup(x => x.GetRouteByIdAsync(routeId, "user123"))
            .ReturnsAsync((IncomeMeter.Api.Models.Route?)null);

        // Act
        var result = await _controller.GetRouteById(routeId);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task UpdateRoute_WhenRouteExists_ReturnsUpdatedRoute()
    {
        // Arrange
        var routeId = "route123";
        var dto = new UpdateRouteDto
        {
            WorkType = "Updated Type",
            EstimatedIncome = 150m
        };

        var updatedRoute = new IncomeMeter.Api.Models.Route
        {
            Id = routeId,
            WorkType = dto.WorkType,
            EstimatedIncome = dto.EstimatedIncome.Value
        };

        _mockRouteService.Setup(x => x.UpdateRouteAsync(routeId, dto, "user123"))
            .ReturnsAsync(updatedRoute);

        // Act
        var result = await _controller.UpdateRoute(routeId, dto);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(updatedRoute);
    }

    [Fact]
    public async Task UpdateRoute_WhenRouteDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var routeId = "nonexistent";
        var dto = new UpdateRouteDto { WorkType = "Test" };

        _mockRouteService.Setup(x => x.UpdateRouteAsync(routeId, dto, "user123"))
            .ReturnsAsync((IncomeMeter.Api.Models.Route?)null);

        // Act
        var result = await _controller.UpdateRoute(routeId, dto);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task EndRoute_WhenRouteExists_ReturnsCompletedRoute()
    {
        // Arrange
        var dto = new EndRouteDto
        {
            Id = "route123",
            EndMile = 1100,
            Incomes = new List<IncomeItemDto>
            {
                new() { Source = "Fare", Amount = 50m }
            }
        };

        var completedRoute = new IncomeMeter.Api.Models.Route
        {
            Id = dto.Id,
            EndMile = dto.EndMile,
            Status = "completed",
            TotalIncome = 50m
        };

        _mockRouteService.Setup(x => x.EndRouteAsync(dto, "user123"))
            .ReturnsAsync(completedRoute);

        // Act
        var result = await _controller.EndRoute(dto);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(completedRoute);
    }

    [Fact]
    public async Task EndRoute_WhenRouteDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var dto = new EndRouteDto
        {
            Id = "nonexistent",
            EndMile = 1100,
            Incomes = new List<IncomeItemDto>()
        };

        _mockRouteService.Setup(x => x.EndRouteAsync(dto, "user123"))
            .ReturnsAsync((IncomeMeter.Api.Models.Route?)null);

        // Act
        var result = await _controller.EndRoute(dto);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task DeleteRoute_WhenRouteExists_ReturnsNoContent()
    {
        // Arrange
        var routeId = "route123";

        _mockRouteService.Setup(x => x.DeleteRouteAsync(routeId, "user123"))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.DeleteRoute(routeId);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task DeleteRoute_WhenRouteDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var routeId = "nonexistent";

        _mockRouteService.Setup(x => x.DeleteRouteAsync(routeId, "user123"))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.DeleteRoute(routeId);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task GetRoutesByStatus_ReturnsFilteredRoutes()
    {
        // Arrange
        var status = "completed";
        var routes = new List<IncomeMeter.Api.Models.Route>
        {
            new() { Id = "route1", UserId = "user123", Status = status },
            new() { Id = "route2", UserId = "user123", Status = status }
        };

        _mockRouteService.Setup(x => x.GetRoutesByStatusAsync("user123", status))
            .ReturnsAsync(routes);

        // Act
        var result = await _controller.GetRoutesByStatus(status);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(routes);
    }

    [Fact]
    public async Task GetRoutesByDateRange_ReturnsFilteredRoutes()
    {
        // Arrange
        var startDate = DateTime.UtcNow.Date;
        var endDate = startDate.AddDays(1);
        var routes = new List<IncomeMeter.Api.Models.Route>
        {
            new() { Id = "route1", UserId = "user123", ScheduleStart = startDate.AddHours(9) },
            new() { Id = "route2", UserId = "user123", ScheduleStart = startDate.AddHours(14) }
        };

        _mockRouteService.Setup(x => x.GetRoutesByDateRangeAsync("user123", startDate, endDate))
            .ReturnsAsync(routes);

        // Act
        var result = await _controller.GetRoutesByDateRange(startDate, endDate);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(routes);
    }

    #region Start With API Key Tests

    [Fact]
    public async Task StartRouteWithApiKey_WithValidDataAndWorkTypeId_ShouldCreateRouteSuccessfully()
    {
        // Arrange
        var user = new User { Id = "user123", Email = "test@example.com" };
        var dto = new StartRouteDto 
        { 
            WorkType = "Delivery", 
            WorkTypeId = "507f1f77bcf86cd799439011",  // Valid ObjectId
            StartMile = 12500.5, 
            EstimatedIncome = 150.00m 
        };

        var createdRoute = new Route
        {
            Id = "route123",
            UserId = user.Id,
            WorkType = dto.WorkType,
            WorkTypeId = dto.WorkTypeId,
            StartMile = dto.StartMile,
            EstimatedIncome = dto.EstimatedIncome ?? 0m,
            Status = "in_progress",
            ActualStartTime = DateTime.UtcNow
        };

        _controller.ControllerContext.HttpContext.Items["User"] = user;
        _mockRouteService.Setup(x => x.StartRouteAsync(dto, user.Id))
            .ReturnsAsync(createdRoute);

        // Act
        var result = await _controller.StartRouteWithApiKey(dto);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var response = okResult!.Value;
        
        // Use reflection to check dynamic object properties
        var responseType = response!.GetType();
        responseType.GetProperty("success")!.GetValue(response).Should().Be(true);
        responseType.GetProperty("routeId")!.GetValue(response).Should().Be("route123");
        responseType.GetProperty("workTypeId")!.GetValue(response).Should().Be("507f1f77bcf86cd799439011");
        responseType.GetProperty("workType")!.GetValue(response).Should().Be("Delivery");
    }

    [Fact]
    public async Task StartRouteWithApiKey_WithValidDataWithoutWorkTypeId_ShouldCreateRouteSuccessfully()
    {
        // Arrange
        var user = new User { Id = "user123", Email = "test@example.com" };
        var dto = new StartRouteDto 
        { 
            WorkType = "Rideshare", 
            WorkTypeId = null,  // No WorkTypeId provided
            StartMile = 10000.0, 
            EstimatedIncome = 100.00m 
        };

        var createdRoute = new Route
        {
            Id = "route456",
            UserId = user.Id,
            WorkType = dto.WorkType,
            WorkTypeId = null,
            StartMile = dto.StartMile,
            EstimatedIncome = dto.EstimatedIncome ?? 0m,
            Status = "in_progress"
        };

        _controller.ControllerContext.HttpContext.Items["User"] = user;
        _mockRouteService.Setup(x => x.StartRouteAsync(dto, user.Id))
            .ReturnsAsync(createdRoute);

        // Act
        var result = await _controller.StartRouteWithApiKey(dto);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var response = okResult!.Value;
        
        var responseType = response!.GetType();
        responseType.GetProperty("success")!.GetValue(response).Should().Be(true);
        responseType.GetProperty("routeId")!.GetValue(response).Should().Be("route456");
        responseType.GetProperty("workTypeId")!.GetValue(response).Should().BeNull();
        responseType.GetProperty("workType")!.GetValue(response).Should().Be("Rideshare");
    }

    [Fact]
    public async Task StartRouteWithApiKey_WithInvalidWorkTypeIdFormat_ShouldReturnBadRequest()
    {
        // Arrange
        var user = new User { Id = "user123", Email = "test@example.com" };
        var dto = new StartRouteDto 
        { 
            WorkType = "Delivery", 
            WorkTypeId = "invalid-id",  // Invalid ObjectId format
            StartMile = 12500.5, 
            EstimatedIncome = 150.00m 
        };

        _controller.ControllerContext.HttpContext.Items["User"] = user;

        // Act
        var result = await _controller.StartRouteWithApiKey(dto);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        var badRequestResult = result as BadRequestObjectResult;
        var errorResponse = badRequestResult!.Value;
        
        var errorType = errorResponse!.GetType();
        errorType.GetProperty("success")!.GetValue(errorResponse).Should().Be(false);
        var error = errorType.GetProperty("error")!.GetValue(errorResponse) as string;
        error.Should().Contain("WorkTypeId must be a valid 24-character ObjectId format");
    }

    [Fact]
    public async Task StartRouteWithApiKey_WithEmptyWorkTypeId_ShouldCreateRouteSuccessfully()
    {
        // Arrange
        var user = new User { Id = "user123", Email = "test@example.com" };
        var dto = new StartRouteDto 
        { 
            WorkType = "Delivery", 
            WorkTypeId = "",  // Empty string should be treated as null
            StartMile = 12500.5, 
            EstimatedIncome = 150.00m 
        };

        var createdRoute = new Route
        {
            Id = "route789",
            UserId = user.Id,
            WorkType = dto.WorkType,
            WorkTypeId = null,
            StartMile = dto.StartMile,
            EstimatedIncome = dto.EstimatedIncome ?? 0m,
            Status = "in_progress"
        };

        _controller.ControllerContext.HttpContext.Items["User"] = user;
        _mockRouteService.Setup(x => x.StartRouteAsync(dto, user.Id))
            .ReturnsAsync(createdRoute);

        // Act
        var result = await _controller.StartRouteWithApiKey(dto);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var response = okResult!.Value;
        
        var responseType = response!.GetType();
        responseType.GetProperty("success")!.GetValue(response).Should().Be(true);
        responseType.GetProperty("routeId")!.GetValue(response).Should().Be("route789");
    }

    [Fact]
    public async Task StartRouteWithApiKey_WithoutUserInContext_ShouldReturnUnauthorized()
    {
        // Arrange
        var dto = new StartRouteDto 
        { 
            WorkType = "Delivery", 
            StartMile = 12500.5 
        };

        // Don't set User in HttpContext.Items to simulate missing API key authentication

        // Act
        var result = await _controller.StartRouteWithApiKey(dto);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
        var unauthorizedResult = result as UnauthorizedObjectResult;
        unauthorizedResult!.Value.Should().Be("Invalid API key - user not found via middleware");
    }

    [Fact]
    public async Task StartRouteWithApiKey_WithServiceException_ShouldReturnInternalServerError()
    {
        // Arrange
        var user = new User { Id = "user123", Email = "test@example.com" };
        var dto = new StartRouteDto 
        { 
            WorkType = "Delivery", 
            WorkTypeId = "507f1f77bcf86cd799439011",
            StartMile = 12500.5 
        };

        _controller.ControllerContext.HttpContext.Items["User"] = user;
        _mockRouteService.Setup(x => x.StartRouteAsync(dto, user.Id))
            .ThrowsAsync(new Exception("Database connection failed"));

        // Act
        var result = await _controller.StartRouteWithApiKey(dto);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = result as ObjectResult;
        objectResult!.StatusCode.Should().Be(500);
        
        var errorResponse = objectResult.Value;
        var errorType = errorResponse!.GetType();
        var message = errorType.GetProperty("message")!.GetValue(errorResponse) as string;
        message.Should().Be("Failed to start route");
    }

    #endregion
}