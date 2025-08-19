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
}