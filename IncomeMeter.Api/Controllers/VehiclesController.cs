using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class VehiclesController : ControllerBase
{
    private readonly IVehicleService _vehicleService;

    public VehiclesController(IVehicleService vehicleService)
    {
        _vehicleService = vehicleService;
    }

    private User? GetCurrentUser() => HttpContext.Items["User"] as User;

    [HttpGet]
    public async Task<IActionResult> GetVehicles([FromQuery] bool includeInactive = false)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized(new { error = "Unauthorized" });

        return Ok(await _vehicleService.GetVehiclesAsync(user.Id!, includeInactive));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetVehicle(string id)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized(new { error = "Unauthorized" });

        var vehicle = await _vehicleService.GetVehicleByIdAsync(id, user.Id!);
        return vehicle == null ? NotFound() : Ok(vehicle);
    }

    [HttpPost]
    public async Task<IActionResult> CreateVehicle([FromBody] CreateVehicleDto dto)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized(new { error = "Unauthorized" });
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var vehicle = await _vehicleService.CreateVehicleAsync(dto, user.Id!);
            return CreatedAtAction(nameof(GetVehicle), new { id = vehicle.Id }, vehicle);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateVehicle(string id, [FromBody] UpdateVehicleDto dto)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized(new { error = "Unauthorized" });
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var vehicle = await _vehicleService.UpdateVehicleAsync(id, dto, user.Id!);
            return vehicle == null ? NotFound() : Ok(vehicle);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteVehicle(string id)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized(new { error = "Unauthorized" });

        var deleted = await _vehicleService.DeleteVehicleAsync(id, user.Id!);
        return deleted ? NoContent() : NotFound();
    }
}
