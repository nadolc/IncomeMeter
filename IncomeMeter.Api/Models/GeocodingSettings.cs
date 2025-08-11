namespace IncomeMeter.Api.Models;

public class GeocodingSettings
{
    public double MaxDistanceKm { get; set; } = 50;
    public int CoordinatePrecision { get; set; } = 6;
    public string OpenCageBaseUrl { get; set; } = "https://api.opencagedata.com/geocode/v1/json";
    public string OpenRouteServiceBaseUrl { get; set; } = "https://api.openrouteservice.org/v2/directions/driving-car";
}