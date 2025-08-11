using IncomeMeter.Api.Services;
using IncomeMeter.Api.Models;
using Microsoft.Extensions.Options;
using System.Text.Json;
using Serilog;

namespace IncomeMeter.Api.Services;

public class GeoCodingService : IGeoCodingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly GeocodingSettings _settings;
    private readonly ILogger<GeoCodingService> _logger;
    private readonly string? _openCageApiKey;
    private readonly string? _orsApiKey;

    public GeoCodingService(HttpClient httpClient, IConfiguration configuration, IOptions<GeocodingSettings> settings, ILogger<GeoCodingService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _settings = settings.Value;
        _logger = logger;
        
        // Get API keys from configuration (development or production)
        var isDevelopment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";
        var useKeyVault = configuration.GetValue<bool>("Development:UseKeyVault");
        
        if (isDevelopment && !useKeyVault)
        {
            _openCageApiKey = configuration["Development:OpenCageApiKey"];
            _orsApiKey = configuration["Development:OpenRouteServiceApiKey"];
        }
        else
        {
            _openCageApiKey = configuration["OpenCageApiKey"];
            _orsApiKey = configuration["OpenRouteServiceApiKey"];
        }

        _httpClient.DefaultRequestHeaders.Add("User-Agent", "IncomeMeter/1.0");
    }

    public async Task<string> GetAddressFromCoordinatesAsync(double latitude, double longitude)
    {
        if (string.IsNullOrEmpty(_openCageApiKey))
        {
            Log.Logger
                .ForContext("EventType", "GeocodingConfigError")
                .Warning("OpenCage API key not configured, using fallback address");
            return "Address not found (API key not configured)";
        }

        try
        {
            // Round coordinates to 6 decimal places as per requirement
            var roundedLat = Math.Round(latitude, _settings.CoordinatePrecision);
            var roundedLon = Math.Round(longitude, _settings.CoordinatePrecision);
            
            var url = $"{_settings.OpenCageBaseUrl}?q={roundedLat}+{roundedLon}&key={_openCageApiKey}";

            Log.Logger
                .ForContext("EventType", "ReverseGeocodingStarted")
                .ForContext("Latitude", roundedLat)
                .ForContext("Longitude", roundedLon)
                .Information("Starting reverse geocoding for coordinates");

            var response = await _httpClient.GetAsync(url);
            
            if (!response.IsSuccessStatusCode)
            {
                Log.Logger
                    .ForContext("EventType", "ReverseGeocodingError")
                    .ForContext("StatusCode", response.StatusCode)
                    .ForContext("ResponseContent", await response.Content.ReadAsStringAsync())
                    .Warning("Reverse geocoding API request failed");
                return "Address not found (API error)";
            }

            var content = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<OpenCageResponse>(content, new JsonSerializerOptions 
            { 
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
            });

            if (data?.Results?.Any() == true)
            {
                var address = data.Results.First().Formatted ?? "Address not found";
                
                Log.Logger
                    .ForContext("EventType", "ReverseGeocodingSuccess")
                    .ForContext("Latitude", roundedLat)
                    .ForContext("Longitude", roundedLon)
                    .ForContext("Address", address)
                    .Information("Reverse geocoding completed successfully");
                    
                return address;
            }

            return "Address not found";
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "ReverseGeocodingException")
                .ForContext("Latitude", latitude)
                .ForContext("Longitude", longitude)
                .Error(ex, "Exception occurred during reverse geocoding");
                
            return "Address not found (error)";
        }
    }

    public async Task<double> GetDistanceInKmAsync(double startLat, double startLon, double endLat, double endLon)
    {
        if (string.IsNullOrEmpty(_orsApiKey))
        {
            Log.Logger
                .ForContext("EventType", "DistanceCalculationFallback")
                .Information("ORS API key not configured, using geodesic distance calculation");
            return CalculateGeodesicDistance(startLat, startLon, endLat, endLon);
        }

        try
        {
            // Round coordinates to 6 decimal places as per requirement
            var roundedStartLat = Math.Round(startLat, _settings.CoordinatePrecision);
            var roundedStartLon = Math.Round(startLon, _settings.CoordinatePrecision);
            var roundedEndLat = Math.Round(endLat, _settings.CoordinatePrecision);
            var roundedEndLon = Math.Round(endLon, _settings.CoordinatePrecision);

            var coordinates = new[]
            {
                new[] { roundedStartLon, roundedStartLat },
                new[] { roundedEndLon, roundedEndLat }
            };

            var requestBody = new
            {
                coordinates = coordinates
            };

            Log.Logger
                .ForContext("EventType", "DrivingDistanceCalculationStarted")
                .ForContext("StartLat", roundedStartLat)
                .ForContext("StartLon", roundedStartLon)
                .ForContext("EndLat", roundedEndLat)
                .ForContext("EndLon", roundedEndLon)
                .Information("Starting ORS driving distance calculation");

            var jsonContent = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            using var content = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");
            content.Headers.Add("Authorization", $"Bearer {_orsApiKey}");

            var response = await _httpClient.PostAsync(_settings.OpenRouteServiceBaseUrl, content);
            
            if (!response.IsSuccessStatusCode)
            {
                Log.Logger
                    .ForContext("EventType", "DrivingDistanceCalculationFallback")
                    .ForContext("StatusCode", response.StatusCode)
                    .Warning("ORS API request failed, falling back to geodesic distance");
                return CalculateGeodesicDistance(startLat, startLon, endLat, endLon);
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<ORSResponse>(responseContent, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            if (data?.Routes?.Any() == true)
            {
                var distanceMeters = data.Routes.First().Summary.Distance;
                var distanceKm = distanceMeters / 1000.0;

                Log.Logger
                    .ForContext("EventType", "DrivingDistanceCalculationSuccess")
                    .ForContext("DistanceKm", distanceKm)
                    .ForContext("DistanceMeters", distanceMeters)
                    .Information("ORS driving distance calculation completed successfully");

                return Math.Round(distanceKm, 2);
            }

            Log.Logger
                .ForContext("EventType", "DrivingDistanceCalculationFallback")
                .Warning("ORS API returned no routes, falling back to geodesic distance");
            return CalculateGeodesicDistance(startLat, startLon, endLat, endLon);
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "DrivingDistanceCalculationException")
                .Error(ex, "Exception occurred during ORS distance calculation, falling back to geodesic");
            return CalculateGeodesicDistance(startLat, startLon, endLat, endLon);
        }
    }

    private double CalculateGeodesicDistance(double startLat, double startLon, double endLat, double endLon)
    {
        // Using Haversine formula for geodesic distance calculation
        var R = 6371; // Radius of the Earth in km
        var dLat = (endLat - startLat) * (Math.PI / 180);
        var dLon = (endLon - startLon) * (Math.PI / 180);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(startLat * (Math.PI / 180)) * Math.Cos(endLat * (Math.PI / 180)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        var distance = R * c;

        Log.Logger
            .ForContext("EventType", "GeodesicDistanceCalculated")
            .ForContext("DistanceKm", Math.Round(distance, 2))
            .Information("Geodesic distance calculated as fallback");

        return Math.Round(distance, 2);
    }
}

// DTOs for API responses
public class OpenCageResponse
{
    public OpenCageResult[]? Results { get; set; }
}

public class OpenCageResult
{
    public string? Formatted { get; set; }
}

public class ORSResponse
{
    public ORSRoute[]? Routes { get; set; }
}

public class ORSRoute
{
    public ORSSummary Summary { get; set; } = new();
}

public class ORSSummary
{
    public double Distance { get; set; }
    public double Duration { get; set; }
}