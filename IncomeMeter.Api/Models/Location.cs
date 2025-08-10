// Location.cs
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace IncomeMeter.Api.Models;

public class Location
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.ObjectId)]
    public string RouteId { get; set; } = null!;

    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Address { get; set; }
    public double? Speed { get; set; }
    public double? Accuracy { get; set; }
    public double? DistanceFromLastKm { get; set; }
}