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

    public async Task<Location?> AddLocationFromIOSAsync(CreateLocationIOSDto dto, string userId)
    {
        var correlationId = Guid.NewGuid().ToString("N")[..8];
        
        Log.Logger
            .ForContext("EventType", "LocationAdditionIOSStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("RouteId", dto.RouteId[..Math.Min(8, dto.RouteId.Length)] + "***")
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .Information("Starting iOS location addition with automatic timestamp");

        // Convert iOS DTO to full CreateLocationDto with current timestamp
        var createLocationDto = new CreateLocationDto
        {
            RouteId = dto.RouteId,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            Timestamp = DateTime.UtcNow, // Automatically set to current time
            Accuracy = null, // iOS will provide basic coordinates only
            Speed = null     // iOS will provide basic coordinates only
        };

        Log.Logger
            .ForContext("EventType", "LocationIOSConversion")
            .ForContext("CorrelationId", correlationId)
            .ForContext("AutoTimestamp", createLocationDto.Timestamp)
            .Information("iOS location converted to full DTO with timestamp: {AutoTimestamp}", createLocationDto.Timestamp);

        // Use the existing AddLocationAsync method which handles:
        // - Route ownership verification
        // - Address resolution via geocoding
        // - Distance calculation from last location (DistanceFromLastKm, DistanceFromLastMi)
        // - GPS coordinate rounding
        // - Database insertion
        return await AddLocationAsync(createLocationDto, userId);
    }

    public async Task<Location?> GetLocationByIdAsync(string id, string userId)
    {
        var correlationId = Guid.NewGuid().ToString("N")[..8];
        
        Log.Logger
            .ForContext("EventType", "LocationRetrievalByIdStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .Information("Starting location retrieval by ID");

        var location = await _locations.Find(l => l.Id == id && l.UserId == userId).FirstOrDefaultAsync();
        
        if (location == null)
        {
            Log.Logger
                .ForContext("EventType", "LocationNotFound")
                .ForContext("CorrelationId", correlationId)
                .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Warning("Location not found or user unauthorized");
        }
        else
        {
            Log.Logger
                .ForContext("EventType", "LocationRetrievalByIdSuccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                .Information("Location retrieved successfully by ID");
        }
        
        return location;
    }

    public async Task<Location?> UpdateLocationAsync(string id, UpdateLocationDto dto, string userId)
    {
        var correlationId = Guid.NewGuid().ToString("N")[..8];
        
        Log.Logger
            .ForContext("EventType", "LocationUpdateStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .Information("Starting location update");

        // First, verify the location exists and belongs to the user
        var existingLocation = await GetLocationByIdAsync(id, userId);
        if (existingLocation == null)
        {
            Log.Logger
                .ForContext("EventType", "LocationUpdateUnauthorized")
                .ForContext("CorrelationId", correlationId)
                .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Warning("Location not found or user unauthorized for update");
            return null;
        }

        // Build update definition
        var updateBuilder = Builders<Location>.Update;
        var updates = new List<UpdateDefinition<Location>>();

        if (dto.Latitude.HasValue)
        {
            var roundedLatitude = Math.Round(dto.Latitude.Value, _settings.CoordinatePrecision);
            updates.Add(updateBuilder.Set(l => l.Latitude, roundedLatitude));
        }

        if (dto.Longitude.HasValue)
        {
            var roundedLongitude = Math.Round(dto.Longitude.Value, _settings.CoordinatePrecision);
            updates.Add(updateBuilder.Set(l => l.Longitude, roundedLongitude));
        }

        if (dto.Timestamp.HasValue)
            updates.Add(updateBuilder.Set(l => l.Timestamp, dto.Timestamp.Value));

        if (dto.Accuracy.HasValue)
            updates.Add(updateBuilder.Set(l => l.Accuracy, dto.Accuracy.Value));

        if (dto.Speed.HasValue)
            updates.Add(updateBuilder.Set(l => l.Speed, dto.Speed.Value));

        if (!string.IsNullOrEmpty(dto.Address))
            updates.Add(updateBuilder.Set(l => l.Address, dto.Address));

        if (updates.Count == 0)
        {
            Log.Logger
                .ForContext("EventType", "LocationUpdateNoChanges")
                .ForContext("CorrelationId", correlationId)
                .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                .Information("No changes detected for location update");
            return existingLocation;
        }

        // If coordinates changed, recalculate address and distances
        if (dto.Latitude.HasValue || dto.Longitude.HasValue)
        {
            var newLat = dto.Latitude ?? existingLocation.Latitude;
            var newLon = dto.Longitude ?? existingLocation.Longitude;
            
            var address = await _geoCodingService.GetAddressFromCoordinatesAsync(newLat, newLon);
            updates.Add(updateBuilder.Set(l => l.Address, address));

            // Recalculate distance from previous location if coordinates changed
            var previousLocation = await _locations.Find(l => l.RouteId == existingLocation.RouteId && l.Timestamp < existingLocation.Timestamp)
                .SortByDescending(l => l.Timestamp)
                .FirstOrDefaultAsync();

            if (previousLocation != null)
            {
                var distanceKm = await _geoCodingService.GetDistanceInKmAsync(
                    previousLocation.Latitude, previousLocation.Longitude, newLat, newLon);

                updates.Add(updateBuilder.Set(l => l.DistanceFromLastKm, Math.Round(distanceKm, 2)));
                updates.Add(updateBuilder.Set(l => l.DistanceFromLastMi, Math.Round(distanceKm * 0.621371, 2)));
            }
        }

        try
        {
            var filter = Builders<Location>.Filter.And(
                Builders<Location>.Filter.Eq(l => l.Id, id),
                Builders<Location>.Filter.Eq(l => l.UserId, userId)
            );

            var combinedUpdate = updateBuilder.Combine(updates);
            var result = await _locations.FindOneAndUpdateAsync(filter, combinedUpdate,
                new FindOneAndUpdateOptions<Location> { ReturnDocument = ReturnDocument.After });

            if (result != null)
            {
                Log.Logger
                    .ForContext("EventType", "LocationUpdateSuccess")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                    .Information("Location updated successfully");
            }

            return result;
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationUpdateFailed")
                .ForContext("CorrelationId", correlationId)
                .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                .Error(ex, "Failed to update location in database");
            throw;
        }
    }

    public async Task<bool> DeleteLocationAsync(string id, string userId)
    {
        var correlationId = Guid.NewGuid().ToString("N")[..8];
        
        Log.Logger
            .ForContext("EventType", "LocationDeletionStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .Information("Starting location deletion");

        try
        {
            var filter = Builders<Location>.Filter.And(
                Builders<Location>.Filter.Eq(l => l.Id, id),
                Builders<Location>.Filter.Eq(l => l.UserId, userId)
            );

            var result = await _locations.DeleteOneAsync(filter);
            var success = result.DeletedCount > 0;

            if (success)
            {
                Log.Logger
                    .ForContext("EventType", "LocationDeletionSuccess")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                    .Information("Location deleted successfully");
            }
            else
            {
                Log.Logger
                    .ForContext("EventType", "LocationDeletionFailed")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                    .Warning("Location not found or user unauthorized for deletion");
            }

            return success;
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationDeletionError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                .Error(ex, "Error occurred during location deletion");
            throw;
        }
    }

    public async Task<bool> DeleteLocationsByRouteIdAsync(string routeId, string userId)
    {
        var correlationId = Guid.NewGuid().ToString("N")[..8];
        
        Log.Logger
            .ForContext("EventType", "LocationsBulkDeletionStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .Information("Starting bulk deletion of locations for route");

        // First verify the route belongs to the user
        var route = await _routeService.GetRouteByIdAsync(routeId, userId);
        if (route == null)
        {
            Log.Logger
                .ForContext("EventType", "LocationsBulkDeletionUnauthorized")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Warning("Route not found or user unauthorized for bulk location deletion");
            return false;
        }

        try
        {
            var filter = Builders<Location>.Filter.And(
                Builders<Location>.Filter.Eq(l => l.RouteId, routeId),
                Builders<Location>.Filter.Eq(l => l.UserId, userId)
            );

            var result = await _locations.DeleteManyAsync(filter);

            Log.Logger
                .ForContext("EventType", "LocationsBulkDeletionSuccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
                .ForContext("DeletedCount", result.DeletedCount)
                .Information("Bulk deletion of locations completed successfully");

            return result.DeletedCount > 0;
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationsBulkDeletionError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
                .Error(ex, "Error occurred during bulk location deletion");
            throw;
        }
    }
}