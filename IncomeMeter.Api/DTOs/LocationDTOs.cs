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

public class LocationDto
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}