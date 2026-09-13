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
    private readonly IVehicleLookupService _lookup;

    public VehiclesController(IVehicleService vehicleService, IVehicleLookupService lookup)
    {
        _vehicleService = vehicleService;
        _lookup = lookup;
    }

    /// <summary>Look up make / fuel / CO2 / MOT / tax from the DVLA by registration. Requires Dvla:ApiKey.</summary>
    [HttpGet("lookup/{registration}")]
    public async Task<IActionResult> Lookup(string registration, CancellationToken ct)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });
        if (!_lookup.IsConfigured)
            return StatusCode(503, new { error = "Vehicle lookup is not configured (set Dvla:ApiKey and/or the Dvsa:* settings)" });

        try
        {
            var result = await _lookup.LookupAsync(registration, ct);
            return result == null ? NotFound(new { error = "No DVLA record for that registration" }) : Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (VehicleLookupThrottledException ex)
        {
            Response.Headers.RetryAfter = "5";
            return StatusCode(429, new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(502, new { error = ex.Message });
        }
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

    /// <summary>Attach this vehicle to existing routes / expenses / odometer readings (by default only those without a vehicle, from the purchase date onward).</summary>
    [HttpPost("{id}/backfill")]
    public async Task<IActionResult> Backfill(string id, [FromBody] BackfillVehicleDto? options)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var result = await _vehicleService.BackfillAsync(id, options ?? new BackfillVehicleDto(), userId);
        return result == null ? NotFound() : Ok(result);
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
