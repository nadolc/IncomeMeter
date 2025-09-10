namespace IncomeMeter.Api.Services.Interfaces;

/// <summary>
/// Service for handling timezone operations including coordinate-to-timezone lookup,
/// timezone conversion, and validation
/// </summary>
public interface ITimezoneService
{
    /// <summary>
    /// Gets the timezone ID (IANA format) for the given coordinates
    /// </summary>
    /// <param name="latitude">Latitude coordinate</param>
    /// <param name="longitude">Longitude coordinate</param>
    /// <returns>IANA timezone ID (e.g., "Europe/London", "America/New_York")</returns>
    Task<string> GetTimezoneFromCoordinatesAsync(double latitude, double longitude); 

    /// <summary>
    /// Validates if a timezone ID is valid
    /// </summary>
    /// <param name="timezoneId">IANA timezone ID to validate</param>
    /// <returns>True if valid, false otherwise</returns>
    bool IsValidTimezone(string timezoneId);

    /// <summary>
    /// Converts a DateTime from one timezone to another
    /// </summary>
    /// <param name="dateTime">The DateTime to convert</param>
    /// <param name="fromTimezone">Source timezone ID</param>
    /// <param name="toTimezone">Target timezone ID</param>
    /// <returns>Converted DateTime</returns>
    DateTime ConvertTimezone(DateTime dateTime, string fromTimezone, string toTimezone);

    /// <summary>
    /// Converts a local DateTime to UTC using the specified timezone
    /// </summary>
    /// <param name="localDateTime">Local DateTime</param>
    /// <param name="timezoneId">IANA timezone ID</param>
    /// <returns>UTC DateTime</returns>
    DateTime ConvertToUtc(DateTime localDateTime, string timezoneId);

    /// <summary>
    /// Converts a UTC DateTime to local time using the specified timezone
    /// </summary>
    /// <param name="utcDateTime">UTC DateTime</param>
    /// <param name="timezoneId">IANA timezone ID</param>
    /// <returns>Local DateTime</returns>
    DateTime ConvertFromUtc(DateTime utcDateTime, string timezoneId);

    /// <summary>
    /// Gets the timezone offset (in hours) for a specific timezone and date
    /// </summary>
    /// <param name="timezoneId">IANA timezone ID</param>
    /// <param name="dateTime">Date and time to get offset for (handles DST)</param>
    /// <returns>Timezone offset in hours</returns>
    double GetTimezoneOffset(string timezoneId, DateTime dateTime);

    /// <summary>
    /// Determines if two coordinates are likely in different timezones
    /// (useful for detecting significant location changes)
    /// </summary>
    /// <param name="lat1">First latitude</param>
    /// <param name="lon1">First longitude</param>
    /// <param name="lat2">Second latitude</param>
    /// <param name="lon2">Second longitude</param>
    /// <returns>True if likely in different timezones</returns>
    Task<bool> AreCoordinatesInDifferentTimezonesAsync(double lat1, double lon1, double lat2, double lon2);

    /// <summary>
    /// Gets a list of common timezone IDs and their display names
    /// </summary>
    /// <returns>Dictionary of timezone ID to display name</returns>
    Dictionary<string, string> GetCommonTimezones();

    /// <summary>
    /// Determines if a user should be prompted to update their timezone based on recent location data
    /// </summary>
    /// <param name="userCurrentTimezone">User's current timezone setting</param>
    /// <param name="detectedTimezone">Detected timezone from GPS coordinates</param>
    /// <param name="confidence">Confidence level (0-1) based on how long user has been in new timezone</param>
    /// <returns>Timezone update recommendation</returns>
    TimezoneUpdateRecommendation ShouldUpdateUserTimezone(string userCurrentTimezone, string detectedTimezone, double confidence);
}

/// <summary>
/// Recommendation for timezone updates
/// </summary>
public class TimezoneUpdateRecommendation
{
    public bool ShouldPromptUser { get; set; }
    public bool ShouldAutoUpdate { get; set; }
    public string? RecommendedTimezone { get; set; }
    public string? Reason { get; set; }
    public double Confidence { get; set; }
}