// ============================================================================
// Program.cs - Updated with Google OAuth and MongoDB
// ============================================================================

using Azure.Identity;
using IncomeMeter.Api.Middleware;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
// 1. Configure Services
// Bind appsettings.json to a C# object
builder.Services.Configure<DatabaseSettings>(
    builder.Configuration.GetSection("DatabaseSettings"));

// Add services to the dependency injection container.
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IRouteService, RouteService>();
builder.Services.AddScoped<ILocationService, LocationService>();
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<IGeoCodingService, GeoCodingService>();

// Configure Key Vault for production
if (builder.Environment.IsProduction())
{
    var keyVaultUri = builder.Configuration["KeyVault:VaultUri"];
    if (!string.IsNullOrEmpty(keyVaultUri))
    {
        builder.Configuration.AddAzureKeyVault(
            new Uri(keyVaultUri),
            new DefaultAzureCredential());
    }
}

// Add services to the container
builder.Services.AddControllers();
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

builder.Services.AddScoped<MongoDbContext>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IGmailService, GmailService>();

// Configure CORS for development
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevelopmentPolicy", policy =>
    {
        policy.WithOrigins("https://localhost:7001", "http://localhost:5000")
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
});

// Configure JWT for API endpoints (dual auth support)
builder.Services.AddAuthentication()
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
    app.UseCors("DevelopmentPolicy");

    // Log development URLs for Google OAuth
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

// Add custom API key authentication middleware BEFORE UseAuthentication
app.UseMiddleware<ApiKeyAuthenticationMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();