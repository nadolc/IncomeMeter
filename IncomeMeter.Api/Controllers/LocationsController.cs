using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Serilog;

namespace WorkTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class LocationsController : ControllerBase
{
    private readonly ILocationService _locationService;
    private readonly ILogger<LocationsController> _logger;

    public LocationsController(ILocationService locationService, ILogger<LocationsController> logger)
    {
        _locationService = locationService;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet]
    public async Task<IActionResult> GetLocations([FromQuery] string routeId)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "LocationsRequest")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", routeId?[..Math.Min(8, routeId?.Length ?? 0)] + "***")
            .Information("User requested locations for route");

        var locations = await _locationService.GetLocationsByRouteIdAsync(routeId, userId);
        
        Log.Logger
            .ForContext("EventType", "LocationsRequestSuccess")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", routeId?[..Math.Min(8, routeId?.Length ?? 0)] + "***")
            .ForContext("LocationCount", locations.Count)
            .Information("Locations returned successfully");
            
        return Ok(locations);
    }

    [HttpPost]
    public async Task<IActionResult> AddLocation([FromBody] CreateLocationDto dto)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "LocationAdditionRequest")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", dto.RouteId[..Math.Min(8, dto.RouteId.Length)] + "***")
            .ForContext("Latitude", Math.Round(dto.Latitude, 6))
            .ForContext("Longitude", Math.Round(dto.Longitude, 6))
            .Information("User requested to add new location");

        try
        {
            var location = await _locationService.AddLocationAsync(dto, userId);
            if (location == null)
            {
                Log.Logger
                    .ForContext("EventType", "LocationAdditionUnauthorized")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("RouteId", dto.RouteId[..Math.Min(8, dto.RouteId.Length)] + "***")
                    .Warning("User does not have access to route for location addition");
                    
                return Forbid("You do not have access to this route.");
            }

            Log.Logger
                .ForContext("EventType", "LocationAdditionSuccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("LocationId", location.Id?[..Math.Min(8, location.Id.Length)] + "***")
                .Information("Location added successfully via API");
                
            return CreatedAtAction(nameof(GetLocations), new { routeId = location.RouteId }, location);
        }
        catch (InvalidOperationException ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationAdditionValidationError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("ValidationError", ex.Message)
                .Warning("Location addition failed validation: {ValidationError}", ex.Message);
                
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationAdditionError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Error(ex, "Unexpected error during location addition");
                
            return StatusCode(500, new { error = "An unexpected error occurred while adding the location." });
        }
    }
}