using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services.Interfaces;

/// <summary>
/// Service for managing automatic timezone detection and user preference updates
/// </summary>
public interface ITimezoneManagementService
{
    /// <summary>
    /// Analyzes recent location data to determine if user's timezone should be updated
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <param name="lookbackHours">Hours to look back for location analysis (default: 24)</param>
    /// <returns>Timezone update analysis</returns>
    Task<TimezoneUpdateAnalysis> AnalyzeUserTimezoneAsync(string userId, int lookbackHours = 24);

    /// <summary>
    /// Processes a new location point and checks for timezone changes
    /// </summary>
    /// <param name="location">New location data</param>
    /// <returns>Timezone change info if detected</returns>
    Task<TimezoneChangeInfo?> ProcessLocationForTimezoneChangeAsync(Location location);

    /// <summary>
    /// Updates user's timezone preference and handles related data conversions
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <param name="newTimezone">New timezone to set</param>
    /// <param name="reason">Reason for the change</param>
    /// <returns>Update result</returns>
    Task<TimezoneUpdateResult> UpdateUserTimezoneAsync(string userId, string newTimezone, string reason);

    /// <summary>
    /// Gets timezone recommendations for a user based on recent activity
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <returns>Timezone recommendations</returns>
    Task<List<TimezoneRecommendation>> GetTimezoneRecommendationsAsync(string userId);

    /// <summary>
    /// Checks if a user needs timezone update prompts
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <returns>Whether user should be prompted for timezone update</returns>
    Task<bool> ShouldPromptUserForTimezoneUpdateAsync(string userId);

    /// <summary>
    /// Records user's response to timezone change prompt
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <param name="accepted">Whether user accepted the timezone change</param>
    /// <param name="timezone">The timezone that was suggested</param>
    Task RecordTimezonePromptResponseAsync(string userId, bool accepted, string timezone);
}

/// <summary>
/// Analysis of user's timezone based on location data
/// </summary>
public class TimezoneUpdateAnalysis
{
    public string UserId { get; set; } = null!;
    public string CurrentUserTimezone { get; set; } = null!;
    public string? SuggestedTimezone { get; set; }
    public double Confidence { get; set; }
    public bool ShouldUpdate { get; set; }
    public bool ShouldPromptUser { get; set; }
    public string Reason { get; set; } = null!;
    public DateTime AnalysisTime { get; set; }
    public List<TimezoneLocation> LocationSamples { get; set; } = new();
}

/// <summary>
/// Information about a detected timezone change
/// </summary>
public class TimezoneChangeInfo
{
    public string UserId { get; set; } = null!;
    public string PreviousTimezone { get; set; } = null!;
    public string NewTimezone { get; set; } = null!;
    public Location TriggerLocation { get; set; } = null!;
    public double Confidence { get; set; }
    public DateTime DetectedAt { get; set; }
    public TimezoneUpdateRecommendation Recommendation { get; set; } = null!;
}

/// <summary>
/// Location with timezone information
/// </summary>
public class TimezoneLocation
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime Timestamp { get; set; }
    public string TimezoneId { get; set; } = null!;
    public double TimezoneOffset { get; set; }
}

/// <summary>
/// Result of timezone update operation
/// </summary>
public class TimezoneUpdateResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? PreviousTimezone { get; set; }
    public string? NewTimezone { get; set; }
    public DateTime UpdateTime { get; set; }
    public string Reason { get; set; } = null!;
}

/// <summary>
/// Timezone recommendation for a user
/// </summary>
public class TimezoneRecommendation
{
    public string TimezoneId { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public double Confidence { get; set; }
    public string Reason { get; set; } = null!;
    public int LocationSamplesCount { get; set; }
    public DateTime LastSeenAt { get; set; }
    public bool IsCurrentUserTimezone { get; set; }
    public bool IsBrowserTimezone { get; set; }
}