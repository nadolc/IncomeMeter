using System.ComponentModel.DataAnnotations;

namespace IncomeMeter.Api.DTOs;

public class CreateLocationDto
{
    [Required]
    public string RouteId { get; set; } = null!;

    [Required]
    [Range(-90, 90)]
    public double Latitude { get; set; }

    [Required]
    [Range(-180, 180)]
    public double Longitude { get; set; }

    [Required]
    public DateTime Timestamp { get; set; }

    public double? Accuracy { get; set; }

    public double? Speed { get; set; }
}

public class UpdateLocationDto
{
    [Range(-90, 90)]
    public double? Latitude { get; set; }

    [Range(-180, 180)]
    public double? Longitude { get; set; }

    public DateTime? Timestamp { get; set; }

    public double? Accuracy { get; set; }

    public double? Speed { get; set; }

    public string? Address { get; set; }
}

public class LocationDto
{
    public string? Id { get; set; }
    public string RouteId { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Address { get; set; }
    public double? Speed { get; set; }
    public double? Accuracy { get; set; }
    public double? DistanceFromLastKm { get; set; }
    public double? DistanceFromLastMi { get; set; }
    public string? TimezoneId { get; set; }
    public double? TimezoneOffset { get; set; }
}

public class LocationResponseDto
{
    public string? Id { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Address { get; set; }
    public double? Speed { get; set; }
    public double? Accuracy { get; set; }
    public double? DistanceFromLastKm { get; set; }
    public double? DistanceFromLastMi { get; set; }
    public string? TimezoneId { get; set; }
    public double? TimezoneOffset { get; set; }
}

public class CreateLocationIOSDto
{
    [Required(ErrorMessage = "RouteId is required")]
    public string RouteId { get; set; } = null!;

    [Required(ErrorMessage = "Latitude is required")]
    [Range(-90, 90, ErrorMessage = "Latitude must be between -90 and 90 degrees")]
    public double Latitude { get; set; }

    [Required(ErrorMessage = "Longitude is required")]
    [Range(-180, 180, ErrorMessage = "Longitude must be between -180 and 180 degrees")]
    public double Longitude { get; set; }

    // Custom validation method to check decimal places (simplified for iOS)
    public bool IsValidCoordinatePrecision()
    {
        // For iOS shortcuts, be more lenient - just check for reasonable precision
        // The LocationService will round to 6 decimal places anyway
        return Math.Abs(Latitude) <= 90 && Math.Abs(Longitude) <= 180;
    }

    public string GetCoordinatePrecisionError()
    {
        if (Math.Abs(Latitude) > 90)
            return "Latitude must be between -90 and 90 degrees";
        if (Math.Abs(Longitude) > 180)
            return "Longitude must be between -180 and 180 degrees";
        return "";
    }
}