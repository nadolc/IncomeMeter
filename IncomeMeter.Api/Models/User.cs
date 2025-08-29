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
    
    // Phase 1: Default work types support
    public List<string> AssignedWorkTypeIds { get; set; } = new();
    public UserRole Role { get; set; } = UserRole.Member;
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
    public string TimeZone { get; set; } = "Europe/London";
    public string DateFormat { get; set; } = "dd/MM/yyyy";
    public bool EmailNotifications { get; set; } = true;
    public bool PushNotifications { get; set; } = true;
    public string DefaultChartPeriod { get; set; } = "7days";
    public bool ShowWeekends { get; set; } = true;
    public string MileageUnit { get; set; } = "km";
}

public enum UserRole
{
    Member = 0,      // Regular user
    Admin = 1,       // Organization admin (future)
    SuperAdmin = 2   // System admin (future)
}