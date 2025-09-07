using System.ComponentModel.DataAnnotations;

namespace IncomeMeter.Api.DTOs;

/// <summary>
/// Request to generate a new API token
/// </summary>
public class ApiTokenRequest
{
    /// <summary>
    /// Description of what this token will be used for
    /// </summary>
    [Required]
    [StringLength(200, MinimumLength = 3)]
    public string Description { get; set; } = null!;
    
    /// <summary>
    /// Requested scopes for the token. If empty, default scopes will be granted.
    /// </summary>
    public string[] Scopes { get; set; } = Array.Empty<string>();
    
    /// <summary>
    /// Number of days until token expires. If null, defaults to 365 days.
    /// Maximum allowed is 730 days (2 years).
    /// </summary>
    [Range(1, 730)]
    public int? ExpiryDays { get; set; }
    
    /// <summary>
    /// Whether to generate a refresh token for automatic renewal
    /// </summary>
    public bool GenerateRefreshToken { get; set; } = true;
}

/// <summary>
/// Response containing the generated API token
/// </summary>
public class ApiTokenResponse
{
    /// <summary>
    /// The JWT access token to use in API requests
    /// </summary>
    public string AccessToken { get; set; } = null!;
    
    /// <summary>
    /// Refresh token for renewing the access token
    /// </summary>
    public string? RefreshToken { get; set; }
    
    /// <summary>
    /// Token type (always "Bearer")
    /// </summary>
    public string TokenType { get; set; } = "Bearer";
    
    /// <summary>
    /// Number of seconds until the access token expires
    /// </summary>
    public int ExpiresIn { get; set; }
    
    /// <summary>
    /// Exact expiration date/time
    /// </summary>
    public DateTime ExpiresAt { get; set; }
    
    /// <summary>
    /// Scopes granted to this token
    /// </summary>
    public string[] Scopes { get; set; } = Array.Empty<string>();
    
    /// <summary>
    /// Unique identifier for this token (for revocation)
    /// </summary>
    public string TokenId { get; set; } = null!;
    
    /// <summary>
    /// Description of the token
    /// </summary>
    public string Description { get; set; } = null!;
}

/// <summary>
/// Request to refresh an access token
/// </summary>
public class RefreshTokenRequest
{
    /// <summary>
    /// The refresh token
    /// </summary>
    [Required]
    public string RefreshToken { get; set; } = null!;
}

/// <summary>
/// Information about an existing API token
/// </summary>
public class ApiTokenInfo
{
    /// <summary>
    /// Unique token identifier
    /// </summary>
    public string TokenId { get; set; } = null!;
    
    /// <summary>
    /// Description of the token
    /// </summary>
    public string Description { get; set; } = null!;
    
    /// <summary>
    /// Scopes granted to this token
    /// </summary>
    public string[] Scopes { get; set; } = Array.Empty<string>();
    
    /// <summary>
    /// When the token was created
    /// </summary>
    public DateTime CreatedAt { get; set; }
    
    /// <summary>
    /// When the token expires
    /// </summary>
    public DateTime ExpiresAt { get; set; }
    
    /// <summary>
    /// Last time the token was used
    /// </summary>
    public DateTime? LastUsedAt { get; set; }
    
    /// <summary>
    /// Number of times the token has been used
    /// </summary>
    public int UsageCount { get; set; }
    
    /// <summary>
    /// Number of days until token expires (calculated field)
    /// </summary>
    public int DaysUntilExpiry { get; set; }
    
    /// <summary>
    /// Whether the token is close to expiring (within 30 days)
    /// </summary>
    public bool IsNearExpiry => DaysUntilExpiry <= 30;
    
    /// <summary>
    /// Whether the token has expired
    /// </summary>
    public bool IsExpired => DaysUntilExpiry <= 0;
    
    /// <summary>
    /// Last known IP address that used this token
    /// </summary>
    public string? LastUsedIp { get; set; }
}

/// <summary>
/// Request to revoke a token
/// </summary>
public class RevokeTokenRequest
{
    /// <summary>
    /// The token ID to revoke
    /// </summary>
    [Required]
    public string TokenId { get; set; } = null!;
}

/// <summary>
/// Available API scopes for token generation
/// </summary>
public static class ApiScopes
{
    // Routes permissions
    public const string ReadRoutes = "read:routes";
    public const string WriteRoutes = "write:routes";
    public const string DeleteRoutes = "delete:routes";
    
    // Locations permissions
    public const string ReadLocations = "read:locations";
    public const string WriteLocations = "write:locations";
    public const string DeleteLocations = "delete:locations";
    
    // Dashboard permissions
    public const string ReadDashboard = "read:dashboard";
    
    // Configuration permissions
    public const string ReadConfiguration = "read:configuration";
    
    // User permissions
    public const string ReadUsers = "read:users";
    
    /// <summary>
    /// All available scopes
    /// </summary>
    public static readonly string[] AllScopes = {
        ReadRoutes, WriteRoutes, DeleteRoutes,
        ReadLocations, WriteLocations, DeleteLocations,
        ReadDashboard, ReadConfiguration, ReadUsers
    };
    
    /// <summary>
    /// Default scopes for new API tokens - grants all permissions
    /// </summary>
    public static readonly string[] DefaultScopes = {
        ReadRoutes, WriteRoutes, DeleteRoutes,
        ReadLocations, WriteLocations, DeleteLocations,
        ReadDashboard, ReadConfiguration, ReadUsers
    };
    
    /// <summary>
    /// Read-only scopes for limited access tokens
    /// </summary>
    public static readonly string[] ReadOnlyScopes = {
        ReadRoutes, ReadLocations, ReadDashboard, ReadConfiguration
    };
}