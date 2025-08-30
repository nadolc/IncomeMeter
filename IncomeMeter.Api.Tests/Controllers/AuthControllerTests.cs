using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using System.Security.Claims;
using Xunit;
using IncomeMeter.Api.Controllers;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.DTOs;

namespace IncomeMeter.Api.Tests.Controllers;

public class AuthControllerTests
{
    private readonly Mock<IConfiguration> _mockConfiguration;
    private readonly Mock<IUserService> _mockUserService;
    private readonly Mock<ILogger<AuthController>> _mockLogger;
    private readonly Mock<IOptions<AppSettings>> _mockAppSettings;
    private readonly AuthController _controller;
    private readonly Mock<IAuthenticationService> _mockAuthService;

    public AuthControllerTests()
    {
        _mockConfiguration = new Mock<IConfiguration>();
        _mockUserService = new Mock<IUserService>();
        _mockLogger = new Mock<ILogger<AuthController>>();
        _mockAppSettings = new Mock<IOptions<AppSettings>>();

        // Setup AppSettings
        var appSettings = new AppSettings
        {
            FrontendBaseUrl = "https://localhost:5173",
            ApiBaseUrl = "https://localhost:7079"
        };
        _mockAppSettings.Setup(x => x.Value).Returns(appSettings);

        // Setup configuration for JWT secret
        _mockConfiguration.Setup(x => x["JwtSecret"]).Returns("test-jwt-secret-key-for-testing-purposes-32-chars");

        _controller = new AuthController(_mockConfiguration.Object, _mockUserService.Object, _mockLogger.Object, _mockAppSettings.Object);

        // Setup HttpContext
        var httpContext = new DefaultHttpContext();
        httpContext.Items["CorrelationId"] = "test-correlation-id";
        httpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1");
        
        _mockAuthService = new Mock<IAuthenticationService>();
        httpContext.RequestServices = new Mock<IServiceProvider>().Object;
        
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };
    }

    [Fact]
    public void Login_ShouldReturnChallenge()
    {
        // Arrange
        var returnUrl = "/dashboard";

        // Act
        var result = _controller.Login(returnUrl);

        // Assert
        Assert.IsType<ChallengeResult>(result);
        var challengeResult = result as ChallengeResult;
        Assert.Single(challengeResult.AuthenticationSchemes);
        Assert.Equal("Google", challengeResult.AuthenticationSchemes[0]);
    }

    [Fact]
    public void Login_WithoutReturnUrl_ShouldReturnChallenge()
    {
        // Act
        var result = _controller.Login();

        // Assert
        Assert.IsType<ChallengeResult>(result);
    }

    [Fact]
    public async Task GoogleCallback_WithFailedAuthentication_ShouldRedirectToLoginWithError()
    {
        // Arrange
        var authResult = AuthenticateResult.Fail("Authentication failed");
        SetupAuthenticationResult(authResult);

        // Act
        var result = await _controller.GoogleCallback();

        // Assert
        Assert.IsType<RedirectResult>(result);
        var redirectResult = result as RedirectResult;
        Assert.Contains("login?error=Authentication failed", redirectResult.Url);
    }

    [Fact]
    public async Task GoogleCallback_WithMissingUserInfo_ShouldRedirectToLoginWithError()
    {
        // Arrange
        var claims = new List<Claim>(); // Empty claims - missing required info
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);
        var authResult = AuthenticateResult.Success(new AuthenticationTicket(principal, "Google"));
        SetupAuthenticationResult(authResult);

        // Act
        var result = await _controller.GoogleCallback();

        // Assert
        Assert.IsType<RedirectResult>(result);
        var redirectResult = result as RedirectResult;
        Assert.Contains("login?error=Missing user information from Google", redirectResult.Url);
    }

    [Fact]
    public async Task GoogleCallback_WithNewUser_ShouldRedirectToRegistration()
    {
        // Arrange
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, "google-123"),
            new Claim(ClaimTypes.Email, "test@example.com"),
            new Claim(ClaimTypes.Name, "Test User")
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);
        var authResult = AuthenticateResult.Success(new AuthenticationTicket(principal, "Google"));
        SetupAuthenticationResult(authResult);

        _mockUserService.Setup(x => x.GetUserByGoogleIdAsync("google-123"))
            .ReturnsAsync((User)null);

        // Act
        var result = await _controller.GoogleCallback();

        // Assert
        Assert.IsType<RedirectResult>(result);
        var redirectResult = result as RedirectResult;
        Assert.Contains("register", redirectResult.Url);
        Assert.Contains("googleId=google-123", redirectResult.Url);
        Assert.Contains("email=test%40example.com", redirectResult.Url);
        Assert.Contains("name=Test%20User", redirectResult.Url);
    }

    [Fact]
    public async Task GoogleCallback_WithExistingUser_ShouldRedirectToFrontendWithToken()
    {
        // Arrange
        var existingUser = new User
        {
            Id = "user-123",
            GoogleId = "google-123",
            Email = "test@example.com",
            DisplayName = "Test User",
            CreatedAt = DateTime.UtcNow,
            ApiKeys = new List<ApiKey>()
        };

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, "google-123"),
            new Claim(ClaimTypes.Email, "test@example.com"),
            new Claim(ClaimTypes.Name, "Test User")
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);
        var authResult = AuthenticateResult.Success(new AuthenticationTicket(principal, "Google"));
        SetupAuthenticationResult(authResult);

        _mockUserService.Setup(x => x.GetUserByGoogleIdAsync("google-123"))
            .ReturnsAsync(existingUser);

        // Act
        var result = await _controller.GoogleCallback();

        // Assert
        Assert.IsType<RedirectResult>(result);
        var redirectResult = result as RedirectResult;
        Assert.Contains("auth-callback", redirectResult.Url);
        Assert.Contains("token=", redirectResult.Url);
        Assert.Contains("redirectUrl=", redirectResult.Url);
    }

    [Fact]
    public async Task Register_WithValidData_ShouldReturnSuccessResponse()
    {
        // Arrange
        var request = new RegisterRequest
        {
            GoogleId = "google-123",
            Email = "test@example.com",
            DisplayName = "Test User"
        };

        var newUser = new User
        {
            Id = "user-123",
            GoogleId = "google-123",
            Email = "test@example.com",
            DisplayName = "Test User",
            CreatedAt = DateTime.UtcNow,
            ApiKeys = new List<ApiKey>()
        };

        _mockUserService.Setup(x => x.GetUserByGoogleIdAsync("google-123"))
            .ReturnsAsync((User)null);
        _mockUserService.Setup(x => x.CreateUserAsync("google-123", "test@example.com", "Test User"))
            .ReturnsAsync(newUser);

        // Act
        var result = await _controller.Register(request);

        // Assert
        Assert.IsType<OkObjectResult>(result);
        var okResult = result as OkObjectResult;
        var response = okResult.Value as DTOs.AuthResponse;
        Assert.True(response.Success);
        Assert.Equal("Registration successful", response.Message);
        Assert.NotNull(response.Token);
        Assert.NotNull(response.User);
    }

    [Fact]
    public async Task Register_WithMissingFields_ShouldReturnBadRequest()
    {
        // Arrange
        var request = new RegisterRequest
        {
            GoogleId = "",
            Email = "test@example.com",
            DisplayName = "Test User"
        };

        // Act
        var result = await _controller.Register(request);

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
        var badRequestResult = result as BadRequestObjectResult;
        var response = badRequestResult.Value as DTOs.AuthResponse;
        Assert.False(response.Success);
        Assert.Equal("Missing required fields", response.Message);
    }

    [Fact]
    public async Task Register_WithExistingUser_ShouldReturnBadRequest()
    {
        // Arrange
        var request = new RegisterRequest
        {
            GoogleId = "google-123",
            Email = "test@example.com",
            DisplayName = "Test User"
        };

        var existingUser = new User
        {
            Id = "user-123",
            GoogleId = "google-123",
            Email = "test@example.com",
            DisplayName = "Test User",
            CreatedAt = DateTime.UtcNow,
            ApiKeys = new List<ApiKey>()
        };

        _mockUserService.Setup(x => x.GetUserByGoogleIdAsync("google-123"))
            .ReturnsAsync(existingUser);

        // Act
        var result = await _controller.Register(request);

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
        var badRequestResult = result as BadRequestObjectResult;
        var response = badRequestResult.Value as DTOs.AuthResponse;
        Assert.False(response.Success);
        Assert.Equal("User already exists", response.Message);
    }

    [Fact]
    public async Task GetProfile_WithValidToken_ShouldReturnUserProfile()
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

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId)
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _controller.ControllerContext.HttpContext.User = principal;
        _mockUserService.Setup(x => x.GetUserByIdAsync(userId))
            .ReturnsAsync(user);

        // Act
        var result = await _controller.GetProfile();

        // Assert
        Assert.IsType<OkObjectResult>(result);
        var okResult = result as OkObjectResult;
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task GetProfile_WithInvalidUserId_ShouldReturnNotFound()
    {
        // Arrange
        var userId = "invalid-user";
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId)
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _controller.ControllerContext.HttpContext.User = principal;
        _mockUserService.Setup(x => x.GetUserByIdAsync(userId))
            .ReturnsAsync((User)null);

        // Act
        var result = await _controller.GetProfile();

        // Assert
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetProfile_WithoutUserId_ShouldReturnUnauthorized()
    {
        // Arrange
        var claims = new List<Claim>(); // No user ID claim
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _controller.ControllerContext.HttpContext.User = principal;

        // Act
        var result = await _controller.GetProfile();

        // Assert
        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task Logout_ShouldReturnOkResponse()
    {
        // Arrange
        var userId = "user-123";
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId)
        };
        var identity = new ClaimsIdentity(claims);
        var principal = new ClaimsPrincipal(identity);

        _controller.ControllerContext.HttpContext.User = principal;

        // Act
        var result = await _controller.Logout();

        // Assert
        Assert.IsType<OkObjectResult>(result);
        var okResult = result as OkObjectResult;
        var response = okResult.Value as DTOs.AuthResponse;
        Assert.True(response.Success);
        Assert.Equal("Logged out successfully", response.Message);
    }

    private void SetupAuthenticationResult(AuthenticateResult authResult)
    {
        var httpContext = _controller.ControllerContext.HttpContext;
        var serviceProviderMock = new Mock<IServiceProvider>();
        serviceProviderMock.Setup(x => x.GetService(typeof(IAuthenticationService)))
            .Returns(_mockAuthService.Object);
        httpContext.RequestServices = serviceProviderMock.Object;

        _mockAuthService.Setup(x => x.AuthenticateAsync(httpContext, null))
            .ReturnsAsync(authResult);
    }
}