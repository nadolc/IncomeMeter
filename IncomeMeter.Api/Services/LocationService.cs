using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using MongoDB.Driver;

namespace IncomeMeter.Api.Services;

public class LocationService : ILocationService
{
    private readonly IMongoCollection<Location> _locations;
    private readonly IRouteService _routeService;
    private readonly IGeoCodingService _geoCodingService;
    private const double MAX_DISTANCE_KM = 50;

    public LocationService(MongoDbContext context, IRouteService routeService, IGeoCodingService geoCodingService)
    {
        _locations = context.Locations;
        _routeService = routeService;
        _geoCodingService = geoCodingService;
    }

    public async Task<List<Location>> GetLocationsByRouteIdAsync(string routeId, string userId)
    {
        var route = await _routeService.GetRouteByIdAsync(routeId, userId);
        if (route == null)
        {
            return new List<Location>(); // Or throw exception
        }
        return await _locations.Find(l => l.RouteId == routeId).SortBy(l => l.Timestamp).ToListAsync();
    }

    public async Task<Location?> AddLocationAsync(CreateLocationDto dto, string userId)
    {
        var route = await _routeService.GetRouteByIdAsync(dto.RouteId, userId);
        if (route == null) return null; // User does not own this route

        var lastLocation = await _locations.Find(l => l.RouteId == dto.RouteId)
            .SortByDescending(l => l.Timestamp)
            .FirstOrDefaultAsync();

        double? distanceFromLast = null;
        if (lastLocation != null)
        {
            distanceFromLast = await _geoCodingService.GetDistanceInKmAsync(
                lastLocation.Latitude, lastLocation.Longitude, dto.Latitude, dto.Longitude);

            if (distanceFromLast > MAX_DISTANCE_KM)
            {
                throw new InvalidOperationException($"Location is too far from the previous point. Distance: {distanceFromLast}km.");
            }
        }

        var address = await _geoCodingService.GetAddressFromCoordinatesAsync(dto.Latitude, dto.Longitude);

        var newLocation = new Location
        {
            RouteId = dto.RouteId,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            Timestamp = dto.Timestamp,
            Accuracy = dto.Accuracy,
            Speed = dto.Speed,
            Address = address,
            DistanceFromLastKm = distanceFromLast
        };

        await _locations.InsertOneAsync(newLocation);
        return newLocation;
    }
}