// ============================================================================
// Program.cs - Updated with Google OAuth and MongoDB
// ============================================================================

using Azure.Identity;
using IncomeMeter.Api.Middleware;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.Services.Interfaces;
using Serilog;
using Serilog.Events;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Configuration.AzureKeyVault;
using Azure.Extensions.AspNetCore.Configuration.Secrets;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add startup logging
Console.WriteLine("=== IncomeMeter API Starting ===");
Console.WriteLine($"Environment: {builder.Environment.EnvironmentName}");
Console.WriteLine($"Content Root: {builder.Environment.ContentRootPath}");
Console.WriteLine($"Web Root: {builder.Environment.WebRootPath}");

// Configure Serilog early in the pipeline
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/incomemeter-.txt", rollingInterval: RollingInterval.Day)
    .CreateBootstrapLogger();

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Environment", context.HostingEnvironment.EnvironmentName)
    .Enrich.WithProperty("MachineName", Environment.MachineName)
    .Enrich.WithProperty("ProcessId", Environment.ProcessId)
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .WriteTo.File("logs/incomemeter-.txt", rollingInterval: RollingInterval.Day)
    .WriteTo.ApplicationInsights(services.GetRequiredService<Microsoft.ApplicationInsights.TelemetryClient>(), TelemetryConverter.Traces)
);
// 1. Configure Services
// Bind appsettings.json to C# objects (DatabaseSettings configured separately below)
builder.Services.Configure<GeocodingSettings>(
    builder.Configuration.GetSection("GeocodingSettings"));
builder.Services.Configure<AppSettings>(
    builder.Configuration.GetSection("AppSettings"));

// Add services to the dependency injection container.
// Always register MongoDbContext for diagnostics and testing
builder.Services.AddSingleton<MongoDbContext>();

if (builder.Environment.IsDevelopment())
{
    // Use MongoDB services in development now that ObjectId format is properly handled
    builder.Services.AddScoped<IUserService, UserService>();
    Console.WriteLine("Using MongoDB UserService for development with proper ObjectId format");
    
    // Register MongoDB-dependent services for development (needed for routes, etc.)
    builder.Services.AddScoped<IRouteService, RouteService>();
    builder.Services.AddScoped<ILocationService, LocationService>();
    builder.Services.AddScoped<ITransactionService, TransactionService>();
    builder.Services.AddScoped<IWorkTypeConfigService, WorkTypeConfigService>();
    // Phase 1: Register DefaultWorkTypeService and MigrationService for development
    builder.Services.AddScoped<DefaultWorkTypeService>();
    builder.Services.AddScoped<MigrationService>();
}
else
{
    // Production: Use full MongoDB services
    builder.Services.AddScoped<IUserService, UserService>();
    builder.Services.AddScoped<IRouteService, RouteService>();
    builder.Services.AddScoped<ILocationService, LocationService>();
    builder.Services.AddScoped<ITransactionService, TransactionService>();
    builder.Services.AddScoped<IWorkTypeConfigService, WorkTypeConfigService>();
}

// Phase 1: Register DefaultWorkTypeService and MigrationService (needed for both dev and prod)
builder.Services.AddScoped<DefaultWorkTypeService>();
builder.Services.AddScoped<MigrationService>();

builder.Services.AddHttpClient<IGeoCodingService, GeoCodingService>();

// Configure Key Vault for Azure deployment (both Development and Production)
// Use Key Vault when deployed to Azure or when explicitly configured to use it
var useKeyVault = builder.Configuration.GetValue<bool>("Development:UseKeyVault", false) || 
                  builder.Environment.IsProduction() ||
                  !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBSITE_SITE_NAME")); // Azure App Service indicator

if (useKeyVault)
{
    var keyVaultUri = builder.Configuration["KeyVault:VaultUri"];
    if (!string.IsNullOrEmpty(keyVaultUri))
    {
        try 
        {
            builder.Configuration.AddAzureKeyVault(new Uri(keyVaultUri), new DefaultAzureCredential());
            Console.WriteLine($"Key Vault configured successfully: {keyVaultUri}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to configure Key Vault: {ex.Message}");
            // Log but don't fail - fallback to local configuration
        }
    }
    else
    {
        Console.WriteLine("Key Vault URI not found in configuration");
    }
}

// Add Application Insights
builder.Services.AddApplicationInsightsTelemetry();

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowNamedFloatingPointLiterals;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();

// Add configuration endpoint for frontend
builder.Services.Configure<AppSettings>(builder.Configuration.GetSection("AppSettings"));

// Configure MongoDB connection string in DatabaseSettings
builder.Services.Configure<DatabaseSettings>(options =>
{
    var databaseSection = builder.Configuration.GetSection("DatabaseSettings");
    databaseSection.Bind(options);
    
    // Set connection string from appropriate source
    if (string.IsNullOrEmpty(options.ConnectionString))
    {
        if (useKeyVault)
        {
            // Try Key Vault first
            options.ConnectionString = builder.Configuration["MongoConnectionString"] ?? 
                                     builder.Configuration["DatabaseSettings:ConnectionString"];
        }
        else
        {
            // Use development configuration
            options.ConnectionString = builder.Configuration["Development:MongoConnectionString"] ?? 
                                     builder.Configuration["DatabaseSettings:ConnectionString"];
        }
    }
    
    Console.WriteLine($"MongoDB Connection configured: {!string.IsNullOrEmpty(options.ConnectionString)}");
    if (string.IsNullOrEmpty(options.ConnectionString))
    {
        Console.WriteLine("WARNING: MongoDB connection string is null or empty!");
    }
});

// Configure MongoDB client
builder.Services.AddSingleton<IMongoClient>(provider =>
{
    var dbSettings = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<DatabaseSettings>>().Value;
    if (string.IsNullOrEmpty(dbSettings.ConnectionString))
    {
        throw new InvalidOperationException("MongoDB connection string is not configured. Check Key Vault configuration and secrets.");
    }
    return new MongoClient(dbSettings.ConnectionString);
});

builder.Services.AddScoped<IGmailService, GmailService>();

// Configure CORS
builder.Services.AddCors(options =>
{
    var appSettings = builder.Configuration.GetSection("AppSettings").Get<AppSettings>() ?? new AppSettings();
    var allowedOrigins = appSettings.AllowedCorsOrigins?.Any() == true 
        ? appSettings.AllowedCorsOrigins 
        : new[] { "https://localhost:7001", "http://localhost:5000", "http://localhost:5173" }; // fallback for development
    
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Get configuration values
string googleClientId;
string googleClientSecret;
string jwtSecret;

if (builder.Environment.IsDevelopment() &&
    !builder.Configuration.GetValue<bool>("Development:UseKeyVault"))
{
    googleClientId = builder.Configuration["Development:GoogleClientId"]!;
    googleClientSecret = builder.Configuration["Development:GoogleClientSecret"]!;
    jwtSecret = builder.Configuration["Development:JwtSecret"]!;
}
else
{
    googleClientId = builder.Configuration["GoogleClientId"]!;
    googleClientSecret = builder.Configuration["GoogleClientSecret"]!;
    jwtSecret = builder.Configuration["JwtSecret"]!;
}

// Configure Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = GoogleDefaults.AuthenticationScheme;
})
.AddCookie(options =>
{
    options.LoginPath = "/api/auth/login";
    options.LogoutPath = "/api/auth/logout";
    options.Cookie.Name = "IncomeMeterAuth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
})
.AddGoogle(options =>
{
    options.ClientId = googleClientId;
    options.ClientSecret = googleClientSecret;
    options.SaveTokens = true;

    // Add Gmail scopes
    //options.Scope.Add("https://www.googleapis.com/auth/gmail.readonly");
    //options.Scope.Add("https://www.googleapis.com/auth/gmail.modify");
    options.Scope.Add("https://www.googleapis.com/auth/userinfo.email");
    options.Scope.Add("https://www.googleapis.com/auth/userinfo.profile");

    options.CallbackPath = "/signin-google";
})
// Add JWT Bearer to the existing authentication configuration  
.AddJwtBearer("Bearer", options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("CorsPolicy");

// Log development URLs for Google OAuth (development only)
if (app.Environment.IsDevelopment())
{
    app.Use(async (context, next) =>
    {
        if (context.Request.Path.StartsWithSegments("/swagger"))
        {
            var baseUrl = $"{context.Request.Scheme}://{context.Request.Host}";
            Console.WriteLine($"Development server running at: {baseUrl}");
            Console.WriteLine($"Add this to Google OAuth redirect URIs: {baseUrl}/signin-google");
        }
        await next();
    });
}

app.UseHttpsRedirection();

// Add global exception handling middleware (should be early in pipeline)
app.UseMiddleware<GlobalExceptionMiddleware>();

// Add custom API key authentication middleware EARLY - before logging
app.UseMiddleware<ApiKeyAuthenticationMiddleware>();

// Add request logging middleware
app.UseMiddleware<RequestLoggingMiddleware>();

// Add security logging middleware
app.UseMiddleware<SecurityLoggingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

// Enable static file serving for React frontend
app.UseStaticFiles();

// Expose configuration to frontend
app.MapGet("/api/config", (IConfiguration config) => new
{
    ApiBaseUrl = config["AppSettings:ApiBaseUrl"],
    FrontendBaseUrl = config["AppSettings:FrontendBaseUrl"]
});

// Phase 1: Development endpoints for testing default work types
if (app.Environment.IsDevelopment())
{
    app.MapGet("/api/dev/test-default-worktypes", async (MigrationService migrationService) =>
    {
        var result = await migrationService.TestDefaultWorkTypeAssignmentAsync();
        return Results.Ok(new { success = result, message = result ? "Default work types test passed" : "Default work types test failed" });
    });

    app.MapPost("/api/dev/migrate-users-phase1", async (MigrationService migrationService) =>
    {
        try
        {
            await migrationService.MigrateExistingUsersToPhase1Async();
            return Results.Ok(new { success = true, message = "Phase 1 migration completed successfully" });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { success = false, message = $"Migration failed: {ex.Message}" });
        }
    });
}

// Map API controllers
app.MapControllers();

// SPA fallback for React routing - this must be LAST
app.MapFallbackToFile("index.html");

Console.WriteLine("=== IncomeMeter API Started Successfully ===");
Console.WriteLine($"Listening on: {string.Join(", ", builder.Configuration.GetValue<string>("ASPNETCORE_URLS")?.Split(';') ?? new[] { "http://localhost:5000" })}");

app.Run();

// Make Program class accessible for integration testing
public partial class Program { }