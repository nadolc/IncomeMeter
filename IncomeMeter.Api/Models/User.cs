using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace IncomeMeter.Api.Models;

public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string GoogleId { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<ApiKey> ApiKeys { get; set; } = new();
    public UserSettings Settings { get; set; } = new();
}

public class ApiKey
{
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string KeyHash { get; set; } = null!;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class UserSettings
{
    public string Language { get; set; } = "en-GB";
    public string CurrencyCode { get; set; } = "GBP";
    // ... other settings fields from your User.js model
}