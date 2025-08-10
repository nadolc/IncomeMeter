namespace IncomeMeter.Api.Services;

public interface IGeoCodingService
{
    Task<string> GetAddressFromCoordinatesAsync(double latitude, double longitude); // Returns a formatted address string
    Task<double> GetDistanceInKmAsync(double startLat, double startLon, double endLat, double endLon);  // Returns distance in kilometers
}