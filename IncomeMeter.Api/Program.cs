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
// Bind appsettings.json to C# objects
builder.Services.Configure<DatabaseSettings>(
    builder.Configuration.GetSection("DatabaseSettings"));
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
}
else
{
    // Production: Use full MongoDB services
    builder.Services.AddScoped<IUserService, UserService>();
    builder.Services.AddScoped<IRouteService, RouteService>();
    builder.Services.AddScoped<ILocationService, LocationService>();
    builder.Services.AddScoped<ITransactionService, TransactionService>();
}

builder.Services.AddHttpClient<IGeoCodingService, GeoCodingService>();

// Configure Key Vault for production
if (builder.Environment.IsProduction())
{
    var keyVaultUri = builder.Configuration["KeyVault:VaultUri"];
    if (!string.IsNullOrEmpty(keyVaultUri))
    {
        // Replace this block:
        // builder.Configuration.AddAzureKeyVault(
        //     new Uri(keyVaultUri),
        //     new DefaultAzureCredential());
        // builder.Configuration.AddAzureKeyVault(keyVaultUri, new DefaultAzureCredential());

        // With this block:
        builder.Configuration.AddAzureKeyVault(new Uri(keyVaultUri), new DefaultAzureCredential());

        Console.WriteLine(builder.Configuration["GoogleClientId"]);
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

// Configure MongoDB
builder.Services.AddSingleton<IMongoClient>(provider =>
{
    var connectionString = builder.Environment.IsDevelopment() &&
                          !builder.Configuration.GetValue<bool>("Development:UseKeyVault")
        ? builder.Configuration["Development:MongoConnectionString"]
        : builder.Configuration["MongoConnectionString"];
    return new MongoClient(connectionString);
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
    options.Scope.Add("https://www.googleapis.com/auth/gmail.readonly");
    options.Scope.Add("https://www.googleapis.com/auth/gmail.modify");
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

// Add request logging middleware
app.UseMiddleware<RequestLoggingMiddleware>();

// Add security logging middleware
app.UseMiddleware<SecurityLoggingMiddleware>();

// Add custom API key authentication middleware BEFORE UseAuthentication
app.UseMiddleware<ApiKeyAuthenticationMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();