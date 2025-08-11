using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Serilog;

namespace IncomeMeter.Api.Services;

public class LocationService : ILocationService
{
    private readonly IMongoCollection<Location> _locations;
    private readonly IRouteService _routeService;
    private readonly IGeoCodingService _geoCodingService;
    private readonly GeocodingSettings _settings;
    private readonly ILogger<LocationService> _logger;

    public LocationService(MongoDbContext context, IRouteService routeService, IGeoCodingService geoCodingService, IOptions<GeocodingSettings> settings, ILogger<LocationService> logger)
    {
        _locations = context.Locations;
        _routeService = routeService;
        _geoCodingService = geoCodingService;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<List<Location>> GetLocationsByRouteIdAsync(string routeId, string userId)
    {
        var correlationId = Guid.NewGuid().ToString("N")[..8];
        
        Log.Logger
            .ForContext("EventType", "LocationRetrievalStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .Information("Starting location retrieval for route");

        var route = await _routeService.GetRouteByIdAsync(routeId, userId);
        if (route == null)
        {
            Log.Logger
                .ForContext("EventType", "LocationRetrievalUnauthorized")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Warning("Route not found or user unauthorized for location retrieval");
            return new List<Location>();
        }
        
        var locations = await _locations.Find(l => l.RouteId == routeId).SortBy(l => l.Timestamp).ToListAsync();
        
        Log.Logger
            .ForContext("EventType", "LocationRetrievalSuccess")
            .ForContext("CorrelationId", correlationId)
            .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
            .ForContext("LocationCount", locations.Count)
            .Information("Locations retrieved successfully");
            
        return locations;
    }

    public async Task<Location?> AddLocationAsync(CreateLocationDto dto, string userId)
    {
        var correlationId = Guid.NewGuid().ToString("N")[..8];
        
        Log.Logger
            .ForContext("EventType", "LocationAdditionStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("RouteId", dto.RouteId[..Math.Min(8, dto.RouteId.Length)] + "***")
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .Information("Starting location addition");

        // 1. Verify the route exists and belongs to the authenticated user
        var route = await _routeService.GetRouteByIdAsync(dto.RouteId, userId);
        if (route == null)
        {
            Log.Logger
                .ForContext("EventType", "LocationAdditionUnauthorized")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RouteId", dto.RouteId[..Math.Min(8, dto.RouteId.Length)] + "***")
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Warning("Route not found or user unauthorized for location addition");
            return null;
        }

        // Round GPS coordinates to 6 decimal places as per requirement
        var roundedLatitude = Math.Round(dto.Latitude, _settings.CoordinatePrecision);
        var roundedLongitude = Math.Round(dto.Longitude, _settings.CoordinatePrecision);

        Log.Logger
            .ForContext("EventType", "LocationCoordinatesRounded")
            .ForContext("CorrelationId", correlationId)
            .ForContext("OriginalLat", dto.Latitude)
            .ForContext("OriginalLon", dto.Longitude)
            .ForContext("RoundedLat", roundedLatitude)
            .ForContext("RoundedLon", roundedLongitude)
            .ForContext("Precision", _settings.CoordinatePrecision)
            .Information("GPS coordinates rounded to {Precision} decimal places", _settings.CoordinatePrecision);

        var now = DateTime.UtcNow;
        var newLocation = new Location
        {
            RouteId = dto.RouteId,
            UserId = userId,
            Latitude = roundedLatitude,
            Longitude = roundedLongitude,
            Timestamp = dto.Timestamp,
            Accuracy = dto.Accuracy,
            Speed = dto.Speed,
            Address = await _geoCodingService.GetAddressFromCoordinatesAsync(roundedLatitude, roundedLongitude)
        };

        // 2. Find the previous location to calculate distance (following JavaScript sample logic)
        var lastLocation = await _locations.Find(l => l.RouteId == dto.RouteId)
            .SortByDescending(l => l.Timestamp)
            .FirstOrDefaultAsync();

        if (lastLocation != null)
        {
            Log.Logger
                .ForContext("EventType", "PreviousLocationFound")
                .ForContext("CorrelationId", correlationId)
                .ForContext("PreviousLocationId", lastLocation.Id?[..Math.Min(8, lastLocation.Id.Length)] + "***")
                .Information("Previous location found, calculating distance");

            var distanceKm = await _geoCodingService.GetDistanceInKmAsync(
                lastLocation.Latitude, lastLocation.Longitude, 
                newLocation.Latitude, newLocation.Longitude);

            if (distanceKm > _settings.MaxDistanceKm)
            {
                Log.Logger
                    .ForContext("EventType", "LocationDistanceValidationFailed")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("DistanceKm", distanceKm)
                    .ForContext("MaxDistanceKm", _settings.MaxDistanceKm)
                    .Warning("Location too far from previous point");

                throw new InvalidOperationException(
                    $"Location is too far from the previous point. Distance: {distanceKm:F2}km. Maximum allowed: {_settings.MaxDistanceKm}km.");
            }

            // Store both kilometers and miles (following JavaScript sample logic)
            newLocation.DistanceFromLastKm = Math.Round(distanceKm, 2);
            newLocation.DistanceFromLastMi = Math.Round(distanceKm * 0.621371, 2); // Convert km to miles

            Log.Logger
                .ForContext("EventType", "LocationDistanceCalculated")
                .ForContext("CorrelationId", correlationId)
                .ForContext("DistanceKm", newLocation.DistanceFromLastKm)
                .ForContext("DistanceMi", newLocation.DistanceFromLastMi)
                .Information("Distance calculated and stored in both kilometers and miles");
        }
        else
        {
            Log.Logger
                .ForContext("EventType", "FirstLocationForRoute")
                .ForContext("CorrelationId", correlationId)
                .Information("This is the first location for this route, no distance calculation needed");
        }

        // 3. Insert the new location
        try
        {
            await _locations.InsertOneAsync(newLocation);

            Log.Logger
                .ForContext("EventType", "LocationAdditionSuccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("LocationId", newLocation.Id?[..Math.Min(8, newLocation.Id.Length)] + "***")
                .ForContext("RouteId", dto.RouteId[..Math.Min(8, dto.RouteId.Length)] + "***")
                .ForContext("Latitude", roundedLatitude)
                .ForContext("Longitude", roundedLongitude)
                .ForContext("Address", newLocation.Address?[..Math.Min(50, newLocation.Address.Length)])
                .Information("Location added successfully");

            return newLocation;
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationAdditionFailed")
                .ForContext("CorrelationId", correlationId)
                .Error(ex, "Failed to insert location into database");
            throw;
        }
    }
}