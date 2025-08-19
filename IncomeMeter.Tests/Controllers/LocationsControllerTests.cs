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

namespace IncomeMeter.Tests.Controllers;

public class LocationsControllerTests
{
    private readonly Mock<ILocationService> _mockLocationService;
    private readonly Mock<ILogger<WorkTracker.Api.Controllers.LocationsController>> _mockLogger;
    private readonly WorkTracker.Api.Controllers.LocationsController _controller;

    public LocationsControllerTests()
    {
        _mockLocationService = new Mock<ILocationService>();
        _mockLogger = new Mock<ILogger<WorkTracker.Api.Controllers.LocationsController>>();
        _controller = new WorkTracker.Api.Controllers.LocationsController(_mockLocationService.Object, _mockLogger.Object);

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
    public async Task GetLocations_WhenUserAuthorized_ReturnsLocations()
    {
        // Arrange
        var routeId = "route123";
        var locations = new List<Location>
        {
            new() { Id = "loc1", RouteId = routeId, Latitude = 51.5074, Longitude = -0.1278 },
            new() { Id = "loc2", RouteId = routeId, Latitude = 51.5085, Longitude = -0.1290 }
        };

        _mockLocationService.Setup(x => x.GetLocationsByRouteIdAsync(routeId, "user123"))
            .ReturnsAsync(locations);

        // Act
        var result = await _controller.GetLocations(routeId);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(locations);
    }

    [Fact]
    public async Task GetLocations_WhenUserNotAuthorized_ReturnsUnauthorized()
    {
        // Arrange
        _controller.ControllerContext.HttpContext.User = new ClaimsPrincipal();

        // Act
        var result = await _controller.GetLocations("route123");

        // Assert
        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task AddLocation_WhenValidLocation_ReturnsCreated()
    {
        // Arrange
        var dto = new CreateLocationDto
        {
            RouteId = "route123",
            Latitude = 51.5074,
            Longitude = -0.1278,
            Timestamp = DateTime.UtcNow
        };

        var createdLocation = new Location
        {
            Id = "new-location",
            RouteId = dto.RouteId,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            Timestamp = dto.Timestamp
        };

        _mockLocationService.Setup(x => x.AddLocationAsync(dto, "user123"))
            .ReturnsAsync(createdLocation);

        // Act
        var result = await _controller.AddLocation(dto);

        // Assert
        result.Should().BeOfType<CreatedAtActionResult>();
        var createdResult = result as CreatedAtActionResult;
        createdResult!.Value.Should().BeEquivalentTo(createdLocation);
        createdResult.ActionName.Should().Be(nameof(_controller.GetLocations));
    }

    [Fact]
    public async Task AddLocation_WhenLocationServiceReturnsNull_ReturnsForbid()
    {
        // Arrange
        var dto = new CreateLocationDto
        {
            RouteId = "route123",
            Latitude = 51.5074,
            Longitude = -0.1278,
            Timestamp = DateTime.UtcNow
        };

        _mockLocationService.Setup(x => x.AddLocationAsync(dto, "user123"))
            .ReturnsAsync((Location?)null);

        // Act
        var result = await _controller.AddLocation(dto);

        // Assert
        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task AddLocation_WhenInvalidOperationException_ReturnsBadRequest()
    {
        // Arrange
        var dto = new CreateLocationDto
        {
            RouteId = "route123",
            Latitude = 51.5074,
            Longitude = -0.1278,
            Timestamp = DateTime.UtcNow
        };

        _mockLocationService.Setup(x => x.AddLocationAsync(dto, "user123"))
            .ThrowsAsync(new InvalidOperationException("Location too far"));

        // Act
        var result = await _controller.AddLocation(dto);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        var badRequestResult = result as BadRequestObjectResult;
        var errorResponse = badRequestResult!.Value as dynamic;
        errorResponse!.error.Should().Be("Location too far");
    }

    [Fact]
    public async Task AddLocation_WhenUnexpectedException_ReturnsInternalServerError()
    {
        // Arrange
        var dto = new CreateLocationDto
        {
            RouteId = "route123",
            Latitude = 51.5074,
            Longitude = -0.1278,
            Timestamp = DateTime.UtcNow
        };

        _mockLocationService.Setup(x => x.AddLocationAsync(dto, "user123"))
            .ThrowsAsync(new Exception("Database error"));

        // Act
        var result = await _controller.AddLocation(dto);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = result as ObjectResult;
        objectResult!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetLocationById_WhenLocationExists_ReturnsLocation()
    {
        // Arrange
        var locationId = "loc123";
        var location = new Location { Id = locationId, UserId = "user123" };

        _mockLocationService.Setup(x => x.GetLocationByIdAsync(locationId, "user123"))
            .ReturnsAsync(location);

        // Act
        var result = await _controller.GetLocationById(locationId);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(location);
    }

    [Fact]
    public async Task GetLocationById_WhenLocationDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var locationId = "nonexistent";

        _mockLocationService.Setup(x => x.GetLocationByIdAsync(locationId, "user123"))
            .ReturnsAsync((Location?)null);

        // Act
        var result = await _controller.GetLocationById(locationId);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task UpdateLocation_WhenLocationExists_ReturnsUpdatedLocation()
    {
        // Arrange
        var locationId = "loc123";
        var dto = new UpdateLocationDto
        {
            Latitude = 52.5074,
            Longitude = -1.1278
        };

        var updatedLocation = new Location
        {
            Id = locationId,
            Latitude = dto.Latitude.Value,
            Longitude = dto.Longitude.Value
        };

        _mockLocationService.Setup(x => x.UpdateLocationAsync(locationId, dto, "user123"))
            .ReturnsAsync(updatedLocation);

        // Act
        var result = await _controller.UpdateLocation(locationId, dto);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().BeEquivalentTo(updatedLocation);
    }

    [Fact]
    public async Task UpdateLocation_WhenLocationDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var locationId = "nonexistent";
        var dto = new UpdateLocationDto { Latitude = 52.5074 };

        _mockLocationService.Setup(x => x.UpdateLocationAsync(locationId, dto, "user123"))
            .ReturnsAsync((Location?)null);

        // Act
        var result = await _controller.UpdateLocation(locationId, dto);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task DeleteLocation_WhenLocationExists_ReturnsNoContent()
    {
        // Arrange
        var locationId = "loc123";

        _mockLocationService.Setup(x => x.DeleteLocationAsync(locationId, "user123"))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.DeleteLocation(locationId);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task DeleteLocation_WhenLocationDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var locationId = "nonexistent";

        _mockLocationService.Setup(x => x.DeleteLocationAsync(locationId, "user123"))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.DeleteLocation(locationId);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task DeleteLocationsByRouteId_WhenRouteExists_ReturnsNoContent()
    {
        // Arrange
        var routeId = "route123";

        _mockLocationService.Setup(x => x.DeleteLocationsByRouteIdAsync(routeId, "user123"))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.DeleteLocationsByRouteId(routeId);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task DeleteLocationsByRouteId_WhenRouteDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var routeId = "nonexistent";

        _mockLocationService.Setup(x => x.DeleteLocationsByRouteIdAsync(routeId, "user123"))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.DeleteLocationsByRouteId(routeId);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task DeleteLocation_WhenExceptionThrown_ReturnsInternalServerError()
    {
        // Arrange
        var locationId = "loc123";

        _mockLocationService.Setup(x => x.DeleteLocationAsync(locationId, "user123"))
            .ThrowsAsync(new Exception("Database error"));

        // Act
        var result = await _controller.DeleteLocation(locationId);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = result as ObjectResult;
        objectResult!.StatusCode.Should().Be(500);
    }
}