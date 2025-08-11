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
    [BsonElement("routeId")]
    public string RouteId { get; set; } = null!;

    [BsonRepresentation(BsonType.ObjectId)]
    [BsonElement("userId")]
    public string UserId { get; set; } = null!;
    
    [BsonElement("latitude")]
    public double Latitude { get; set; }
    
    [BsonElement("longitude")]
    public double Longitude { get; set; }
    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; }
    [BsonElement("address")]
    public string? Address { get; set; }
    public double? Speed { get; set; }
    public double? Accuracy { get; set; }
    [BsonElement("distanceFromLast")]
    public double? DistanceFromLastKm { get; set; }
    
    [BsonElement("distanceFromLastMi")]
    public double? DistanceFromLastMi { get; set; }
}