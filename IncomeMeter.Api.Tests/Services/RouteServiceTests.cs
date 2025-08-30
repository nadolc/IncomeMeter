using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.Services.Interfaces;
using MongoDB.Driver;
using Moq;
using FluentAssertions;
using Xunit;

namespace IncomeMeter.Api.Tests.Services;

public class RouteServiceTests
{
    private readonly Mock<MongoDbContext> _mockContext;
    private readonly Mock<IMongoCollection<IncomeMeter.Api.Models.Route>> _mockRouteCollection;
    private readonly RouteService _routeService;

    public RouteServiceTests()
    {
        _mockContext = new Mock<MongoDbContext>();
        _mockRouteCollection = new Mock<IMongoCollection<IncomeMeter.Api.Models.Route>>();

        _mockContext.Setup(x => x.Routes).Returns(_mockRouteCollection.Object);

        _routeService = new RouteService(_mockContext.Object);
    }

    [Fact]
    public async Task GetRoutesByUserIdAsync_ReturnsRoutesForUser()
    {
        // Arrange
        var userId = "user123";
        var routes = new List<IncomeMeter.Api.Models.Route>
        {
            new() { Id = "route1", UserId = userId, WorkType = "Taxi" },
            new() { Id = "route2", UserId = userId, WorkType = "Delivery" }
        };

        var mockCursor = new Mock<IAsyncCursor<IncomeMeter.Api.Models.Route>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);
        mockCursor.Setup(x => x.Current).Returns(routes);

        _mockRouteCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<FindOptions<IncomeMeter.Api.Models.Route, IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        // Act
        var result = await _routeService.GetRoutesByUserIdAsync(userId);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(2);
        result.Should().AllSatisfy(r => r.UserId.Should().Be(userId));
    }

    [Fact]
    public async Task GetRouteByIdAsync_WhenRouteExists_ReturnsRoute()
    {
        // Arrange
        var routeId = "route123";
        var userId = "user123";
        var route = new IncomeMeter.Api.Models.Route { Id = routeId, UserId = userId };

        var mockCursor = new Mock<IAsyncCursor<IncomeMeter.Api.Models.Route>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);
        mockCursor.Setup(x => x.Current).Returns(new[] { route });

        _mockRouteCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<FindOptions<IncomeMeter.Api.Models.Route, IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        // Act
        var result = await _routeService.GetRouteByIdAsync(routeId, userId);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(routeId);
        result.UserId.Should().Be(userId);
    }

    [Fact]
    public async Task GetRouteByIdAsync_WhenRouteDoesNotExist_ReturnsNull()
    {
        // Arrange
        var routeId = "nonexistent";
        var userId = "user123";

        var mockCursor = new Mock<IAsyncCursor<IncomeMeter.Api.Models.Route>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _mockRouteCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<FindOptions<IncomeMeter.Api.Models.Route, IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        // Act
        var result = await _routeService.GetRouteByIdAsync(routeId, userId);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task CreateRouteAsync_CreatesRouteSuccessfully()
    {
        // Arrange
        var userId = "user123";
        var dto = new CreateRouteDto
        {
            WorkType = "Taxi",
            ScheduleStart = DateTime.UtcNow,
            ScheduleEnd = DateTime.UtcNow.AddHours(8),
            EstimatedIncome = 100m,
            StartMile = 1000,
            Incomes = new List<IncomeItemDto>
            {
                new() { Source = "Base fare", Amount = 50m },
                new() { Source = "Tips", Amount = 10m }
            }
        };

        // Act
        var result = await _routeService.CreateRouteAsync(dto, userId);

        // Assert
        result.Should().NotBeNull();
        result.UserId.Should().Be(userId);
        result.WorkType.Should().Be(dto.WorkType);
        result.ScheduleStart.Should().Be(dto.ScheduleStart);
        result.ScheduleEnd.Should().Be(dto.ScheduleEnd);
        result.EstimatedIncome.Should().Be(dto.EstimatedIncome);
        result.StartMile.Should().Be(dto.StartMile);
        result.Status.Should().Be("scheduled");
        result.TotalIncome.Should().Be(60m);
        result.Incomes.Should().HaveCount(2);

        _mockRouteCollection.Verify(x => x.InsertOneAsync(
            It.IsAny<IncomeMeter.Api.Models.Route>(),
            It.IsAny<InsertOneOptions>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task StartRouteAsync_CreatesInProgressRoute()
    {
        // Arrange
        var userId = "user123";
        var dto = new StartRouteDto
        {
            WorkType = "Delivery",
            StartMile = 2000,
            EstimatedIncome = 80m
        };

        // Act
        var result = await _routeService.StartRouteAsync(dto, userId);

        // Assert
        result.Should().NotBeNull();
        result!.UserId.Should().Be(userId);
        result.WorkType.Should().Be(dto.WorkType);
        result.StartMile.Should().Be(dto.StartMile);
        result.EstimatedIncome.Should().Be(dto.EstimatedIncome);
        result.Status.Should().Be("in_progress");
        result.ActualStartTime.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));

        _mockRouteCollection.Verify(x => x.InsertOneAsync(
            It.IsAny<IncomeMeter.Api.Models.Route>(),
            It.IsAny<InsertOneOptions>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task EndRouteAsync_WhenRouteExists_UpdatesRouteSuccessfully()
    {
        // Arrange
        var userId = "user123";
        var routeId = "route123";
        var dto = new EndRouteDto
        {
            Id = routeId,
            EndMile = 2100,
            Incomes = new List<IncomeItemDto>
            {
                new() { Source = "Fare", Amount = 75m },
                new() { Source = "Tips", Amount = 15m }
            }
        };

        var updatedRoute = new IncomeMeter.Api.Models.Route
        {
            Id = routeId,
            UserId = userId,
            StartMile = 2000,
            EndMile = 2100,
            Status = "completed",
            TotalIncome = 90m,
            Distance = 100,
            Incomes = dto.Incomes.Select(i => new IncomeItem { Source = i.Source, Amount = i.Amount }).ToList()
        };

        _mockRouteCollection.Setup(x => x.FindOneAndUpdateAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<UpdateDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<FindOneAndUpdateOptions<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedRoute);

        // Act
        var result = await _routeService.EndRouteAsync(dto, userId);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(routeId);
        result.Status.Should().Be("completed");
        result.TotalIncome.Should().Be(90m);
        result.Distance.Should().Be(100);

        _mockRouteCollection.Verify(x => x.UpdateOneAsync(
            It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
            It.IsAny<UpdateDefinition<IncomeMeter.Api.Models.Route>>(),
            It.IsAny<UpdateOptions>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateRouteAsync_WhenRouteExists_UpdatesSuccessfully()
    {
        // Arrange
        var routeId = "route123";
        var userId = "user123";
        var dto = new UpdateRouteDto
        {
            WorkType = "Updated Type",
            EstimatedIncome = 120m,
            Incomes = new List<IncomeItemDto>
            {
                new() { Source = "Updated Source", Amount = 80m }
            }
        };

        var updatedRoute = new IncomeMeter.Api.Models.Route
        {
            Id = routeId,
            UserId = userId,
            WorkType = dto.WorkType,
            EstimatedIncome = dto.EstimatedIncome.Value,
            TotalIncome = 80m,
            Incomes = dto.Incomes.Select(i => new IncomeItem { Source = i.Source, Amount = i.Amount }).ToList()
        };

        _mockRouteCollection.Setup(x => x.FindOneAndUpdateAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<UpdateDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<FindOneAndUpdateOptions<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedRoute);

        // Act
        var result = await _routeService.UpdateRouteAsync(routeId, dto, userId);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(routeId);
        result.WorkType.Should().Be(dto.WorkType);
        result.EstimatedIncome.Should().Be(dto.EstimatedIncome);
        result.TotalIncome.Should().Be(80m);
    }

    [Fact]
    public async Task UpdateRouteAsync_WhenRouteDoesNotExist_ReturnsNull()
    {
        // Arrange
        var routeId = "nonexistent";
        var userId = "user123";
        var dto = new UpdateRouteDto { WorkType = "Test" };

        _mockRouteCollection.Setup(x => x.FindOneAndUpdateAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<UpdateDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<FindOneAndUpdateOptions<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((IncomeMeter.Api.Models.Route?)null);

        // Act
        var result = await _routeService.UpdateRouteAsync(routeId, dto, userId);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task DeleteRouteAsync_WhenRouteExists_ReturnsTrue()
    {
        // Arrange
        var routeId = "route123";
        var userId = "user123";

        var deleteResult = new Mock<DeleteResult>();
        deleteResult.Setup(x => x.DeletedCount).Returns(1);

        _mockRouteCollection.Setup(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(deleteResult.Object);

        // Act
        var result = await _routeService.DeleteRouteAsync(routeId, userId);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteRouteAsync_WhenRouteDoesNotExist_ReturnsFalse()
    {
        // Arrange
        var routeId = "nonexistent";
        var userId = "user123";

        var deleteResult = new Mock<DeleteResult>();
        deleteResult.Setup(x => x.DeletedCount).Returns(0);

        _mockRouteCollection.Setup(x => x.DeleteOneAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(deleteResult.Object);

        // Act
        var result = await _routeService.DeleteRouteAsync(routeId, userId);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task GetRoutesByStatusAsync_ReturnsFilteredRoutes()
    {
        // Arrange
        var userId = "user123";
        var status = "completed";
        var routes = new List<IncomeMeter.Api.Models.Route>
        {
            new() { Id = "route1", UserId = userId, Status = status },
            new() { Id = "route2", UserId = userId, Status = status }
        };

        var mockCursor = new Mock<IAsyncCursor<IncomeMeter.Api.Models.Route>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);
        mockCursor.Setup(x => x.Current).Returns(routes);

        _mockRouteCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<FindOptions<IncomeMeter.Api.Models.Route, IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        // Act
        var result = await _routeService.GetRoutesByStatusAsync(userId, status);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(2);
        result.Should().AllSatisfy(r => r.Status.Should().Be(status));
    }

    [Fact]
    public async Task GetRoutesByDateRangeAsync_ReturnsFilteredRoutes()
    {
        // Arrange
        var userId = "user123";
        var startDate = DateTime.UtcNow.Date;
        var endDate = startDate.AddDays(1);
        var routes = new List<IncomeMeter.Api.Models.Route>
        {
            new() { Id = "route1", UserId = userId, ScheduleStart = startDate.AddHours(9) },
            new() { Id = "route2", UserId = userId, ScheduleStart = startDate.AddHours(14) }
        };

        var mockCursor = new Mock<IAsyncCursor<IncomeMeter.Api.Models.Route>>();
        mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);
        mockCursor.Setup(x => x.Current).Returns(routes);

        _mockRouteCollection.Setup(x => x.FindAsync(
                It.IsAny<FilterDefinition<IncomeMeter.Api.Models.Route>>(),
                It.IsAny<FindOptions<IncomeMeter.Api.Models.Route, IncomeMeter.Api.Models.Route>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockCursor.Object);

        // Act
        var result = await _routeService.GetRoutesByDateRangeAsync(userId, startDate, endDate);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(2);
        result.Should().AllSatisfy(r => 
        {
            r.UserId.Should().Be(userId);
            r.ScheduleStart.Should().BeOnOrAfter(startDate);
            r.ScheduleStart.Should().BeOnOrBefore(endDate);
        });
    }
}