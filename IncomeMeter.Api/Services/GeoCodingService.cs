using IncomeMeter.Api.Services;

namespace IncomeMeter.Api.Services;

public class GeoCodingService : IGeoCodingService
{
    public GeoCodingService(IConfiguration configuration)
    {
        // In a real app, you would get the API key here:
        // var apiKey = configuration["GeoCodingSettings:ApiKey"];
    }

    public Task<string> GetAddressFromCoordinatesAsync(double latitude, double longitude)
    {
        // Placeholder: In a real app, call Azure Maps Reverse Geocode API here
        return Task.FromResult("Address not found (Geocoding not implemented)");
    }

    public Task<double> GetDistanceInKmAsync(double startLat, double startLon, double endLat, double endLon)
    {
        // Placeholder: In a real app, call Azure Maps Route Matrix API for driving distance
        // For now, using a simple spherical law of cosines calculation.
        var R = 6371; // Radius of the Earth in km
        var dLat = (endLat - startLat) * (Math.PI / 180);
        var dLon = (endLon - startLon) * (Math.PI / 180);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(startLat * (Math.PI / 180)) * Math.Cos(endLat * (Math.PI / 180)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        var distance = R * c;
        return Task.FromResult(distance);
    }
}