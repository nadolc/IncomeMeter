using System.ComponentModel.DataAnnotations;

namespace IncomeMeter.Api.DTOs;

/// <summary>
/// Mobile platform types for device identification
/// </summary>
public enum MobilePlatform
{
    iOS,
    Android,
    Unknown
}

/// <summary>
/// Request for mobile app setup and integration
/// </summary>
public class MobileSetupRequest
{
    [Required]
    public string AccessToken { get; set; } = null!;
    
    [Required]
    public string RefreshToken { get; set; } = null!;
    
    /// <summary>
    /// Mobile platform (iOS, Android)
    /// </summary>
    public MobilePlatform Platform { get; set; } = MobilePlatform.Unknown;
    
    /// <summary>
    /// App version for compatibility checking
    /// </summary>
    public string? AppVersion { get; set; }
    
    /// <summary>
    /// Device identifier for tracking and security
    /// </summary>
    public string? DeviceId { get; set; }
}

/// <summary>
/// Response for mobile app setup
/// </summary>
public class MobileSetupResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = null!;
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime? TokenExpiry { get; set; }
    public DateTime? RefreshExpiry { get; set; }
    
    /// <summary>
    /// Platform-specific configuration
    /// </summary>
    public Dictionary<string, object>? PlatformConfig { get; set; }
}

/// <summary>
/// Request for mobile authentication with 2FA
/// </summary>
public class MobileLoginRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;
    
    [Required]
    public string Password { get; set; } = null!;
    
    [Required]
    [StringLength(6, MinimumLength = 6)]
    public string TwoFactorCode { get; set; } = null!;
    
    [Required]
    public string DeviceId { get; set; } = null!;
    
    /// <summary>
    /// Mobile platform for logging and optimization
    /// </summary>
    public MobilePlatform Platform { get; set; } = MobilePlatform.Unknown;
    
    /// <summary>
    /// App version for compatibility
    /// </summary>
    public string? AppVersion { get; set; }
    
    /// <summary>
    /// Device information for security
    /// </summary>
    public DeviceInfo? DeviceInfo { get; set; }
}

/// <summary>
/// Enhanced token response with mobile-specific features
/// </summary>
public class MobileTokenResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RefreshExpiresAt { get; set; }
    public bool RequiresTwoFactor { get; set; }
    
    /// <summary>
    /// User information for mobile app context
    /// </summary>
    public MobileUserInfo? UserInfo { get; set; }
    
    /// <summary>
    /// Mobile-specific configuration
    /// </summary>
    public MobileConfig? MobileConfig { get; set; }
}

/// <summary>
/// Mobile user information
/// </summary>
public class MobileUserInfo
{
    public string UserId { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string? ProfilePicture { get; set; }
    public bool TwoFactorEnabled { get; set; }
    public string[] EnabledFeatures { get; set; } = Array.Empty<string>();
}

/// <summary>
/// Mobile app configuration
/// </summary>
public class MobileConfig
{
    /// <summary>
    /// Location tracking configuration
    /// </summary>
    public LocationConfig LocationConfig { get; set; } = new();
    
    /// <summary>
    /// Sync configuration
    /// </summary>
    public SyncConfig SyncConfig { get; set; } = new();
    
    /// <summary>
    /// UI configuration
    /// </summary>
    public UIConfig UIConfig { get; set; } = new();
    
    /// <summary>
    /// Platform-specific settings
    /// </summary>
    public Dictionary<string, object> PlatformSettings { get; set; } = new();
}

/// <summary>
/// Location tracking configuration
/// </summary>
public class LocationConfig
{
    /// <summary>
    /// Minimum accuracy required (meters)
    /// </summary>
    public double MinAccuracy { get; set; } = 50.0;
    
    /// <summary>
    /// Update interval in seconds
    /// </summary>
    public int UpdateInterval { get; set; } = 15;
    
    /// <summary>
    /// Background tracking enabled
    /// </summary>
    public bool BackgroundTracking { get; set; } = true;
    
    /// <summary>
    /// Battery optimization mode
    /// </summary>
    public string BatteryOptimization { get; set; } = "balanced";
}

/// <summary>
/// Sync configuration
/// </summary>
public class SyncConfig
{
    /// <summary>
    /// Sync frequency in seconds
    /// </summary>
    public int SyncInterval { get; set; } = 30;
    
    /// <summary>
    /// Offline data retention days
    /// </summary>
    public int OfflineRetentionDays { get; set; } = 7;
    
    /// <summary>
    /// WiFi-only sync mode
    /// </summary>
    public bool WifiOnlySync { get; set; } = false;
    
    /// <summary>
    /// Batch size for sync operations
    /// </summary>
    public int BatchSize { get; set; } = 50;
}

/// <summary>
/// UI configuration
/// </summary>
public class UIConfig
{
    /// <summary>
    /// Theme preference
    /// </summary>
    public string Theme { get; set; } = "auto";
    
    /// <summary>
    /// Units system (metric/imperial)
    /// </summary>
    public string Units { get; set; } = "imperial";
    
    /// <summary>
    /// Language/locale
    /// </summary>
    public string Language { get; set; } = "en-US";
    
    /// <summary>
    /// Accessibility features enabled
    /// </summary>
    public string[] AccessibilityFeatures { get; set; } = Array.Empty<string>();
}

/// <summary>
/// Device information for security and optimization
/// </summary>
public class DeviceInfo
{
    public string? DeviceModel { get; set; }
    public string? OSVersion { get; set; }
    public string? AppVersion { get; set; }
    public string? Timezone { get; set; }
    public string? Language { get; set; }
    public int? BatteryLevel { get; set; }
    public bool? LowPowerMode { get; set; }
    public string? NetworkType { get; set; }
}

/// <summary>
/// Enhanced route start request for mobile
/// </summary>
public class MobileStartRouteRequest : StartRouteDto
{
    /// <summary>
    /// Current location for context
    /// </summary>
    public LocationPoint? StartLocation { get; set; }
    
    /// <summary>
    /// Device information
    /// </summary>
    public DeviceInfo? DeviceInfo { get; set; }
    
    /// <summary>
    /// Platform for optimization
    /// </summary>
    public MobilePlatform Platform { get; set; } = MobilePlatform.Unknown;
}

/// <summary>
/// Enhanced route end request for mobile
/// </summary>
public class MobileEndRouteRequest : EndRouteDto
{
    /// <summary>
    /// End location
    /// </summary>
    public LocationPoint? EndLocation { get; set; }
    
    /// <summary>
    /// Route waypoints collected during tracking
    /// </summary>
    public List<LocationPoint>? Waypoints { get; set; }
    
    /// <summary>
    /// Device information
    /// </summary>
    public DeviceInfo? DeviceInfo { get; set; }
    
    /// <summary>
    /// Platform for optimization
    /// </summary>
    public MobilePlatform Platform { get; set; } = MobilePlatform.Unknown;
    
    /// <summary>
    /// Route quality metrics
    /// </summary>
    public RouteQuality? Quality { get; set; }
}

/// <summary>
/// Location point with mobile-specific metadata
/// </summary>
public class LocationPoint
{
    [Required]
    public double Latitude { get; set; }
    
    [Required]
    public double Longitude { get; set; }
    
    [Required]
    public DateTime Timestamp { get; set; }
    
    [Required]
    public double Accuracy { get; set; }
    
    public double? Altitude { get; set; }
    public double? Speed { get; set; }
    public double? Heading { get; set; }
    
    /// <summary>
    /// Battery level when location was recorded
    /// </summary>
    public int? BatteryLevel { get; set; }
    
    /// <summary>
    /// Whether device was moving when recorded
    /// </summary>
    public bool IsMoving { get; set; }
    
    /// <summary>
    /// Network type when recorded
    /// </summary>
    public string? NetworkType { get; set; }
}

/// <summary>
/// Route quality metrics
/// </summary>
public class RouteQuality
{
    /// <summary>
    /// Average GPS accuracy during route
    /// </summary>
    public double AverageAccuracy { get; set; }
    
    /// <summary>
    /// Percentage of time with good GPS signal
    /// </summary>
    public double GpsReliability { get; set; }
    
    /// <summary>
    /// Number of location points recorded
    /// </summary>
    public int DataPoints { get; set; }
    
    /// <summary>
    /// Any issues encountered during tracking
    /// </summary>
    public string[] Issues { get; set; } = Array.Empty<string>();
    
    /// <summary>
    /// Battery impact score (1-10, lower is better)
    /// </summary>
    public int BatteryImpact { get; set; }
}

/// <summary>
/// Mobile route response with enhanced information
/// </summary>
public class MobileRouteResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = null!;
    public RouteResponseDto? Route { get; set; }
    public string? UserName { get; set; }
    
    /// <summary>
    /// Additional mobile context
    /// </summary>
    public MobileRouteContext? Context { get; set; }
}

/// <summary>
/// Mobile-specific route context
/// </summary>
public class MobileRouteContext
{
    /// <summary>
    /// Suggested next actions
    /// </summary>
    public string[] SuggestedActions { get; set; } = Array.Empty<string>();
    
    /// <summary>
    /// Performance insights
    /// </summary>
    public Dictionary<string, object> Insights { get; set; } = new();
    
    /// <summary>
    /// Notifications to display
    /// </summary>
    public MobileNotification[] Notifications { get; set; } = Array.Empty<MobileNotification>();
}

/// <summary>
/// Mobile notification
/// </summary>
public class MobileNotification
{
    public string Type { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string? ActionUrl { get; set; }
    public Dictionary<string, object>? Metadata { get; set; }
}