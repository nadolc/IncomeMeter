using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace WorkTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LocationsController : ControllerBase
{
    private readonly ILocationService _locationService;

    public LocationsController(ILocationService locationService)
    {
        _locationService = locationService;
    }

    private User GetCurrentUser() => (User)HttpContext.Items["User"]!;

    [HttpGet]
    public async Task<IActionResult> GetLocations([FromQuery] string routeId)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized();

        var locations = await _locationService.GetLocationsByRouteIdAsync(routeId, user.Id!);
        return Ok(locations);
    }

    [HttpPost]
    public async Task<IActionResult> AddLocation([FromBody] CreateLocationDto dto)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized();

        try
        {
            var location = await _locationService.AddLocationAsync(dto, user.Id!);
            if (location == null)
            {
                return Forbid("You do not have access to this route.");
            }
            return CreatedAtAction(nameof(GetLocations), new { routeId = location.RouteId }, location);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}