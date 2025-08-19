using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using System.Security.Claims;
using Serilog;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = "Bearer")]
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
}