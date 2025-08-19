using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Serilog;

namespace IncomeMeter.Api.Controllers;

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

    [HttpGet("{id}")]
    public async Task<IActionResult> GetLocationById(string id)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "LocationByIdRequest")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
            .Information("User requested location by ID");

        var location = await _locationService.GetLocationByIdAsync(id, userId);
        
        if (location == null)
        {
            Log.Logger
                .ForContext("EventType", "LocationByIdNotFound")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                .Warning("Location not found or user unauthorized");
            return NotFound();
        }

        Log.Logger
            .ForContext("EventType", "LocationByIdSuccess")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
            .Information("Location returned successfully by ID");
            
        return Ok(location);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateLocation(string id, [FromBody] UpdateLocationDto dto)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "LocationUpdateRequest")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
            .Information("User requested to update location");

        try
        {
            var location = await _locationService.UpdateLocationAsync(id, dto, userId);
            if (location == null)
            {
                Log.Logger
                    .ForContext("EventType", "LocationUpdateNotFound")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                    .Warning("Location not found or user unauthorized for update");
                return NotFound();
            }

            Log.Logger
                .ForContext("EventType", "LocationUpdateSuccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                .Information("Location updated successfully via API");
                
            return Ok(location);
        }
        catch (InvalidOperationException ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationUpdateValidationError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("ValidationError", ex.Message)
                .Warning("Location update failed validation: {ValidationError}", ex.Message);
                
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationUpdateError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Error(ex, "Unexpected error during location update");
                
            return StatusCode(500, new { error = "An unexpected error occurred while updating the location." });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteLocation(string id)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "LocationDeletionRequest")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
            .Information("User requested to delete location");

        try
        {
            var success = await _locationService.DeleteLocationAsync(id, userId);
            if (!success)
            {
                Log.Logger
                    .ForContext("EventType", "LocationDeletionNotFound")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                    .Warning("Location not found or user unauthorized for deletion");
                return NotFound();
            }

            Log.Logger
                .ForContext("EventType", "LocationDeletionSuccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("LocationId", id[..Math.Min(8, id.Length)] + "***")
                .Information("Location deleted successfully via API");
                
            return NoContent();
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationDeletionError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Error(ex, "Unexpected error during location deletion");
                
            return StatusCode(500, new { error = "An unexpected error occurred while deleting the location." });
        }
    }

    [HttpDelete("route/{routeId}")]
    public async Task<IActionResult> DeleteLocationsByRouteId(string routeId)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();
        
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        Log.Logger
            .ForContext("EventType", "LocationsBulkDeletionRequest")
            .ForContext("CorrelationId", correlationId)
            .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
            .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
            .Information("User requested bulk deletion of locations for route");

        try
        {
            var success = await _locationService.DeleteLocationsByRouteIdAsync(routeId, userId);
            if (!success)
            {
                Log.Logger
                    .ForContext("EventType", "LocationsBulkDeletionUnauthorized")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
                    .Warning("Route not found or user unauthorized for bulk location deletion");
                return NotFound();
            }

            Log.Logger
                .ForContext("EventType", "LocationsBulkDeletionSuccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("RouteId", routeId[..Math.Min(8, routeId.Length)] + "***")
                .Information("Bulk deletion of locations completed successfully via API");
                
            return NoContent();
        }
        catch (Exception ex)
        {
            Log.Logger
                .ForContext("EventType", "LocationsBulkDeletionError")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .Error(ex, "Unexpected error during bulk location deletion");
                
            return StatusCode(500, new { error = "An unexpected error occurred while deleting locations." });
        }
    }
}