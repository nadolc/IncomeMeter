using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/configuration")]
public class ConfigurationController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IWorkTypeConfigService _workTypeConfigService;
    private readonly IConfiguration _configuration;

    public ConfigurationController(
        IUserService userService,
        IWorkTypeConfigService workTypeConfigService,
        IConfiguration configuration)
    {
        _userService = userService;
        _workTypeConfigService = workTypeConfigService;
        _configuration = configuration;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// Get user configuration including work types, income sources, and API endpoints.
    /// Requires API Key authentication via Authorization header: "Bearer your-api-key"
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetConfiguration()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "Valid API key required" });
        }

        try
        {
            // Get user information
            var user = await _userService.GetUserByIdAsync(userId);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Get user's work type configurations
            var workTypeConfigs = await _workTypeConfigService.GetWorkTypeConfigsByUserIdAsync(userId);

            // Get base URL for API endpoints
            var baseUrl = $"{Request.Scheme}://{Request.Host}/api";

            // Build the configuration response
            var configuration = new ConfigurationResponseDto
            {
                User = new UserInfo
                {
                    Id = user.Id,
                    Name = user.DisplayName ?? user.Email,
                    Email = user.Email,
                    Currency = user.Settings?.CurrencyCode ?? "GBP",
                    Language = user.Settings?.Language ?? "en-GB",
                    TimeZone = user.Settings?.TimeZone ?? "Europe/London"
                },
                WorkTypes = workTypeConfigs.Select(wt => new WorkTypeConfigResponseDto
                {
                    Id = wt.Id,
                    Name = wt.Name,
                    Description = wt.Description,
                    IsActive = wt.IsActive,
                    CreatedAt = wt.CreatedAt,
                    UpdatedAt = wt.UpdatedAt,
                    IncomeSourceTemplates = wt.IncomeSourceTemplates.Select(ist => new IncomeSourceTemplateDto
                    {
                        Name = ist.Name,
                        Category = ist.Category,
                        DefaultAmount = ist.DefaultAmount,
                        IsRequired = ist.IsRequired,
                        Description = ist.Description,
                        DisplayOrder = ist.DisplayOrder
                    }).OrderBy(ist => ist.DisplayOrder).ToList()
                }).Where(wt => wt.IsActive).ToList(),
                ApiEndpoints = new ApiEndpoints
                {
                    StartRoute = $"{baseUrl}/routes/start",
                    AddLocation = $"{baseUrl}/locations",
                    EndRoute = $"{baseUrl}/routes/end",
                    GetRoutes = $"{baseUrl}/routes",
                    GetRoute = $"{baseUrl}/routes/{{id}}"
                }
            };

            return Ok(configuration);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to retrieve configuration", error = ex.Message });
        }
    }

    /// <summary>
    /// Get available work types only (lightweight version)
    /// Requires API Key authentication via Authorization header: "Bearer your-api-key"
    /// </summary>
    [HttpGet("work-types")]
    public async Task<IActionResult> GetWorkTypes()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "Valid API key required" });
        }

        try
        {
            var workTypeConfigs = await _workTypeConfigService.GetWorkTypeConfigsByUserIdAsync(userId);
            
            var workTypes = workTypeConfigs
                .Where(wt => wt.IsActive)
                .Select(wt => new
                {
                    id = wt.Id,
                    name = wt.Name,
                    description = wt.Description,
                    incomeSourceCount = wt.IncomeSourceTemplates.Count
                })
                .ToList();

            return Ok(new { workTypes });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to retrieve work types", error = ex.Message });
        }
    }

    /// <summary>
    /// Get API endpoints only (for reference)
    /// Requires API Key authentication via Authorization header: "Bearer your-api-key"
    /// </summary>
    [HttpGet("endpoints")]
    public IActionResult GetApiEndpoints()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "Valid API key required" });
        }

        var baseUrl = $"{Request.Scheme}://{Request.Host}/api";
        
        var endpoints = new ApiEndpoints
        {
            StartRoute = $"{baseUrl}/routes/start",
            AddLocation = $"{baseUrl}/locations",
            EndRoute = $"{baseUrl}/routes/end",
            GetRoutes = $"{baseUrl}/routes",
            GetRoute = $"{baseUrl}/routes/{{id}}"
        };

        return Ok(endpoints);
    }
}