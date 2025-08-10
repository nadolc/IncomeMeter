using Microsoft.AspNetCore.Mvc;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoutesController : ControllerBase
{
    private readonly IRouteService _routeService;

    public RoutesController(IRouteService routeService)
    {
        _routeService = routeService;
    }

    // Helper to get the authenticated user from the context
    private User GetCurrentUser() => (User)HttpContext.Items["User"]!;

    [HttpGet]
    public async Task<IActionResult> GetRoutes()
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized();

        var routes = await _routeService.GetRoutesByUserIdAsync(user.Id!);
        return Ok(routes);
    }

    [HttpPost("start")]
    public async Task<IActionResult> StartRoute([FromBody] StartRouteDto startRouteDto)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized();

        var route = await _routeService.StartRouteAsync(startRouteDto, user.Id!);
        return CreatedAtAction(nameof(GetRouteById), new { id = route!.Id }, route);
    }

    // Add this method to your RoutesController.cs file

    [HttpGet("{id}")]
    public async Task<IActionResult> GetRouteById(string id)
    {
        var user = GetCurrentUser();
        if (user == null)
        {
            return Unauthorized(new { error = "Unauthorized" });
        }

        var route = await _routeService.GetRouteByIdAsync(id, user.Id!);

        if (route == null)
        {
            return NotFound();
        }

        return Ok(route);
    }
    // ... Other endpoints like GET by ID, POST /end, PUT, DELETE
}