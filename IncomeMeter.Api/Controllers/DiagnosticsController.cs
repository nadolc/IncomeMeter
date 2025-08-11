using Microsoft.AspNetCore.Mvc;
using IncomeMeter.Api.Services;
using MongoDB.Driver;
using System.Reflection;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DiagnosticsController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private readonly IUserService _userService;
    private readonly MongoDbContext _mongoContext;

    public DiagnosticsController(
        IConfiguration configuration,
        IWebHostEnvironment environment,
        IUserService userService,
        MongoDbContext mongoContext)
    {
        _configuration = configuration;
        _environment = environment;
        _userService = userService;
        _mongoContext = mongoContext;
    }

    /// <summary>
    /// Test Azure Key Vault connectivity and secret retrieval
    /// GET /api/diagnostics/keyvault
    /// </summary>
    [HttpGet("keyvault")]
    public IActionResult TestKeyVault()
    {
        try
        {
            // Test retrieving secrets from Key Vault or local config
            var googleClientId = _configuration["GoogleClientId"];
            var googleClientSecret = _configuration["GoogleClientSecret"];
            var jwtSecret = _configuration["JwtSecret"];
            var mongoConnectionString = _configuration["MongoConnectionString"];
            var mongoDatabaseName = _configuration["MongoDatabaseName"];

            // Check if we're using Key Vault or local development settings
            var isUsingKeyVault = _environment.IsProduction() ||
                                 _configuration.GetValue<bool>("Development:UseKeyVault");

            var results = new
            {
                success = true,
                message = isUsingKeyVault ? "Key Vault configuration test" : "Local development configuration test",
                timestamp = DateTime.UtcNow,
                environment = _environment.EnvironmentName,
                keyVault = new
                {
                    isEnabled = isUsingKeyVault,
                    vaultUri = _configuration["KeyVault:VaultUri"],
                    azureAdTenantId = _configuration["AzureAd:TenantId"],
                    azureAdClientId = _configuration["AzureAd:ClientId"]
                },
                secrets = new
                {
                    googleClientId = new
                    {
                        isPresent = !string.IsNullOrEmpty(googleClientId),
                        preview = !string.IsNullOrEmpty(googleClientId)
                            ? $"{googleClientId.Substring(0, Math.Min(12, googleClientId.Length))}..."
                            : null,
                        length = googleClientId?.Length ?? 0
                    },
                    googleClientSecret = new
                    {
                        isPresent = !string.IsNullOrEmpty(googleClientSecret),
                        length = googleClientSecret?.Length ?? 0
                    },
                    jwtSecret = new
                    {
                        isPresent = !string.IsNullOrEmpty(jwtSecret),
                        length = jwtSecret?.Length ?? 0,
                        isValidLength = (jwtSecret?.Length ?? 0) >= 32
                    },
                    mongoConnectionString = new
                    {
                        isPresent = !string.IsNullOrEmpty(mongoConnectionString),
                        preview = !string.IsNullOrEmpty(mongoConnectionString)
                            ? $"{mongoConnectionString.Substring(0, Math.Min(20, mongoConnectionString.Length))}..."
                            : null
                    },
                    mongoDatabaseName = new
                    {
                        isPresent = !string.IsNullOrEmpty(mongoDatabaseName),
                        value = mongoDatabaseName // Safe to show database name
                    }
                },
                configurationSource = isUsingKeyVault ? "Azure Key Vault" : "Local Development Settings"
            };

            return Ok(results);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                error = ex.Message,
                innerException = ex.InnerException?.Message,
                environment = _environment.EnvironmentName,
                keyVaultUri = _configuration["KeyVault:VaultUri"],
                timestamp = DateTime.UtcNow
            });
        }
    }

    /// <summary>
    /// Test MongoDB connectivity
    /// GET /api/diagnostics/mongodb
    /// </summary>
    [HttpGet("mongodb")]
    public async Task<IActionResult> TestMongoDB()
    {
        try
        {
            // Test MongoDB connection
            var mongoClient = _mongoContext.Users.Database.Client;

            // Try to ping the database
            await mongoClient.GetDatabase("admin").RunCommandAsync<object>("{ ping: 1 }");

            // Get database stats
            var databaseName = _mongoContext.Users.Database.DatabaseNamespace.DatabaseName;
            var collections = await _mongoContext.Users.Database.ListCollectionNamesAsync();
            var collectionList = await collections.ToListAsync();

            // Count users (if collection exists)
            long userCount = 0;
            try
            {
                userCount = await _mongoContext.Users.CountDocumentsAsync(FilterDefinition<IncomeMeter.Api.Models.User>.Empty);
            }
            catch
            {
                // Collection might not exist yet
            }

            return Ok(new
            {
                success = true,
                message = "MongoDB connection successful",
                timestamp = DateTime.UtcNow,
                database = new
                {
                    name = databaseName,
                    collections = collectionList,
                    userCount = userCount
                },
                connectionString = new
                {
                    preview = GetMongoConnectionPreview(),
                    isPresent = !string.IsNullOrEmpty(_configuration["MongoConnectionString"])
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                error = ex.Message,
                innerException = ex.InnerException?.Message,
                timestamp = DateTime.UtcNow,
                connectionString = new
                {
                    preview = GetMongoConnectionPreview(),
                    isPresent = !string.IsNullOrEmpty(_configuration["MongoConnectionString"])
                }
            });
        }
    }

    /// <summary>
    /// Test Google OAuth configuration
    /// GET /api/diagnostics/google-oauth
    /// </summary>
    [HttpGet("google-oauth")]
    public IActionResult TestGoogleOAuth()
    {
        try
        {
            var googleClientId = _configuration["GoogleClientId"];
            var googleClientSecret = _configuration["GoogleClientSecret"];

            // Get current server URL for redirect URI validation
            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var expectedRedirectUri = $"{baseUrl}/signin-google";

            return Ok(new
            {
                success = true,
                message = "Google OAuth configuration test",
                timestamp = DateTime.UtcNow,
                environment = _environment.EnvironmentName,
                oauth = new
                {
                    clientId = new
                    {
                        isPresent = !string.IsNullOrEmpty(googleClientId),
                        preview = !string.IsNullOrEmpty(googleClientId)
                            ? $"{googleClientId.Substring(0, Math.Min(12, googleClientId.Length))}..."
                            : null
                    },
                    clientSecret = new
                    {
                        isPresent = !string.IsNullOrEmpty(googleClientSecret),
                        length = googleClientSecret?.Length ?? 0
                    },
                    redirectUri = expectedRedirectUri,
                    authEndpoint = $"{baseUrl}/api/auth/login",
                    scopes = new[]
                    {
                        "https://www.googleapis.com/auth/gmail.readonly",
                        "https://www.googleapis.com/auth/gmail.modify",
                        "https://www.googleapis.com/auth/userinfo.email",
                        "https://www.googleapis.com/auth/userinfo.profile"
                    }
                },
                instructions = new
                {
                    message = "Add this redirect URI to your Google OAuth settings:",
                    redirectUri = expectedRedirectUri,
                    googleConsoleUrl = "https://console.cloud.google.com/apis/credentials"
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                error = ex.Message,
                timestamp = DateTime.UtcNow
            });
        }
    }

    /// <summary>
    /// Basic health check
    /// GET /api/diagnostics/health
    /// </summary>
    [HttpGet("health")]
    public IActionResult HealthCheck()
    {
        return Ok(new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            environment = _environment.EnvironmentName,
            version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(),
            uptime = Environment.TickCount64 / 1000 / 60, // minutes
            dotnetVersion = Environment.Version.ToString()
        });
    }

    /// <summary>
    /// Show non-sensitive configuration information
    /// GET /api/diagnostics/config
    /// </summary>
    [HttpGet("config")]
    public IActionResult ConfigurationInfo()
    {
        var isUsingKeyVault = _environment.IsProduction() ||
                             _configuration.GetValue<bool>("Development:UseKeyVault");

        var config = new
        {
            timestamp = DateTime.UtcNow,
            environment = _environment.EnvironmentName,
            configuration = new
            {
                keyVault = new
                {
                    isEnabled = isUsingKeyVault,
                    vaultUri = _configuration["KeyVault:VaultUri"]
                },
                azureAd = new
                {
                    tenantId = _configuration["AzureAd:TenantId"],
                    clientId = _configuration["AzureAd:ClientId"]
                },
                development = _environment.IsDevelopment() ? new
                {
                    useKeyVault = _configuration.GetValue<bool>("Development:UseKeyVault"),
                    hasLocalGoogleClientId = !string.IsNullOrEmpty(_configuration["Development:GoogleClientId"]),
                    hasLocalGoogleClientSecret = !string.IsNullOrEmpty(_configuration["Development:GoogleClientSecret"]),
                    hasLocalJwtSecret = !string.IsNullOrEmpty(_configuration["Development:JwtSecret"]),
                    hasLocalMongoConnection = !string.IsNullOrEmpty(_configuration["Development:MongoConnectionString"])
                } : null
            },
            urls = new
            {
                baseUrl = $"{Request.Scheme}://{Request.Host}",
                swaggerUrl = _environment.IsDevelopment() ? $"{Request.Scheme}://{Request.Host}/swagger" : null,
                authLoginUrl = $"{Request.Scheme}://{Request.Host}/api/auth/login",
                googleCallbackUrl = $"{Request.Scheme}://{Request.Host}/signin-google"
            }
        };

        return Ok(config);
    }

    /// <summary>
    /// Run comprehensive system diagnostics
    /// GET /api/diagnostics/all
    /// </summary>
    [HttpGet("all")]
    public async Task<IActionResult> RunAllDiagnostics()
    {
        var results = new Dictionary<string, object>();

        try
        {
            // Health check
            results["health"] = new { status = "healthy", timestamp = DateTime.UtcNow };

            // Key Vault test
            try
            {
                var keyVaultTest = await Task.Run(() => TestKeyVault());
                if (keyVaultTest is OkObjectResult okResult)
                {
                    results["keyVault"] = okResult.Value!;
                }
                else
                {
                    results["keyVault"] = new { success = false, error = "Key Vault test failed" };
                }
            }
            catch (Exception ex)
            {
                results["keyVault"] = new { success = false, error = ex.Message };
            }

            // MongoDB test
            try
            {
                var mongoTest = await TestMongoDB();
                if (mongoTest is OkObjectResult okResult)
                {
                    results["mongoDB"] = okResult.Value!;
                }
                else
                {
                    results["mongoDB"] = new { success = false, error = "MongoDB test failed" };
                }
            }
            catch (Exception ex)
            {
                results["mongoDB"] = new { success = false, error = ex.Message };
            }

            // Google OAuth test
            try
            {
                var oauthTest = TestGoogleOAuth();
                if (oauthTest is OkObjectResult okResult)
                {
                    results["googleOAuth"] = okResult.Value!;
                }
                else
                {
                    results["googleOAuth"] = new { success = false, error = "Google OAuth test failed" };
                }
            }
            catch (Exception ex)
            {
                results["googleOAuth"] = new { success = false, error = ex.Message };
            }

            return Ok(new
            {
                success = true,
                message = "Comprehensive diagnostics completed",
                timestamp = DateTime.UtcNow,
                environment = _environment.EnvironmentName,
                results = results
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                error = ex.Message,
                timestamp = DateTime.UtcNow,
                partialResults = results
            });
        }
    }

    /// <summary>
    /// Test user service functionality (requires valid user in database)
    /// GET /api/diagnostics/user-service
    /// </summary>
    [HttpGet("user-service")]
    public async Task<IActionResult> TestUserService()
    {
        try
        {
            // Check if we're using InMemoryUserService (development mode)
            if (_userService is InMemoryUserService)
            {
                return Ok(new
                {
                    success = true,
                    message = "Using in-memory user service (development mode)",
                    timestamp = DateTime.UtcNow,
                    userService = new
                    {
                        type = "InMemoryUserService",
                        isConfigured = _userService != null,
                        note = "Authentication uses in-memory storage, MongoDB available for diagnostics"
                    }
                });
            }

            // Try to get the first user (if any exist) - for production mode
            var sampleUser = await _mongoContext.Users.Find(_ => true).FirstOrDefaultAsync();

            var result = new
            {
                success = true,
                message = "User service test completed",
                timestamp = DateTime.UtcNow,
                userService = new
                {
                    isConfigured = _userService != null,
                    sampleUserExists = sampleUser != null,
                    sampleUserInfo = sampleUser != null ? new
                    {
                        id = sampleUser.Id,
                        email = sampleUser.Email,
                        displayName = sampleUser.DisplayName,
                        apiKeysCount = sampleUser.ApiKeys.Count,
                        createdAt = sampleUser.CreatedAt
                    } : null,
                    totalUsersCount = await _mongoContext.Users.CountDocumentsAsync(_ => true)
                }
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                error = ex.Message,
                timestamp = DateTime.UtcNow
            });
        }
    }

    /// <summary>
    /// Helper method to safely preview MongoDB connection string
    /// </summary>
    private string? GetMongoConnectionPreview()
    {
        var connectionString = _configuration["MongoConnectionString"];
        if (string.IsNullOrEmpty(connectionString))
        {
            connectionString = _configuration["Development:MongoConnectionString"];
        }

        if (string.IsNullOrEmpty(connectionString))
            return null;

        // Show only the protocol and first part, hide sensitive info
        var uri = new Uri(connectionString);
        return $"{uri.Scheme}://{uri.Host}:{uri.Port}/...";
    }
}