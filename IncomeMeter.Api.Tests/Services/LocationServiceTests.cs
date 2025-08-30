using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.Services.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Moq;
using FluentAssertions;
using Xunit;

namespace IncomeMeter.Api.Tests.Services;

public class LocationServiceTests
{
    private readonly Mock<MongoDbContext> _mockContext;
    private readonly Mock<IRouteService> _mockRouteService;
    private readonly Mock<IGeoCodingService> _mockGeoCodingService;
    private readonly Mock<ILogger<LocationService>> _mockLogger;
    private readonly Mock<IMongoCollection<Location>> _mockLocationCollection;
    private readonly Mock<IOptions<GeocodingSettings>> _mockGeocodingSettings;
    private readonly LocationService _locationService;
    private readonly GeocodingSettings _geocodingSettings;

    public LocationServiceTests()
    {
        _mockContext = new Mock<MongoDbContext>();
        _mockRouteService = new Mock<IRouteService>();
        _mockGeoCodingService = new Mock<IGeoCodingService>();
        _mockLogger = new Mock<ILogger<LocationService>>();
        _mockLocationCollection = new Mock<IMongoCollection<Location>>();
        _mockGeocodingSettings = new Mock<IOptions<GeocodingSettings>>();

        _geocodingSettings = new GeocodingSettings
        {
            CoordinatePrecision = 6,
            MaxDistanceKm = 50
        };

        _mockGeocodingSettings.Setup(x => x.Value).Returns(_geocodingSettings);
        _mockContext.Setup(x => x.Locations).Returns(_mockLocationCollection.Object);

        _locationService = new LocationService(
            _mockContext.Object,
            _mockRouteService.Object,
            _mockGeoCodingService.Object,
            _mockGeocodingSettings.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task GetLocationsByRouteIdAsync_WhenRouteExists_ReturnsLocations()
    {
        // Arrange
        var routeId = "route123";
        var userId = "user123";
        var route = new IncomeMeter.Api.Models.Route { Id = routeId, UserId = userId };
        var locations = new List<Location>
        {
            new() { Id = "loc1", RouteId = routeId, UserId = userId, Latitude = 51.5074, Longitude = -0.1278 },
            new() { Id = "loc2", RouteId = routeId, UserId = userId, Latitude = 51.5085, Longitude = -0.1290 }
        };

        _mockRouteService.Setup(x => x.GetRouteByIdAsync(routeId, userId))
            .ReturnsAsync(route);

        var mockCursor = new Mock<IAsyncCursor<Location>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);
        mockCursor.Setup(x => x.Current).Returns(locations);

        _mockLocationCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<Location>>(),
                It.IsAny<FindOptions<Location, Location>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        // Act
        var result = await _locationService.GetLocationsByRouteIdAsync(routeId, userId);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(2);
        result.Should().AllSatisfy(l => l.RouteId.Should().Be(routeId));
    }

    [Fact]
    public async Task GetLocationsByRouteIdAsync_WhenRouteDoesNotExist_ReturnsEmptyList()
    {
        // Arrange
        var routeId = "nonexistent";
        var userId = "user123";

        _mockRouteService.Setup(x => x.GetRouteByIdAsync(routeId, userId))
            .ReturnsAsync((IncomeMeter.Api.Models.Route?)null);

        // Act
        var result = await _locationService.GetLocationsByRouteIdAsync(routeId, userId);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task AddLocationAsync_WhenValidLocation_ReturnsLocation()
    {
        // Arrange
        var userId = "user123";
        var routeId = "route123";
        var dto = new CreateLocationDto
        {
            RouteId = routeId,
            Latitude = 51.5074123,
            Longitude = -0.1278456,
            Timestamp = DateTime.UtcNow,
            Accuracy = 10.5,
            Speed = 30.2
        };

        var route = new IncomeMeter.Api.Models.Route { Id = routeId, UserId = userId };

        _mockRouteService.Setup(x => x.GetRouteByIdAsync(routeId, userId))
            .ReturnsAsync(route);

        _mockGeoCodingService.Setup(x => x.GetAddressFromCoordinatesAsync(
                It.IsAny<double>(), It.IsAny<double>()))
            .ReturnsAsync("Test Address");

        var mockCursor = new Mock<IAsyncCursor<Location>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _mockLocationCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<Location>>(),
                It.IsAny<FindOptions<Location, Location>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        // Act
        var result = await _locationService.AddLocationAsync(dto, userId);

        // Assert
        result.Should().NotBeNull();
        result!.RouteId.Should().Be(routeId);
        result.UserId.Should().Be(userId);
        result.Latitude.Should().Be(Math.Round(dto.Latitude, 6));
        result.Longitude.Should().Be(Math.Round(dto.Longitude, 6));
        result.Address.Should().Be("Test Address");
        result.Accuracy.Should().Be(dto.Accuracy);
        result.Speed.Should().Be(dto.Speed);

        _mockLocationCollection.Verify(x => x.InsertOneAsync(
            It.IsAny<Location>(),
            It.IsAny<InsertOneOptions>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AddLocationAsync_WhenRouteDoesNotExist_ReturnsNull()
    {
        // Arrange
        var userId = "user123";
        var routeId = "nonexistent";
        var dto = new CreateLocationDto
        {
            RouteId = routeId,
            Latitude = 51.5074,
            Longitude = -0.1278,
            Timestamp = DateTime.UtcNow
        };

        _mockRouteService.Setup(x => x.GetRouteByIdAsync(routeId, userId))
            .ReturnsAsync((IncomeMeter.Api.Models.Route?)null);

        // Act
        var result = await _locationService.AddLocationAsync(dto, userId);

        // Assert
        result.Should().BeNull();
        _mockLocationCollection.Verify(x => x.InsertOneAsync(
            It.IsAny<Location>(),
            It.IsAny<InsertOneOptions>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AddLocationAsync_WhenDistanceExceedsLimit_ThrowsException()
    {
        // Arrange
        var userId = "user123";
        var routeId = "route123";
        var dto = new CreateLocationDto
        {
            RouteId = routeId,
            Latitude = 51.5074,
            Longitude = -0.1278,
            Timestamp = DateTime.UtcNow
        };

        var route = new IncomeMeter.Api.Models.Route { Id = routeId, UserId = userId };
        var lastLocation = new Location
        {
            Id = "last",
            RouteId = routeId,
            Latitude = 50.0,
            Longitude = 0.0,
            Timestamp = DateTime.UtcNow.AddMinutes(-10)
        };

        _mockRouteService.Setup(x => x.GetRouteByIdAsync(routeId, userId))
            .ReturnsAsync(route);

        var mockCursor = new Mock<IAsyncCursor<Location>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);
        mockCursor.Setup(x => x.Current).Returns(new[] { lastLocation });

        _mockLocationCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<Location>>(),
                It.IsAny<FindOptions<Location, Location>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        _mockGeoCodingService.Setup(x => x.GetDistanceInKmAsync(
                It.IsAny<double>(), It.IsAny<double>(), It.IsAny<double>(), It.IsAny<double>()))
            .ReturnsAsync(100); // Exceeds the 50km limit

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => _locationService.AddLocationAsync(dto, userId));
        
        exception.Message.Should().Contain("too far from the previous point");
    }

    [Fact]
    public async Task GetLocationByIdAsync_WhenLocationExists_ReturnsLocation()
    {
        // Arrange
        var locationId = "loc123";
        var userId = "user123";
        var location = new Location { Id = locationId, UserId = userId };

        var mockCursor = new Mock<IAsyncCursor<Location>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);
        mockCursor.Setup(x => x.Current).Returns(new[] { location });

        _mockLocationCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<Location>>(),
                It.IsAny<FindOptions<Location, Location>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        // Act
        var result = await _locationService.GetLocationByIdAsync(locationId, userId);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(locationId);
        result.UserId.Should().Be(userId);
    }

    [Fact]
    public async Task GetLocationByIdAsync_WhenLocationDoesNotExist_ReturnsNull()
    {
        // Arrange
        var locationId = "nonexistent";
        var userId = "user123";

        var mockCursor = new Mock<IAsyncCursor<Location>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _mockLocationCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<Location>>(),
                It.IsAny<FindOptions<Location, Location>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        // Act
        var result = await _locationService.GetLocationByIdAsync(locationId, userId);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task DeleteLocationAsync_WhenLocationExists_ReturnsTrue()
    {
        // Arrange
        var locationId = "loc123";
        var userId = "user123";

        var deleteResult = new Mock<DeleteResult>();
        deleteResult.Setup(x => x.DeletedCount).Returns(1);

        _mockLocationCollection.Setup(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<Location>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(deleteResult.Object);

        // Act
        var result = await _locationService.DeleteLocationAsync(locationId, userId);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteLocationAsync_WhenLocationDoesNotExist_ReturnsFalse()
    {
        // Arrange
        var locationId = "nonexistent";
        var userId = "user123";

        var deleteResult = new Mock<DeleteResult>();
        deleteResult.Setup(x => x.DeletedCount).Returns(0);

        _mockLocationCollection.Setup(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<Location>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(deleteResult.Object);

        // Act
        var result = await _locationService.DeleteLocationAsync(locationId, userId);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteLocationsByRouteIdAsync_WhenRouteExists_ReturnsTrue()
    {
        // Arrange
        var routeId = "route123";
        var userId = "user123";
        var route = new IncomeMeter.Api.Models.Route { Id = routeId, UserId = userId };

        _mockRouteService.Setup(x => x.GetRouteByIdAsync(routeId, userId))
            .ReturnsAsync(route);

        var deleteResult = new Mock<DeleteResult>();
        deleteResult.Setup(x => x.DeletedCount).Returns(5);

        _mockLocationCollection.Setup(x => x.DeleteManyAsync(
                It.IsAny<FilterDefinition<Location>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(deleteResult.Object);

        // Act
        var result = await _locationService.DeleteLocationsByRouteIdAsync(routeId, userId);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteLocationsByRouteIdAsync_WhenRouteDoesNotExist_ReturnsFalse()
    {
        // Arrange
        var routeId = "nonexistent";
        var userId = "user123";

        _mockRouteService.Setup(x => x.GetRouteByIdAsync(routeId, userId))
            .ReturnsAsync((IncomeMeter.Api.Models.Route?)null);

        // Act
        var result = await _locationService.DeleteLocationsByRouteIdAsync(routeId, userId);

        // Assert
        result.Should().BeFalse();
        _mockLocationCollection.Verify(x => x.DeleteManyAsync(
            It.IsAny<FilterDefinition<Location>>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }
}