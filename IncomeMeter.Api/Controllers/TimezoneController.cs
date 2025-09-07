using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using IncomeMeter.Api.Services.Interfaces;
using IncomeMeter.Api.Middleware;

namespace IncomeMeter.Api.Controllers;

[Route("api/timezone")]
[ApiController]
[RequireScopes("read:user")]
public class TimezoneController : ControllerBase
{
    private readonly ITimezoneManagementService _timezoneManagementService;
    private readonly ITimezoneService _timezoneService;
    private readonly ILogger<TimezoneController> _logger;

    public TimezoneController(
        ITimezoneManagementService timezoneManagementService,
        ITimezoneService timezoneService,
        ILogger<TimezoneController> logger)
    {
        _timezoneManagementService = timezoneManagementService;
        _timezoneService = timezoneService;
        _logger = logger;
    }

    /// <summary>
    /// Gets timezone analysis for the current user
    /// </summary>
    [HttpGet("analysis")]
    public async Task<IActionResult> GetTimezoneAnalysis([FromQuery] int lookbackHours = 24)
    {
        try
        {
            var userId = HttpContext.Items["UserId"]?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User ID not found" });
            }

            var analysis = await _timezoneManagementService.AnalyzeUserTimezoneAsync(userId, lookbackHours);
            
            return Ok(new
            {
                success = true,
                data = analysis
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get timezone analysis");
            return StatusCode(500, new { success = false, message = "Failed to analyze timezone" });
        }
    }

    /// <summary>
    /// Gets timezone recommendations for the current user
    /// </summary>
    [HttpGet("recommendations")]
    public async Task<IActionResult> GetTimezoneRecommendations()
    {
        try
        {
            var userId = HttpContext.Items["UserId"]?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User ID not found" });
            }

            var recommendations = await _timezoneManagementService.GetTimezoneRecommendationsAsync(userId);
            
            return Ok(new
            {
                success = true,
                data = recommendations
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get timezone recommendations");
            return StatusCode(500, new { success = false, message = "Failed to get recommendations" });
        }
    }

    /// <summary>
    /// Checks if user should be prompted for timezone update
    /// </summary>
    [HttpGet("should-prompt")]
    public async Task<IActionResult> ShouldPromptForUpdate()
    {
        try
        {
            var userId = HttpContext.Items["UserId"]?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User ID not found" });
            }

            var shouldPrompt = await _timezoneManagementService.ShouldPromptUserForTimezoneUpdateAsync(userId);
            
            return Ok(new
            {
                success = true,
                shouldPrompt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check if should prompt for timezone update");
            return StatusCode(500, new { success = false, message = "Failed to check prompt status" });
        }
    }

    /// <summary>
    /// Updates user's timezone preference
    /// </summary>
    [HttpPost("update")]
    [RequireScopes("write:user")]
    public async Task<IActionResult> UpdateTimezone([FromBody] UpdateTimezoneRequest request)
    {
        try
        {
            var userId = HttpContext.Items["UserId"]?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User ID not found" });
            }

            if (string.IsNullOrWhiteSpace(request.Timezone))
            {
                return BadRequest(new { success = false, message = "Timezone is required" });
            }

            if (!_timezoneService.IsValidTimezone(request.Timezone))
            {
                return BadRequest(new { success = false, message = "Invalid timezone" });
            }

            var result = await _timezoneManagementService.UpdateUserTimezoneAsync(
                userId, 
                request.Timezone, 
                request.Reason ?? "User manual update"
            );

            if (!result.Success)
            {
                return BadRequest(new { success = false, message = result.ErrorMessage });
            }

            return Ok(new
            {
                success = true,
                data = result
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update timezone");
            return StatusCode(500, new { success = false, message = "Failed to update timezone" });
        }
    }

    /// <summary>
    /// Records user response to timezone prompt
    /// </summary>
    [HttpPost("prompt-response")]
    public async Task<IActionResult> RecordPromptResponse([FromBody] TimezonePromptResponseRequest request)
    {
        try
        {
            var userId = HttpContext.Items["UserId"]?.ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User ID not found" });
            }

            await _timezoneManagementService.RecordTimezonePromptResponseAsync(
                userId, 
                request.Accepted, 
                request.Timezone
            );

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to record prompt response");
            return StatusCode(500, new { success = false, message = "Failed to record response" });
        }
    }

    /// <summary>
    /// Gets common timezone options
    /// </summary>
    [HttpGet("options")]
    [AllowAnonymous]
    public IActionResult GetTimezoneOptions()
    {
        try
        {
            var timezones = _timezoneService.GetCommonTimezones();
            
            return Ok(new
            {
                success = true,
                data = timezones.Select(kv => new
                {
                    id = kv.Key,
                    name = kv.Value
                }).OrderBy(t => t.name)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get timezone options");
            return StatusCode(500, new { success = false, message = "Failed to get timezone options" });
        }
    }

    /// <summary>
    /// Validates a timezone ID
    /// </summary>
    [HttpGet("validate/{timezoneId}")]
    [AllowAnonymous]
    public IActionResult ValidateTimezone(string timezoneId)
    {
        try
        {
            var isValid = _timezoneService.IsValidTimezone(timezoneId);
            
            return Ok(new
            {
                success = true,
                isValid,
                timezoneId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate timezone {TimezoneId}", timezoneId);
            return StatusCode(500, new { success = false, message = "Failed to validate timezone" });
        }
    }

    /// <summary>
    /// Detects timezone from coordinates
    /// </summary>
    [HttpGet("detect")]
    public async Task<IActionResult> DetectTimezone([FromQuery] double latitude, [FromQuery] double longitude)
    {
        try
        {
            if (latitude < -90 || latitude > 90)
            {
                return BadRequest(new { success = false, message = "Invalid latitude" });
            }

            if (longitude < -180 || longitude > 180)
            {
                return BadRequest(new { success = false, message = "Invalid longitude" });
            }

            var timezone = await _timezoneService.GetTimezoneFromCoordinatesAsync(latitude, longitude);
            var offset = _timezoneService.GetTimezoneOffset(timezone, DateTime.UtcNow);
            
            return Ok(new
            {
                success = true,
                timezone,
                offset,
                displayName = _timezoneService.GetCommonTimezones().GetValueOrDefault(timezone, timezone)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to detect timezone for coordinates {Lat}, {Lon}", latitude, longitude);
            return StatusCode(500, new { success = false, message = "Failed to detect timezone" });
        }
    }
}

/// <summary>
/// Request model for updating timezone
/// </summary>
public class UpdateTimezoneRequest
{
    public string Timezone { get; set; } = null!;
    public string? Reason { get; set; }
}

/// <summary>
/// Request model for timezone prompt response
/// </summary>
public class TimezonePromptResponseRequest
{
    public bool Accepted { get; set; }
    public string Timezone { get; set; } = null!;
}