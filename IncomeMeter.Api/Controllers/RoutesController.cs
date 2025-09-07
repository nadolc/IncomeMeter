using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.Middleware;
using System.Security.Claims;
using Serilog;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoutesController : ControllerBase
{
    private readonly IRouteService _routeService;
    private readonly ILogger<RoutesController> _logger;

    public RoutesController(IRouteService routeService, ILogger<RoutesController> logger)
    {
        _routeService = routeService;
        _logger = logger;
    }

    // Helper to get the authenticated user ID from JWT claims
    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("read:routes")]
    public async Task<IActionResult> GetRoutes()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var routes = await _routeService.GetRoutesByUserIdAsync(userId);
        return Ok(routes);
    }

    [HttpPost("start")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("write:routes")]
    public async Task<IActionResult> StartRoute([FromBody] StartRouteDto startRouteDto)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "RouteStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("WorkType", startRouteDto.WorkType)
            .Information("User started a new route");

        var route = await _routeService.StartRouteAsync(startRouteDto, userId);

        Log.Logger
            .ForContext("EventType", "RouteCreated")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", route!.Id?[..Math.Min(8, route.Id.Length)] + "***")
            .ForContext("WorkType", route.WorkType)
            .ForContext("Status", route.Status)
            .Information("Route created successfully");

        return CreatedAtAction(nameof(GetRouteById), new { id = route!.Id }, route);
    }

    [HttpGet("{id}")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("read:routes")]
    public async Task<IActionResult> GetRouteById(string id)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var route = await _routeService.GetRouteByIdAsync(id, userId);

        if (route == null)
        {
            return NotFound();
        }

        return Ok(route);
    }

    [HttpPost]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("write:routes")]
    public async Task<IActionResult> CreateRoute([FromBody] CreateRouteDto createRouteDto)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "RouteCreationStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("WorkType", createRouteDto.WorkType)
            .Information("User initiated route creation");

        var route = await _routeService.CreateRouteAsync(createRouteDto, userId);

        Log.Logger
            .ForContext("EventType", "RouteCreated")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", route!.Id?[..Math.Min(8, route.Id.Length)] + "***")
            .ForContext("WorkType", route.WorkType)
            .ForContext("Status", route.Status)
            .Information("Route created successfully");

        return CreatedAtAction(nameof(GetRouteById), new { id = route!.Id }, route);
    }

    [HttpPost("end")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("write:routes")]
    public async Task<IActionResult> EndRoute([FromBody] EndRouteDto endRouteDto)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "RouteEndingStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", endRouteDto.Id?[..Math.Min(8, endRouteDto.Id.Length)] + "***")
            .ForContext("EndMile", endRouteDto.EndMile)
            .Information("User initiated route ending");

        var route = await _routeService.EndRouteAsync(endRouteDto, userId);
        if (route == null)
        {
            Log.Logger
                .ForContext("EventType", "RouteNotFound")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("RouteId", endRouteDto.Id?[..Math.Min(8, endRouteDto.Id.Length)] + "***")
                .Warning("Route not found when attempting to end route");
            return NotFound();
        }

        Log.Logger
            .ForContext("EventType", "RouteCompleted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", route.Id?[..Math.Min(8, route.Id.Length)] + "***")
            .ForContext("TotalIncome", route.TotalIncome)
            .ForContext("Distance", route.Distance)
            .ForContext("WorkType", route.WorkType)
            .ForContext("Status", route.Status)
            .Information("Route completed successfully with income: {TotalIncome}", route.TotalIncome);

        return Ok(route);
    }

    [HttpPut("{id}")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("write:routes")]
    public async Task<IActionResult> UpdateRoute(string id, [FromBody] UpdateRouteDto updateRouteDto)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "RouteUpdateStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", id[..Math.Min(8, id.Length)] + "***")
            .Information("User initiated route update");

        var route = await _routeService.UpdateRouteAsync(id, updateRouteDto, userId);
        if (route == null)
        {
            Log.Logger
                .ForContext("EventType", "RouteUpdateNotFound")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("RouteId", id[..Math.Min(8, id.Length)] + "***")
                .Warning("Route not found when attempting to update");
            return NotFound();
        }

        Log.Logger
            .ForContext("EventType", "RouteUpdateSuccess")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", id[..Math.Min(8, id.Length)] + "***")
            .Information("Route updated successfully");

        return Ok(route);
    }

    [HttpDelete("{id}")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("delete:routes")]
    public async Task<IActionResult> DeleteRoute(string id)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "RouteDeletionStarted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", id[..Math.Min(8, id.Length)] + "***")
            .Information("User initiated route deletion");

        var success = await _routeService.DeleteRouteAsync(id, userId);
        if (!success)
        {
            Log.Logger
                .ForContext("EventType", "RouteDeleteFailed")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("RouteId", id[..Math.Min(8, id.Length)] + "***")
                .Warning("Route deletion failed - route not found or access denied");
            return NotFound();
        }

        Log.Logger
            .ForContext("EventType", "RouteDeleted")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", id[..Math.Min(8, id.Length)] + "***")
            .Information("Route deleted successfully");

        return NoContent();
    }

    [HttpGet("status/{status}")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("read:routes")]
    public async Task<IActionResult> GetRoutesByStatus(string status)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var routes = await _routeService.GetRoutesByStatusAsync(userId, status);
        return Ok(routes);
    }

    [HttpGet("date-range")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("read:routes")]
    public async Task<IActionResult> GetRoutesByDateRange([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var routes = await _routeService.GetRoutesByDateRangeAsync(userId, startDate, endDate);
        return Ok(routes);
    }

    /// <summary>
    /// Start a new route using API key authentication (compatible with iOS shortcuts)
    /// </summary>
    /// <param name="startRouteDto">Route start data including workType, optional workTypeId (ObjectId), startMile, and estimatedIncome</param>
    /// <returns>Route creation response with routeId</returns>
    /// <remarks>
    /// POST Body Example:
    /// {
    ///   "workType": "Delivery",
    ///   "workTypeId": "507f1f77bcf86cd799439011",  // Optional: ObjectId of work type configuration
    ///   "startMile": 12500.5,
    ///   "estimatedIncome": 150.00
    /// }
    /// </remarks>
    [HttpPost("start-with-apikey")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("write:routes")]
    public async Task<IActionResult> StartRouteWithApiKey([FromBody] StartRouteDto startRouteDto)
    {
        // Debug: Check what's in the Authorization header

        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "Valid API key required" });
        }
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        try
        {

            // Validate workTypeId format if provided
            if (!string.IsNullOrEmpty(startRouteDto.WorkTypeId) && startRouteDto.WorkTypeId.Length != 24)
            {
                Log.Logger
                    .ForContext("EventType", "RouteStartValidationError")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("WorkTypeId", startRouteDto.WorkTypeId)
                    .Warning("Invalid WorkTypeId format provided via API key");

                return BadRequest(new
                {
                    success = false,
                    error = "WorkTypeId must be a valid 24-character ObjectId format",
                    workTypeId = startRouteDto.WorkTypeId
                });
            }

            Log.Logger
                .ForContext("EventType", "RouteStartRequested")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .ForContext("WorkType", startRouteDto.WorkType)
                .ForContext("WorkTypeId", string.IsNullOrEmpty(startRouteDto.WorkTypeId) ? null : startRouteDto.WorkTypeId[..Math.Min(8, startRouteDto.WorkTypeId.Length)] + "***")
                .ForContext("StartMile", startRouteDto.StartMile)
                .ForContext("EstimatedIncome", startRouteDto.EstimatedIncome)
                .Information("User started a new route via API key");

            var route = await _routeService.StartRouteAsync(startRouteDto, userId!);

            Log.Logger
                .ForContext("EventType", "RouteCreated")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .ForContext("RouteId", route.Id?[..Math.Min(8, route.Id.Length)] + "***")
                .ForContext("WorkType", route.WorkType)
                .ForContext("WorkTypeId", string.IsNullOrEmpty(route.WorkTypeId) ? null : route.WorkTypeId[..Math.Min(8, route.WorkTypeId.Length)] + "***")
                .Information("Route created successfully via API key");

            // Return iOS-friendly response with prominent routeId
            return Ok(new
            {
                success = true,
                message = "Route started successfully",
                routeId = route.Id,
                workType = route.WorkType,
                workTypeId = route.WorkTypeId,
                startMile = route.StartMile,
                estimatedIncome = route.EstimatedIncome,
                route = route
            });
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "RouteStartFailed")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .ForContext("Error", ex.Message)
                .Error(ex, "Failed to start route via API key");

            return StatusCode(500, new { message = "Failed to start route", error = ex.Message });
        }
    }

    // API Key compatible endpoint for ending routes via iOS shortcuts
    [HttpPost("end-with-apikey")]
    [Authorize(AuthenticationSchemes = "Bearer")]
    [RequireScopes("write:routes")]
    public async Task<IActionResult> EndRouteWithApiKey([FromBody] EndRouteIOSDto endRouteDto)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "Valid API key required" });
        }

        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        // Validate model state (basic required fields and ranges)
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();

            Log.Logger
                .ForContext("EventType", "RouteEndValidationFailed")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .ForContext("ValidationErrors", errors)
                .Warning("iOS route end validation failed: {ValidationErrors}", string.Join(", ", errors));

            return BadRequest(new { error = "Validation failed", details = errors });
        }

        // Additional custom validation
        var validationError = endRouteDto.GetValidationError();
        if (!string.IsNullOrEmpty(validationError))
        {
            Log.Logger
                .ForContext("EventType", "RouteEndCustomValidationFailed")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .ForContext("ValidationError", validationError)
                .Warning("iOS route end custom validation failed: {ValidationError}", validationError);

            return BadRequest(new { error = validationError });
        }

        // Validate RouteId format (basic ObjectId format check)
        if (string.IsNullOrWhiteSpace(endRouteDto.RouteId) || endRouteDto.RouteId.Length != 24)
        {
            Log.Logger
                .ForContext("EventType", "RouteEndRouteIdValidationError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .ForContext("RouteId", endRouteDto.RouteId)
                .Warning("iOS route end RouteId format validation failed");

            return BadRequest(new { error = "RouteId must be a valid 24-character ObjectId" });
        }

        try
        {
            Log.Logger
                .ForContext("EventType", "RouteEndingStarted")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .ForContext("RouteId", endRouteDto.RouteId[..Math.Min(8, endRouteDto.RouteId.Length)] + "***")
                .ForContext("EndMile", endRouteDto.EndMile)
                .ForContext("SchedulePeriod", endRouteDto.SchedulePeriod)
                .Information("User ending route via API key - validation passed");

            var route = await _routeService.EndRouteFromIOSAsync(endRouteDto, userId!);

            if (route == null)
            {
                Log.Logger
                    .ForContext("EventType", "RouteEndFailed")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("RouteId", endRouteDto.RouteId[..Math.Min(8, endRouteDto.RouteId.Length)] + "***")
                    .Warning("Route not found when attempting to end route via API key");
                return NotFound(new { error = "Route not found or you do not have access to this route", routeId = endRouteDto.RouteId });
            }

            Log.Logger
                .ForContext("EventType", "RouteCompleted")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .ForContext("RouteId", route.Id?[..Math.Min(8, route.Id.Length)] + "***")
                .ForContext("TotalIncome", route.TotalIncome)
                .ForContext("Distance", route.Distance)
                .Information("Route ended successfully via API key with income: {TotalIncome}", route.TotalIncome);

            // Return iOS-friendly response
            return Ok(new
            {
                success = true,
                message = "Route ended successfully",
                routeId = route.Id,
                totalIncome = route.TotalIncome,
                distance = route.Distance,
                route = route
            });
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "RouteEndFailed")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId?[..Math.Min(8, userId.Length)] + "***")
                .ForContext("RouteId", endRouteDto.RouteId[..Math.Min(8, endRouteDto.RouteId.Length)] + "***")
                .ForContext("Error", ex.Message)
                .Error(ex, "Failed to end route via API key");

            return StatusCode(500, new { message = "Failed to end route", error = ex.Message });
        }
    }

    // Debug endpoint to test API key authentication
    [HttpGet("test-apikey")]
    public async Task<IActionResult> TestApiKey()
    {
        var authHeader = HttpContext.Request.Headers["Authorization"].FirstOrDefault();
        var user = HttpContext.Items["User"] as User;

        return Ok(new
        {
            HasAuthHeader = !string.IsNullOrEmpty(authHeader),
            AuthHeaderPrefix = authHeader?.Substring(0, Math.Min(20, authHeader?.Length ?? 0)),
            UserFound = user != null,
            UserEmail = user?.Email,
            AllHeaders = HttpContext.Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString())
        });
    }
}