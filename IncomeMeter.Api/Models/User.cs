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
    public DateTime? LastLoginAt { get; set; }
    public string? ProfilePicture { get; set; }
    public bool TwoFactorEnabled { get; set; } = false;
    public TwoFactorAuth? TwoFactorAuth { get; set; }
    public List<RefreshToken> RefreshTokens { get; set; } = new();
    public List<ApiKey> ApiKeys { get; set; } = new();
    public List<ApiToken> ApiTokens { get; set; } = new(); // New JWT-based API tokens
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

/// <summary>
/// JWT-based API token with enhanced security features
/// </summary>
public class ApiToken
{
    /// <summary>
    /// Unique token identifier (JWT 'jti' claim)
    /// </summary>
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    /// <summary>
    /// SHA256 hash of the actual JWT token for validation
    /// </summary>
    public string TokenHash { get; set; } = null!;
    
    /// <summary>
    /// Refresh token ID for token renewal
    /// </summary>
    public string RefreshTokenId { get; set; } = null!;
    
    /// <summary>
    /// SHA256 hash of the refresh token
    /// </summary>
    public string RefreshTokenHash { get; set; } = null!;
    
    /// <summary>
    /// Human-readable description of the token's purpose
    /// </summary>
    public string Description { get; set; } = string.Empty;
    
    /// <summary>
    /// Scoped permissions for this token
    /// </summary>
    public List<string> Scopes { get; set; } = new();
    
    /// <summary>
    /// When the token was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// When the access token expires
    /// </summary>
    public DateTime ExpiresAt { get; set; }
    
    /// <summary>
    /// When the refresh token expires
    /// </summary>
    public DateTime RefreshExpiresAt { get; set; }
    
    /// <summary>
    /// Last time this token was used for API access
    /// </summary>
    public DateTime? LastUsedAt { get; set; }
    
    /// <summary>
    /// When the token was revoked (if applicable)
    /// </summary>
    public DateTime? RevokedAt { get; set; }
    
    /// <summary>
    /// Whether the token is currently active
    /// </summary>
    public bool IsActive { get; set; } = true;
    
    /// <summary>
    /// Number of times this token has been used
    /// </summary>
    public int UsageCount { get; set; } = 0;
    
    /// <summary>
    /// Last known IP address that used this token
    /// </summary>
    public string? LastUsedIp { get; set; }
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