using IncomeMeter.Api.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace IncomeMeter.Api.Services;

/// <summary>
/// Service for handling timezone operations including coordinate-to-timezone lookup,
/// timezone conversion, and validation
/// </summary>
public class TimezoneService : ITimezoneService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<TimezoneService> _logger;
    
    // Cache timezone lookups for 24 hours to reduce API calls
    private readonly TimeSpan _cacheExpiration = TimeSpan.FromHours(24);
    
    // Simple coordinate-based timezone mapping for major regions (fallback)
    private readonly Dictionary<string, (double minLat, double maxLat, double minLon, double maxLon)> _timezoneRegions = new()
    {
        // Europe
        { "Europe/London", (49.5, 61.0, -8.0, 2.0) },
        { "Europe/Paris", (42.0, 51.5, -5.0, 8.5) },
        { "Europe/Berlin", (47.0, 55.0, 6.0, 15.0) },
        { "Europe/Rome", (36.0, 47.5, 6.5, 19.0) },
        { "Europe/Madrid", (35.5, 44.0, -10.0, 4.5) },
        
        // North America
        { "America/New_York", (24.0, 50.0, -85.0, -66.0) },
        { "America/Chicago", (25.0, 49.0, -105.0, -85.0) },
        { "America/Denver", (31.0, 49.0, -125.0, -102.0) },
        { "America/Los_Angeles", (32.0, 49.0, -125.0, -114.0) },
        
        // Asia Pacific  
        { "Asia/Tokyo", (30.0, 46.0, 129.0, 146.0) },
        { "Asia/Shanghai", (18.0, 54.0, 73.0, 135.0) },
        { "Asia/Kolkata", (6.0, 37.0, 68.0, 97.5) },
        { "Australia/Sydney", (-44.0, -10.0, 113.0, 154.0) },
        
        // Others
        { "Africa/Cairo", (22.0, 32.0, 25.0, 37.0) },
        { "America/Sao_Paulo", (-34.0, 5.0, -74.0, -35.0) }
    };

    public TimezoneService(HttpClient httpClient, IMemoryCache cache, ILogger<TimezoneService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Gets the timezone ID for the given coordinates using TimeZoneDB API with fallback
    /// </summary>
    public async Task<string> GetTimezoneFromCoordinatesAsync(double latitude, double longitude)
    {
        var cacheKey = $"timezone_{latitude:F2}_{longitude:F2}";
        
        // Check cache first
        if (_cache.TryGetValue(cacheKey, out string? cachedTimezone) && !string.IsNullOrEmpty(cachedTimezone))
        {
            _logger.LogDebug("Retrieved timezone {Timezone} from cache for coordinates {Lat}, {Lon}", 
                cachedTimezone, latitude, longitude);
            return cachedTimezone;
        }

        try
        {
            // Try API lookup first (using a free service like TimeZoneDB)
            var timezone = await GetTimezoneFromApiAsync(latitude, longitude);
            
            if (!string.IsNullOrEmpty(timezone) && IsValidTimezone(timezone))
            {
                _cache.Set(cacheKey, timezone, _cacheExpiration);
                _logger.LogInformation("Retrieved timezone {Timezone} from API for coordinates {Lat}, {Lon}", 
                    timezone, latitude, longitude);
                return timezone;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get timezone from API for coordinates {Lat}, {Lon}", latitude, longitude);
        }

        // Fallback to coordinate-based lookup
        var fallbackTimezone = GetTimezoneFromCoordinates(latitude, longitude);
        _cache.Set(cacheKey, fallbackTimezone, _cacheExpiration);
        
        _logger.LogInformation("Using fallback timezone {Timezone} for coordinates {Lat}, {Lon}", 
            fallbackTimezone, latitude, longitude);
        
        return fallbackTimezone;
    }

    /// <summary>
    /// Get timezone from external API (currently using a simple approach, can be enhanced with actual API)
    /// </summary>
    private async Task<string?> GetTimezoneFromApiAsync(double latitude, double longitude)
    {
        // For now, return null to use fallback. 
        // TODO: Integrate with TimeZoneDB, GeoNames, or similar service
        // Example implementation would be:
        // var url = $"http://api.timezonedb.com/v2.1/get-time-zone?key={apiKey}&format=json&by=position&lat={latitude}&lng={longitude}";
        // var response = await _httpClient.GetStringAsync(url);
        // Parse JSON and return timezone ID
        
        await Task.CompletedTask; // Remove when implementing actual API call
        return null;
    }

    /// <summary>
    /// Simple coordinate-based timezone lookup for common regions
    /// </summary>
    private string GetTimezoneFromCoordinates(double latitude, double longitude)
    {
        foreach (var (timezone, (minLat, maxLat, minLon, maxLon)) in _timezoneRegions)
        {
            if (latitude >= minLat && latitude <= maxLat && 
                longitude >= minLon && longitude <= maxLon)
            {
                return timezone;
            }
        }
        
        // Default fallback based on longitude (rough approximation)
        if (longitude >= -8 && longitude <= 15) return "Europe/London";
        if (longitude >= 15 && longitude <= 45) return "Europe/Berlin"; 
        if (longitude >= 45 && longitude <= 120) return "Asia/Shanghai";
        if (longitude >= 120 && longitude <= 180) return "Asia/Tokyo";
        if (longitude >= -180 && longitude <= -120) return "America/Los_Angeles";
        if (longitude >= -120 && longitude <= -90) return "America/Denver";
        if (longitude >= -90 && longitude <= -75) return "America/Chicago";
        if (longitude >= -75 && longitude <= -60) return "America/New_York";
        
        // Ultimate fallback
        return "UTC";
    }

    /// <summary>
    /// Validates if a timezone ID is valid using TimeZoneInfo
    /// </summary>
    public bool IsValidTimezone(string timezoneId)
    {
        if (string.IsNullOrWhiteSpace(timezoneId))
            return false;

        try
        {
            // Handle common timezone formats
            if (timezoneId == "UTC")
                return true;
            
            // Try to find the timezone info
            var timeZone = TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
            return timeZone != null;
        }
        catch (TimeZoneNotFoundException)
        {
            // Try IANA to Windows conversion for common cases
            var windowsId = ConvertIanaToWindows(timezoneId);
            if (!string.IsNullOrEmpty(windowsId))
            {
                try
                {
                    var timeZone = TimeZoneInfo.FindSystemTimeZoneById(windowsId);
                    return timeZone != null;
                }
                catch
                {
                    return false;
                }
            }
            return false;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Converts common IANA timezone IDs to Windows timezone IDs
    /// </summary>
    private string? ConvertIanaToWindows(string ianaId)
    {
        var ianaToWindows = new Dictionary<string, string>
        {
            { "Europe/London", "GMT Standard Time" },
            { "Europe/Paris", "Romance Standard Time" },
            { "Europe/Berlin", "W. Europe Standard Time" },
            { "Europe/Rome", "W. Europe Standard Time" },
            { "Europe/Madrid", "Romance Standard Time" },
            { "America/New_York", "Eastern Standard Time" },
            { "America/Chicago", "Central Standard Time" },
            { "America/Denver", "Mountain Standard Time" },
            { "America/Los_Angeles", "Pacific Standard Time" },
            { "Asia/Tokyo", "Tokyo Standard Time" },
            { "Asia/Shanghai", "China Standard Time" },
            { "Asia/Kolkata", "India Standard Time" },
            { "Australia/Sydney", "AUS Eastern Standard Time" },
            { "Africa/Cairo", "Egypt Standard Time" },
            { "America/Sao_Paulo", "E. South America Standard Time" }
        };

        return ianaToWindows.TryGetValue(ianaId, out var windowsId) ? windowsId : null;
    }

    /// <summary>
    /// Converts a DateTime from one timezone to another
    /// </summary>
    public DateTime ConvertTimezone(DateTime dateTime, string fromTimezone, string toTimezone)
    {
        try
        {
            if (fromTimezone == toTimezone)
                return dateTime;

            // Convert to UTC first, then to target timezone
            var utcTime = ConvertToUtc(dateTime, fromTimezone);
            return ConvertFromUtc(utcTime, toTimezone);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert timezone from {From} to {To}", fromTimezone, toTimezone);
            return dateTime; // Return original on error
        }
    }

    /// <summary>
    /// Converts a local DateTime to UTC using the specified timezone
    /// </summary>
    public DateTime ConvertToUtc(DateTime localDateTime, string timezoneId)
    {
        try
        {
            if (timezoneId == "UTC" || localDateTime.Kind == DateTimeKind.Utc)
                return DateTime.SpecifyKind(localDateTime, DateTimeKind.Utc);

            var timeZone = GetTimeZoneInfo(timezoneId);
            if (timeZone == null)
            {
                _logger.LogWarning("Could not find timezone {TimezoneId}, treating as UTC", timezoneId);
                return DateTime.SpecifyKind(localDateTime, DateTimeKind.Utc);
            }

            // Ensure the DateTime is treated as unspecified (local to the timezone)
            var unspecifiedTime = DateTime.SpecifyKind(localDateTime, DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(unspecifiedTime, timeZone);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert local time to UTC for timezone {TimezoneId}", timezoneId);
            return DateTime.SpecifyKind(localDateTime, DateTimeKind.Utc);
        }
    }

    /// <summary>
    /// Converts a UTC DateTime to local time using the specified timezone
    /// </summary>
    public DateTime ConvertFromUtc(DateTime utcDateTime, string timezoneId)
    {
        try
        {
            if (timezoneId == "UTC")
                return DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);

            var timeZone = GetTimeZoneInfo(timezoneId);
            if (timeZone == null)
            {
                _logger.LogWarning("Could not find timezone {TimezoneId}, returning UTC time", timezoneId);
                return DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);
            }

            // Ensure the DateTime is treated as UTC
            var utcTime = DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);
            return TimeZoneInfo.ConvertTimeFromUtc(utcTime, timeZone);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert UTC time to local for timezone {TimezoneId}", timezoneId);
            return DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);
        }
    }

    /// <summary>
    /// Gets TimeZoneInfo object for the given timezone ID
    /// </summary>
    private TimeZoneInfo? GetTimeZoneInfo(string timezoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            // Try Windows conversion
            var windowsId = ConvertIanaToWindows(timezoneId);
            if (!string.IsNullOrEmpty(windowsId))
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById(windowsId);
                }
                catch
                {
                    return null;
                }
            }
            return null;
        }
    }

    /// <summary>
    /// Gets the timezone offset (in hours) for a specific timezone and date
    /// </summary>
    public double GetTimezoneOffset(string timezoneId, DateTime dateTime)
    {
        try
        {
            if (timezoneId == "UTC")
                return 0;

            var timeZone = GetTimeZoneInfo(timezoneId);
            if (timeZone == null)
                return 0;

            var utcTime = DateTime.SpecifyKind(dateTime, DateTimeKind.Utc);
            var offset = timeZone.GetUtcOffset(utcTime);
            return offset.TotalHours;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get timezone offset for {TimezoneId}", timezoneId);
            return 0;
        }
    }

    /// <summary>
    /// Determines if two coordinates are likely in different timezones
    /// </summary>
    public async Task<bool> AreCoordinatesInDifferentTimezonesAsync(double lat1, double lon1, double lat2, double lon2)
    {
        try
        {
            var timezone1 = await GetTimezoneFromCoordinatesAsync(lat1, lon1);
            var timezone2 = await GetTimezoneFromCoordinatesAsync(lat2, lon2);
            
            return !string.Equals(timezone1, timezone2, StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to compare timezones for coordinates");
            return false;
        }
    }

    /// <summary>
    /// Gets a list of common timezone IDs and their display names
    /// </summary>
    public Dictionary<string, string> GetCommonTimezones()
    {
        return new Dictionary<string, string>
        {
            { "UTC", "UTC" },
            { "Europe/London", "London (GMT/BST)" },
            { "Europe/Paris", "Paris (CET/CEST)" },
            { "Europe/Berlin", "Berlin (CET/CEST)" },
            { "Europe/Rome", "Rome (CET/CEST)" },
            { "Europe/Madrid", "Madrid (CET/CEST)" },
            { "America/New_York", "New York (EST/EDT)" },
            { "America/Chicago", "Chicago (CST/CDT)" },
            { "America/Denver", "Denver (MST/MDT)" },
            { "America/Los_Angeles", "Los Angeles (PST/PDT)" },
            { "Asia/Tokyo", "Tokyo (JST)" },
            { "Asia/Shanghai", "Shanghai (CST)" },
            { "Asia/Kolkata", "Mumbai (IST)" },
            { "Australia/Sydney", "Sydney (AEST/AEDT)" },
            { "Africa/Cairo", "Cairo (EET/EEST)" },
            { "America/Sao_Paulo", "São Paulo (BRT/BRST)" }
        };
    }

    /// <summary>
    /// Determines if a user should be prompted to update their timezone
    /// </summary>
    public TimezoneUpdateRecommendation ShouldUpdateUserTimezone(string userCurrentTimezone, string detectedTimezone, double confidence)
    {
        var recommendation = new TimezoneUpdateRecommendation
        {
            RecommendedTimezone = detectedTimezone,
            Confidence = confidence
        };

        try
        {
            // If timezones are the same, no update needed
            if (string.Equals(userCurrentTimezone, detectedTimezone, StringComparison.OrdinalIgnoreCase))
            {
                recommendation.ShouldPromptUser = false;
                recommendation.ShouldAutoUpdate = false;
                recommendation.Reason = "User timezone matches detected timezone";
                return recommendation;
            }

            // Check if detected timezone is valid
            if (!IsValidTimezone(detectedTimezone))
            {
                recommendation.ShouldPromptUser = false;
                recommendation.ShouldAutoUpdate = false;
                recommendation.Reason = "Detected timezone is not valid";
                return recommendation;
            }

            // High confidence: Auto-update for major timezone changes
            if (confidence >= 0.8)
            {
                var currentOffset = GetTimezoneOffset(userCurrentTimezone, DateTime.UtcNow);
                var detectedOffset = GetTimezoneOffset(detectedTimezone, DateTime.UtcNow);
                var offsetDifference = Math.Abs(currentOffset - detectedOffset);

                if (offsetDifference >= 1.0) // At least 1 hour difference
                {
                    recommendation.ShouldAutoUpdate = true;
                    recommendation.ShouldPromptUser = true;
                    recommendation.Reason = $"High confidence timezone change detected (offset difference: {offsetDifference}h)";
                    return recommendation;
                }
            }

            // Medium confidence: Prompt user
            if (confidence >= 0.6)
            {
                recommendation.ShouldPromptUser = true;
                recommendation.ShouldAutoUpdate = false;
                recommendation.Reason = "Timezone change detected, user confirmation recommended";
                return recommendation;
            }

            // Low confidence: Log but don't prompt
            recommendation.ShouldPromptUser = false;
            recommendation.ShouldAutoUpdate = false;
            recommendation.Reason = "Low confidence timezone detection, no action needed";
            return recommendation;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to determine timezone update recommendation");
            recommendation.ShouldPromptUser = false;
            recommendation.ShouldAutoUpdate = false;
            recommendation.Reason = "Error occurred while analyzing timezone update";
            return recommendation;
        }
    }
}