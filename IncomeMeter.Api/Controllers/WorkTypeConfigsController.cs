using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Services.Interfaces;
using System.Security.Claims;
using Serilog;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/work-type-configs")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class WorkTypeConfigsController : ControllerBase
{
    private readonly IWorkTypeConfigService _workTypeConfigService;
    private readonly ILogger<WorkTypeConfigsController> _logger;

    public WorkTypeConfigsController(IWorkTypeConfigService workTypeConfigService, ILogger<WorkTypeConfigsController> logger)
    {
        _workTypeConfigService = workTypeConfigService;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet]
    public async Task<IActionResult> GetWorkTypeConfigs()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        try
        {
            var workTypeConfigs = await _workTypeConfigService.GetWorkTypeConfigsByUserIdAsync(userId);
            
            var response = workTypeConfigs.Select(w => new WorkTypeConfigResponseDto
            {
                Id = w.Id,
                Name = w.Name,
                Description = w.Description,
                IncomeSourceTemplates = w.IncomeSourceTemplates.Select(t => new IncomeSourceTemplateDto
                {
                    Name = t.Name,
                    Category = t.Category,
                    DefaultAmount = t.DefaultAmount,
                    IsRequired = t.IsRequired,
                    Description = t.Description,
                    DisplayOrder = t.DisplayOrder
                }).OrderBy(t => t.DisplayOrder).ToList(),
                IsActive = w.IsActive,
                CreatedAt = w.CreatedAt,
                UpdatedAt = w.UpdatedAt
            }).ToList();

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving work type configs for user {UserId}", 
                userId[..Math.Min(8, userId.Length)] + "***");
            return StatusCode(500, "An error occurred while retrieving work type configurations");
        }
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveWorkTypeConfigs()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        try
        {
            var workTypeConfigs = await _workTypeConfigService.GetActiveWorkTypeConfigsByUserIdAsync(userId);
            
            var response = workTypeConfigs.Select(w => new WorkTypeConfigResponseDto
            {
                Id = w.Id,
                Name = w.Name,
                Description = w.Description,
                IncomeSourceTemplates = w.IncomeSourceTemplates.Select(t => new IncomeSourceTemplateDto
                {
                    Name = t.Name,
                    Category = t.Category,
                    DefaultAmount = t.DefaultAmount,
                    IsRequired = t.IsRequired,
                    Description = t.Description,
                    DisplayOrder = t.DisplayOrder
                }).OrderBy(t => t.DisplayOrder).ToList(),
                IsActive = w.IsActive,
                CreatedAt = w.CreatedAt,
                UpdatedAt = w.UpdatedAt
            }).ToList();

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving active work type configs for user {UserId}", 
                userId[..Math.Min(8, userId.Length)] + "***");
            return StatusCode(500, "An error occurred while retrieving active work type configurations");
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetWorkTypeConfigById(string id)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        try
        {
            var workTypeConfig = await _workTypeConfigService.GetWorkTypeConfigByIdAsync(id, userId);

            if (workTypeConfig == null)
            {
                return NotFound();
            }

            var response = new WorkTypeConfigResponseDto
            {
                Id = workTypeConfig.Id,
                Name = workTypeConfig.Name,
                Description = workTypeConfig.Description,
                IncomeSourceTemplates = workTypeConfig.IncomeSourceTemplates.Select(t => new IncomeSourceTemplateDto
                {
                    Name = t.Name,
                    Category = t.Category,
                    DefaultAmount = t.DefaultAmount,
                    IsRequired = t.IsRequired,
                    Description = t.Description,
                    DisplayOrder = t.DisplayOrder
                }).OrderBy(t => t.DisplayOrder).ToList(),
                IsActive = workTypeConfig.IsActive,
                CreatedAt = workTypeConfig.CreatedAt,
                UpdatedAt = workTypeConfig.UpdatedAt
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving work type config {WorkTypeConfigId} for user {UserId}", 
                id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            return StatusCode(500, "An error occurred while retrieving the work type configuration");
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateWorkTypeConfig([FromBody] CreateWorkTypeConfigDto dto)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        try
        {
            Log.Logger
                .ForContext("EventType", "WorkTypeConfigCreationStarted")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("WorkTypeConfigName", dto.Name)
                .Information("User initiated work type config creation");

            var workTypeConfig = await _workTypeConfigService.CreateWorkTypeConfigAsync(dto, userId);

            Log.Logger
                .ForContext("EventType", "WorkTypeConfigCreated")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("WorkTypeConfigId", workTypeConfig.Id[..Math.Min(8, workTypeConfig.Id.Length)] + "***")
                .ForContext("WorkTypeConfigName", workTypeConfig.Name)
                .Information("Work type config created successfully");

            var response = new WorkTypeConfigResponseDto
            {
                Id = workTypeConfig.Id,
                Name = workTypeConfig.Name,
                Description = workTypeConfig.Description,
                IncomeSourceTemplates = workTypeConfig.IncomeSourceTemplates.Select(t => new IncomeSourceTemplateDto
                {
                    Name = t.Name,
                    Category = t.Category,
                    DefaultAmount = t.DefaultAmount,
                    IsRequired = t.IsRequired,
                    Description = t.Description,
                    DisplayOrder = t.DisplayOrder
                }).OrderBy(t => t.DisplayOrder).ToList(),
                IsActive = workTypeConfig.IsActive,
                CreatedAt = workTypeConfig.CreatedAt,
                UpdatedAt = workTypeConfig.UpdatedAt
            };

            return CreatedAtAction(nameof(GetWorkTypeConfigById), new { id = workTypeConfig.Id }, response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating work type config '{Name}' for user {UserId}", 
                dto.Name, userId[..Math.Min(8, userId.Length)] + "***");
            return StatusCode(500, "An error occurred while creating the work type configuration");
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateWorkTypeConfig(string id, [FromBody] UpdateWorkTypeConfigDto dto)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        try
        {
            Log.Logger
                .ForContext("EventType", "WorkTypeConfigUpdateStarted")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("WorkTypeConfigId", id[..Math.Min(8, id.Length)] + "***")
                .Information("User initiated work type config update");

            var workTypeConfig = await _workTypeConfigService.UpdateWorkTypeConfigAsync(id, dto, userId);

            if (workTypeConfig == null)
            {
                Log.Logger
                    .ForContext("EventType", "WorkTypeConfigUpdateNotFound")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("WorkTypeConfigId", id[..Math.Min(8, id.Length)] + "***")
                    .Warning("Work type config not found when attempting to update");
                return NotFound();
            }

            Log.Logger
                .ForContext("EventType", "WorkTypeConfigUpdateSuccess")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("WorkTypeConfigId", id[..Math.Min(8, id.Length)] + "***")
                .Information("Work type config updated successfully");

            var response = new WorkTypeConfigResponseDto
            {
                Id = workTypeConfig.Id,
                Name = workTypeConfig.Name,
                Description = workTypeConfig.Description,
                IncomeSourceTemplates = workTypeConfig.IncomeSourceTemplates.Select(t => new IncomeSourceTemplateDto
                {
                    Name = t.Name,
                    Category = t.Category,
                    DefaultAmount = t.DefaultAmount,
                    IsRequired = t.IsRequired,
                    Description = t.Description,
                    DisplayOrder = t.DisplayOrder
                }).OrderBy(t => t.DisplayOrder).ToList(),
                IsActive = workTypeConfig.IsActive,
                CreatedAt = workTypeConfig.CreatedAt,
                UpdatedAt = workTypeConfig.UpdatedAt
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating work type config {WorkTypeConfigId} for user {UserId}", 
                id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            return StatusCode(500, "An error occurred while updating the work type configuration");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWorkTypeConfig(string id)
    {
        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString();

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        try
        {
            Log.Logger
                .ForContext("EventType", "WorkTypeConfigDeletionStarted")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("WorkTypeConfigId", id[..Math.Min(8, id.Length)] + "***")
                .Information("User initiated work type config deletion");

            var success = await _workTypeConfigService.DeleteWorkTypeConfigAsync(id, userId);

            if (!success)
            {
                Log.Logger
                    .ForContext("EventType", "WorkTypeConfigDeleteFailed")
                    .ForContext("CorrelationId", correlationId)
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("WorkTypeConfigId", id[..Math.Min(8, id.Length)] + "***")
                    .Warning("Work type config deletion failed - config not found or access denied");
                return NotFound();
            }

            Log.Logger
                .ForContext("EventType", "WorkTypeConfigDeleted")
                .ForContext("CorrelationId", correlationId)
                .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                .ForContext("WorkTypeConfigId", id[..Math.Min(8, id.Length)] + "***")
                .Information("Work type config deleted successfully");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting work type config {WorkTypeConfigId} for user {UserId}", 
                id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            return StatusCode(500, "An error occurred while deleting the work type configuration");
        }
    }
}