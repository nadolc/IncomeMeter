using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Moq;
using Xunit;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using System.Linq.Expressions;

namespace IncomeMeter.Tests.Services;

public class UserServiceTests
{
    private readonly Mock<IMongoCollection<User>> _mockCollection;
    private readonly Mock<IMongoDatabase> _mockDatabase;
    private readonly Mock<IMongoClient> _mockClient;
    private readonly Mock<IOptions<DatabaseSettings>> _mockDatabaseSettings;
    private readonly UserService _userService;
    private readonly Mock<IAsyncCursor<User>> _mockCursor;

    public UserServiceTests()
    {
        _mockCollection = new Mock<IMongoCollection<User>>();
        _mockDatabase = new Mock<IMongoDatabase>();
        _mockClient = new Mock<IMongoClient>();
        _mockDatabaseSettings = new Mock<IOptions<DatabaseSettings>>();
        _mockCursor = new Mock<IAsyncCursor<User>>();

        var databaseSettings = new DatabaseSettings
        {
            ConnectionString = "mongodb://localhost:27017",
            DatabaseName = "IncomeMeterTest",
            UsersCollectionName = "users"
        };

        _mockDatabaseSettings.Setup(x => x.Value).Returns(databaseSettings);
        _mockClient.Setup(x => x.GetDatabase(databaseSettings.DatabaseName, null))
            .Returns(_mockDatabase.Object);
        _mockDatabase.Setup(x => x.GetCollection<User>(databaseSettings.UsersCollectionName, null))
            .Returns(_mockCollection.Object);

        _userService = new UserService(_mockClient.Object, _mockDatabaseSettings.Object);
    }

    [Fact]
    public async Task CreateUserAsync_ShouldCreateNewUser()
    {
        // Arrange
        var googleId = "google-123";
        var email = "test@example.com";
        var displayName = "Test User";

        _mockCollection.Setup(x => x.InsertOneAsync(It.IsAny<User>(), null, default))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _userService.CreateUserAsync(googleId, email, displayName);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(googleId, result.GoogleId);
        Assert.Equal(email, result.Email);
        Assert.Equal(displayName, result.DisplayName);
        Assert.NotNull(result.Id);
        Assert.True(result.CreatedAt <= DateTime.UtcNow);

        _mockCollection.Verify(x => x.InsertOneAsync(
            It.Is<User>(u => u.GoogleId == googleId && u.Email == email && u.DisplayName == displayName),
            null,
            default), Times.Once);
    }

    [Fact]
    public async Task GetUserByIdAsync_WithValidId_ShouldReturnUser()
    {
        // Arrange
        var userId = "user-123";
        var user = new User
        {
            Id = userId,
            GoogleId = "google-123",
            Email = "test@example.com",
            DisplayName = "Test User",
            CreatedAt = DateTime.UtcNow,
            ApiKeys = new List<ApiKey>()
        };

        _mockCursor.Setup(x => x.Current).Returns(new List<User> { user });
        _mockCursor.SetupSequence(x => x.MoveNext(It.IsAny<CancellationToken>()))
            .Returns(true)
            .Returns(false);
        _mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);

        _mockCollection.Setup(x => x.FindAsync(
            It.IsAny<FilterDefinition<User>>(),
            It.IsAny<FindOptions<User>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(_mockCursor.Object);

        // Act
        var result = await _userService.GetUserByIdAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(userId, result.Id);
        Assert.Equal("google-123", result.GoogleId);
        Assert.Equal("test@example.com", result.Email);
        Assert.Equal("Test User", result.DisplayName);
    }

    [Fact]
    public async Task GetUserByIdAsync_WithInvalidId_ShouldReturnNull()
    {
        // Arrange
        var userId = "invalid-user";

        _mockCursor.Setup(x => x.Current).Returns(new List<User>());
        _mockCursor.Setup(x => x.MoveNext(It.IsAny<CancellationToken>())).Returns(false);
        _mockCursor.Setup(x => x.MoveNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(false);

        _mockCollection.Setup(x => x.FindAsync(
            It.IsAny<FilterDefinition<User>>(),
            It.IsAny<FindOptions<User>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(_mockCursor.Object);

        // Act
        var result = await _userService.GetUserByIdAsync(userId);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetUserByGoogleIdAsync_WithValidGoogleId_ShouldReturnUser()
    {
        // Arrange
        var googleId = "google-123";
        var user = new User
        {
            Id = "user-123",
            GoogleId = googleId,
            Email = "test@example.com",
            DisplayName = "Test User",
            CreatedAt = DateTime.UtcNow,
            ApiKeys = new List<ApiKey>()
        };

        _mockCursor.Setup(x => x.Current).Returns(new List<User> { user });
        _mockCursor.SetupSequence(x => x.MoveNext(It.IsAny<CancellationToken>()))
            .Returns(true)
            .Returns(false);
        _mockCursor.SetupSequence(x => x.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);

        _mockCollection.Setup(x => x.FindAsync(
            It.IsAny<FilterDefinition<User>>(),
            It.IsAny<FindOptions<User>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(_mockCursor.Object);

        // Act
        var result = await _userService.GetUserByGoogleIdAsync(googleId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("user-123", result.Id);
        Assert.Equal(googleId, result.GoogleId);
        Assert.Equal("test@example.com", result.Email);
        Assert.Equal("Test User", result.DisplayName);
    }

    [Fact]
    public async Task GetUserByGoogleIdAsync_WithInvalidGoogleId_ShouldReturnNull()
    {
        // Arrange
        var googleId = "invalid-google-id";

        _mockCursor.Setup(x => x.Current).Returns(new List<User>());
        _mockCursor.Setup(x => x.MoveNext(It.IsAny<CancellationToken>())).Returns(false);
        _mockCursor.Setup(x => x.MoveNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(false);

        _mockCollection.Setup(x => x.FindAsync(
            It.IsAny<FilterDefinition<User>>(),
            It.IsAny<FindOptions<User>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(_mockCursor.Object);

        // Act
        var result = await _userService.GetUserByGoogleIdAsync(googleId);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateUserAsync_ShouldUpdateExistingUser()
    {
        // Arrange
        var user = new User
        {
            Id = "user-123",
            GoogleId = "google-123",
            Email = "test@example.com",
            DisplayName = "Updated User",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            ApiKeys = new List<ApiKey>()
        };

        var replaceOneResult = new Mock<ReplaceOneResult>();
        replaceOneResult.Setup(x => x.ModifiedCount).Returns(1);

        _mockCollection.Setup(x => x.ReplaceOneAsync(
            It.IsAny<FilterDefinition<User>>(),
            It.IsAny<User>(),
            It.IsAny<ReplaceOptions>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(replaceOneResult.Object);

        // Act
        var result = await _userService.UpdateUserAsync(user);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Updated User", result.DisplayName);

        _mockCollection.Verify(x => x.ReplaceOneAsync(
            It.IsAny<FilterDefinition<User>>(),
            It.Is<User>(u => u.Id == user.Id && u.DisplayName == "Updated User"),
            It.IsAny<ReplaceOptions>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteUserAsync_ShouldDeleteUser()
    {
        // Arrange
        var userId = "user-123";
        var deleteResult = new Mock<DeleteResult>();
        deleteResult.Setup(x => x.DeletedCount).Returns(1);

        _mockCollection.Setup(x => x.DeleteOneAsync(
            It.IsAny<FilterDefinition<User>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(deleteResult.Object);

        // Act
        var result = await _userService.DeleteUserAsync(userId);

        // Assert
        Assert.True(result);

        _mockCollection.Verify(x => x.DeleteOneAsync(
            It.IsAny<FilterDefinition<User>>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteUserAsync_WithNonexistentUser_ShouldReturnFalse()
    {
        // Arrange
        var userId = "nonexistent-user";
        var deleteResult = new Mock<DeleteResult>();
        deleteResult.Setup(x => x.DeletedCount).Returns(0);

        _mockCollection.Setup(x => x.DeleteOneAsync(
            It.IsAny<FilterDefinition<User>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(deleteResult.Object);

        // Act
        var result = await _userService.DeleteUserAsync(userId);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task CreateUserAsync_WithNullParameters_ShouldThrowArgumentException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() => 
            _userService.CreateUserAsync(null, "test@example.com", "Test User"));
        
        await Assert.ThrowsAsync<ArgumentException>(() => 
            _userService.CreateUserAsync("google-123", null, "Test User"));
        
        await Assert.ThrowsAsync<ArgumentException>(() => 
            _userService.CreateUserAsync("google-123", "test@example.com", null));
    }

    [Fact]
    public async Task CreateUserAsync_WithEmptyParameters_ShouldThrowArgumentException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() => 
            _userService.CreateUserAsync("", "test@example.com", "Test User"));
        
        await Assert.ThrowsAsync<ArgumentException>(() => 
            _userService.CreateUserAsync("google-123", "", "Test User"));
        
        await Assert.ThrowsAsync<ArgumentException>(() => 
            _userService.CreateUserAsync("google-123", "test@example.com", ""));
    }

    [Fact]
    public async Task CreateUserAsync_ShouldSetCorrectDefaults()
    {
        // Arrange
        var googleId = "google-123";
        var email = "test@example.com";
        var displayName = "Test User";

        User capturedUser = null;
        _mockCollection.Setup(x => x.InsertOneAsync(It.IsAny<User>(), null, default))
            .Callback<User, InsertOneOptions, CancellationToken>((user, options, token) => 
            {
                capturedUser = user;
            })
            .Returns(Task.CompletedTask);

        // Act
        var result = await _userService.CreateUserAsync(googleId, email, displayName);

        // Assert
        Assert.NotNull(capturedUser);
        Assert.NotNull(capturedUser.ApiKeys);
        Assert.Empty(capturedUser.ApiKeys);
        Assert.True(capturedUser.CreatedAt <= DateTime.UtcNow);
        Assert.True(capturedUser.CreatedAt > DateTime.UtcNow.AddMinutes(-1));
    }
}