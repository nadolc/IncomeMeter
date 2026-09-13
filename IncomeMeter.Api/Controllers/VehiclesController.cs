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

    [HttpGet]
    public async Task<IActionResult> GetVehicles([FromQuery] bool includeInactive = false)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        return Ok(await _vehicleService.GetVehiclesAsync(userId, includeInactive));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetVehicle(string id)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var vehicle = await _vehicleService.GetVehicleByIdAsync(id, userId);
        return vehicle == null ? NotFound() : Ok(vehicle);
    }

    [HttpPost]
    public async Task<IActionResult> CreateVehicle([FromBody] CreateVehicleDto dto)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var vehicle = await _vehicleService.CreateVehicleAsync(dto, userId);
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
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var vehicle = await _vehicleService.UpdateVehicleAsync(id, dto, userId);
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
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var deleted = await _vehicleService.DeleteVehicleAsync(id, userId);
        return deleted ? NoContent() : NotFound();
    }
}
