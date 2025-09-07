using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace IncomeMeter.Api.Services;

/// <summary>
/// Service for managing automatic timezone detection and user preference updates
/// </summary>
public class TimezoneManagementService : ITimezoneManagementService
{
    private readonly IMongoCollection<Location> _locations;
    private readonly ITimezoneService _timezoneService;
    private readonly IUserService _userService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<TimezoneManagementService> _logger;
    
    private readonly TimeSpan _analysisCacheExpiration = TimeSpan.FromMinutes(30);
    private const int MinLocationSamplesForConfidence = 3;
    private const double HighConfidenceThreshold = 0.8;
    private const double MediumConfidenceThreshold = 0.6;
    
    public TimezoneManagementService(
        MongoDbContext context,
        ITimezoneService timezoneService, 
        IUserService userService,
        IMemoryCache cache,
        ILogger<TimezoneManagementService> logger)
    {
        _locations = context.Locations;
        _timezoneService = timezoneService;
        _userService = userService;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Analyzes recent location data to determine if user's timezone should be updated
    /// </summary>
    public async Task<TimezoneUpdateAnalysis> AnalyzeUserTimezoneAsync(string userId, int lookbackHours = 24)
    {
        var cacheKey = $"timezone_analysis_{userId}_{lookbackHours}";
        
        if (_cache.TryGetValue(cacheKey, out TimezoneUpdateAnalysis? cachedAnalysis))
        {
            return cachedAnalysis!;
        }

        try
        {
            _logger.LogInformation("Starting timezone analysis for user {UserId} with {LookbackHours} hours lookback", 
                userId, lookbackHours);

            var user = await _userService.GetUserByIdAsync(userId);
            var currentUserTimezone = user?.Settings?.TimeZone ?? "UTC";

            var startTime = DateTime.UtcNow.AddHours(-lookbackHours);
            var recentLocations = await _locations
                .Find(l => l.UserId == userId && l.Timestamp >= startTime)
                .SortByDescending(l => l.Timestamp)
                .ToListAsync();

            var analysis = new TimezoneUpdateAnalysis
            {
                UserId = userId,
                CurrentUserTimezone = currentUserTimezone,
                AnalysisTime = DateTime.UtcNow,
                LocationSamples = new List<TimezoneLocation>()
            };

            if (recentLocations.Count == 0)
            {
                analysis.Reason = "No recent location data available";
                analysis.Confidence = 0;
                analysis.ShouldUpdate = false;
                analysis.ShouldPromptUser = false;
                return analysis;
            }

            // Group locations by detected timezone
            var timezoneGroups = new Dictionary<string, List<Location>>();
            
            foreach (var location in recentLocations)
            {
                var locationTimezone = location.TimezoneId ?? 
                    await _timezoneService.GetTimezoneFromCoordinatesAsync(location.Latitude, location.Longitude);
                
                if (!timezoneGroups.ContainsKey(locationTimezone))
                {
                    timezoneGroups[locationTimezone] = new List<Location>();
                }
                timezoneGroups[locationTimezone].Add(location);

                // Add to samples
                analysis.LocationSamples.Add(new TimezoneLocation
                {
                    Latitude = location.Latitude,
                    Longitude = location.Longitude,
                    Timestamp = location.Timestamp,
                    TimezoneId = locationTimezone,
                    TimezoneOffset = location.TimezoneOffset ?? 
                        _timezoneService.GetTimezoneOffset(locationTimezone, location.Timestamp)
                });
            }

            // Find the most common timezone
            var mostCommonTimezone = timezoneGroups
                .OrderByDescending(g => g.Value.Count)
                .ThenByDescending(g => g.Value.Max(l => l.Timestamp))
                .First();

            var dominantTimezone = mostCommonTimezone.Key;
            var dominantCount = mostCommonTimezone.Value.Count;
            var totalCount = recentLocations.Count;

            // Calculate confidence based on consistency and sample size
            var timezoneConsistency = (double)dominantCount / totalCount;
            var sampleSizeConfidence = Math.Min(1.0, (double)totalCount / MinLocationSamplesForConfidence);
            analysis.Confidence = timezoneConsistency * sampleSizeConfidence;

            analysis.SuggestedTimezone = dominantTimezone;

            // Determine if update should occur
            var userTimezoneMatchesSuggested = string.Equals(currentUserTimezone, dominantTimezone, StringComparison.OrdinalIgnoreCase);
            
            if (userTimezoneMatchesSuggested)
            {
                analysis.Reason = "User timezone matches detected timezone";
                analysis.ShouldUpdate = false;
                analysis.ShouldPromptUser = false;
            }
            else if (analysis.Confidence >= HighConfidenceThreshold)
            {
                analysis.Reason = $"High confidence timezone change detected: {timezoneConsistency:P0} of locations in {dominantTimezone}";
                analysis.ShouldUpdate = true;
                analysis.ShouldPromptUser = true;
            }
            else if (analysis.Confidence >= MediumConfidenceThreshold)
            {
                analysis.Reason = $"Medium confidence timezone change detected: {timezoneConsistency:P0} of locations in {dominantTimezone}";
                analysis.ShouldUpdate = false;
                analysis.ShouldPromptUser = true;
            }
            else
            {
                analysis.Reason = $"Low confidence timezone detection: {timezoneConsistency:P0} consistency";
                analysis.ShouldUpdate = false;
                analysis.ShouldPromptUser = false;
            }

            _cache.Set(cacheKey, analysis, _analysisCacheExpiration);
            
            _logger.LogInformation("Timezone analysis completed for user {UserId}: {Reason} (Confidence: {Confidence:P1})", 
                userId, analysis.Reason, analysis.Confidence);

            return analysis;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to analyze timezone for user {UserId}", userId);
            
            return new TimezoneUpdateAnalysis
            {
                UserId = userId,
                CurrentUserTimezone = "UTC",
                Reason = "Error occurred during timezone analysis",
                Confidence = 0,
                ShouldUpdate = false,
                ShouldPromptUser = false,
                AnalysisTime = DateTime.UtcNow
            };
        }
    }

    /// <summary>
    /// Processes a new location point and checks for timezone changes
    /// </summary>
    public async Task<TimezoneChangeInfo?> ProcessLocationForTimezoneChangeAsync(Location location)
    {
        try
        {
            if (string.IsNullOrEmpty(location.TimezoneId))
            {
                return null; // No timezone info to process
            }

            // Get the previous location for this user
            var previousLocation = await _locations
                .Find(l => l.UserId == location.UserId && l.Id != location.Id)
                .SortByDescending(l => l.Timestamp)
                .FirstOrDefaultAsync();

            if (previousLocation == null || string.IsNullOrEmpty(previousLocation.TimezoneId))
            {
                return null; // No previous location to compare
            }

            // Check if timezone has changed
            if (string.Equals(location.TimezoneId, previousLocation.TimezoneId, StringComparison.OrdinalIgnoreCase))
            {
                return null; // No timezone change
            }

            _logger.LogInformation("Timezone change detected for user {UserId}: {PrevTz} → {NewTz}", 
                location.UserId, previousLocation.TimezoneId, location.TimezoneId);

            // Get user's current timezone setting
            var user = await _userService.GetUserByIdAsync(location.UserId);
            var userCurrentTimezone = user?.Settings?.TimeZone ?? "UTC";

            // Generate recommendation
            var recommendation = _timezoneService.ShouldUpdateUserTimezone(
                userCurrentTimezone, 
                location.TimezoneId, 
                0.8 // High confidence for GPS-based detection
            );

            return new TimezoneChangeInfo
            {
                UserId = location.UserId,
                PreviousTimezone = previousLocation.TimezoneId,
                NewTimezone = location.TimezoneId,
                TriggerLocation = location,
                Confidence = 0.8,
                DetectedAt = DateTime.UtcNow,
                Recommendation = recommendation
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process location for timezone change detection");
            return null;
        }
    }

    /// <summary>
    /// Updates user's timezone preference
    /// </summary>
    public async Task<TimezoneUpdateResult> UpdateUserTimezoneAsync(string userId, string newTimezone, string reason)
    {
        try
        {
            if (!_timezoneService.IsValidTimezone(newTimezone))
            {
                return new TimezoneUpdateResult
                {
                    Success = false,
                    ErrorMessage = $"Invalid timezone: {newTimezone}",
                    UpdateTime = DateTime.UtcNow,
                    Reason = reason
                };
            }

            var user = await _userService.GetUserByIdAsync(userId);
            if (user == null)
            {
                return new TimezoneUpdateResult
                {
                    Success = false,
                    ErrorMessage = "User not found",
                    UpdateTime = DateTime.UtcNow,
                    Reason = reason
                };
            }

            var previousTimezone = user.Settings.TimeZone;
            
            // Update user settings
            user.Settings.TimeZone = newTimezone;
            await _userService.UpdateUserAsync(user);

            // Clear analysis cache for this user
            var cachePattern = $"timezone_analysis_{userId}_";
            // Note: MemoryCache doesn't support pattern-based clearing, so we'll rely on expiration

            _logger.LogInformation("Updated timezone for user {UserId}: {PrevTz} → {NewTz} (Reason: {Reason})", 
                userId, previousTimezone, newTimezone, reason);

            return new TimezoneUpdateResult
            {
                Success = true,
                PreviousTimezone = previousTimezone,
                NewTimezone = newTimezone,
                UpdateTime = DateTime.UtcNow,
                Reason = reason
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update timezone for user {UserId}", userId);
            
            return new TimezoneUpdateResult
            {
                Success = false,
                ErrorMessage = ex.Message,
                UpdateTime = DateTime.UtcNow,
                Reason = reason
            };
        }
    }

    /// <summary>
    /// Gets timezone recommendations for a user
    /// </summary>
    public async Task<List<TimezoneRecommendation>> GetTimezoneRecommendationsAsync(string userId)
    {
        try
        {
            var analysis = await AnalyzeUserTimezoneAsync(userId, 168); // 7 days lookback
            var user = await _userService.GetUserByIdAsync(userId);
            var currentUserTimezone = user?.Settings?.TimeZone ?? "UTC";

            var recommendations = new List<TimezoneRecommendation>();

            // Group locations by timezone and create recommendations
            var timezoneGroups = analysis.LocationSamples
                .GroupBy(l => l.TimezoneId)
                .OrderByDescending(g => g.Count())
                .ThenByDescending(g => g.Max(l => l.Timestamp));

            foreach (var group in timezoneGroups.Take(5)) // Top 5 recommendations
            {
                var timezone = group.Key;
                var locations = group.ToList();
                var confidence = (double)locations.Count / analysis.LocationSamples.Count;

                recommendations.Add(new TimezoneRecommendation
                {
                    TimezoneId = timezone,
                    DisplayName = _timezoneService.GetCommonTimezones().GetValueOrDefault(timezone, timezone),
                    Confidence = confidence,
                    Reason = $"Detected in {locations.Count} of {analysis.LocationSamples.Count} recent locations",
                    LocationSamplesCount = locations.Count,
                    LastSeenAt = locations.Max(l => l.Timestamp),
                    IsCurrentUserTimezone = string.Equals(timezone, currentUserTimezone, StringComparison.OrdinalIgnoreCase),
                    IsBrowserTimezone = false // This would need to come from frontend
                });
            }

            return recommendations;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get timezone recommendations for user {UserId}", userId);
            return new List<TimezoneRecommendation>();
        }
    }

    /// <summary>
    /// Checks if user should be prompted for timezone update
    /// </summary>
    public async Task<bool> ShouldPromptUserForTimezoneUpdateAsync(string userId)
    {
        try
        {
            var analysis = await AnalyzeUserTimezoneAsync(userId);
            return analysis.ShouldPromptUser;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check if user {UserId} should be prompted for timezone update", userId);
            return false;
        }
    }

    /// <summary>
    /// Records user's response to timezone prompt (for future ML improvements)
    /// </summary>
    public async Task RecordTimezonePromptResponseAsync(string userId, bool accepted, string timezone)
    {
        try
        {
            _logger.LogInformation("User {UserId} {Response} timezone prompt for {Timezone}", 
                userId, accepted ? "accepted" : "declined", timezone);
            
            // This could be stored in a separate collection for analytics
            // For now, we just log it
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to record timezone prompt response for user {UserId}", userId);
        }
    }
}