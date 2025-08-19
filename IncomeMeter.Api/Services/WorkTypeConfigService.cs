using MongoDB.Driver;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;

namespace IncomeMeter.Api.Services;

public class WorkTypeConfigService : IWorkTypeConfigService
{
    private readonly IMongoCollection<WorkTypeConfig> _workTypeConfigs;
    private readonly ILogger<WorkTypeConfigService> _logger;

    public WorkTypeConfigService(MongoDbContext context, ILogger<WorkTypeConfigService> logger)
    {
        _workTypeConfigs = context.WorkTypeConfigs;
        _logger = logger;
    }

    public async Task<List<WorkTypeConfig>> GetWorkTypeConfigsByUserIdAsync(string userId)
    {
        try
        {
            var filter = Builders<WorkTypeConfig>.Filter.Eq(w => w.UserId, userId);
            var workTypeConfigs = await _workTypeConfigs
                .Find(filter)
                .SortByDescending(w => w.CreatedAt)
                .ToListAsync();

            _logger.LogInformation("Retrieved {Count} work type configs for user {UserId}", 
                workTypeConfigs.Count, userId[..Math.Min(8, userId.Length)] + "***");

            return workTypeConfigs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving work type configs for user {UserId}", 
                userId[..Math.Min(8, userId.Length)] + "***");
            throw;
        }
    }

    public async Task<WorkTypeConfig?> GetWorkTypeConfigByIdAsync(string id, string userId)
    {
        try
        {
            var filter = Builders<WorkTypeConfig>.Filter.And(
                Builders<WorkTypeConfig>.Filter.Eq(w => w.Id, id),
                Builders<WorkTypeConfig>.Filter.Eq(w => w.UserId, userId)
            );

            var workTypeConfig = await _workTypeConfigs.Find(filter).FirstOrDefaultAsync();

            if (workTypeConfig != null)
            {
                _logger.LogInformation("Retrieved work type config {WorkTypeConfigId} for user {UserId}", 
                    id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            }
            else
            {
                _logger.LogWarning("Work type config {WorkTypeConfigId} not found for user {UserId}", 
                    id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            }

            return workTypeConfig;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving work type config {WorkTypeConfigId} for user {UserId}", 
                id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            throw;
        }
    }

    public async Task<WorkTypeConfig> CreateWorkTypeConfigAsync(CreateWorkTypeConfigDto dto, string userId)
    {
        try
        {
            var workTypeConfig = new WorkTypeConfig
            {
                UserId = userId,
                Name = dto.Name,
                Description = dto.Description,
                IncomeSourceTemplates = dto.IncomeSourceTemplates.Select(t => new IncomeSourceTemplate
                {
                    Name = t.Name,
                    Category = t.Category,
                    DefaultAmount = t.DefaultAmount,
                    IsRequired = t.IsRequired,
                    Description = t.Description,
                    DisplayOrder = t.DisplayOrder
                }).ToList(),
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _workTypeConfigs.InsertOneAsync(workTypeConfig);

            _logger.LogInformation("Created work type config {WorkTypeConfigId} '{Name}' for user {UserId}", 
                workTypeConfig.Id[..Math.Min(8, workTypeConfig.Id.Length)] + "***", 
                workTypeConfig.Name, 
                userId[..Math.Min(8, userId.Length)] + "***");

            return workTypeConfig;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating work type config '{Name}' for user {UserId}", 
                dto.Name, userId[..Math.Min(8, userId.Length)] + "***");
            throw;
        }
    }

    public async Task<WorkTypeConfig?> UpdateWorkTypeConfigAsync(string id, UpdateWorkTypeConfigDto dto, string userId)
    {
        try
        {
            var filter = Builders<WorkTypeConfig>.Filter.And(
                Builders<WorkTypeConfig>.Filter.Eq(w => w.Id, id),
                Builders<WorkTypeConfig>.Filter.Eq(w => w.UserId, userId)
            );

            var updateDefinition = Builders<WorkTypeConfig>.Update.Set(w => w.UpdatedAt, DateTime.UtcNow);

            if (dto.Name != null)
                updateDefinition = updateDefinition.Set(w => w.Name, dto.Name);

            if (dto.Description != null)
                updateDefinition = updateDefinition.Set(w => w.Description, dto.Description);

            if (dto.IncomeSourceTemplates != null)
            {
                var templates = dto.IncomeSourceTemplates.Select(t => new IncomeSourceTemplate
                {
                    Name = t.Name,
                    Category = t.Category,
                    DefaultAmount = t.DefaultAmount,
                    IsRequired = t.IsRequired,
                    Description = t.Description,
                    DisplayOrder = t.DisplayOrder
                }).ToList();

                updateDefinition = updateDefinition.Set(w => w.IncomeSourceTemplates, templates);
            }

            if (dto.IsActive.HasValue)
                updateDefinition = updateDefinition.Set(w => w.IsActive, dto.IsActive.Value);

            var options = new FindOneAndUpdateOptions<WorkTypeConfig>
            {
                ReturnDocument = ReturnDocument.After
            };

            var updatedWorkTypeConfig = await _workTypeConfigs.FindOneAndUpdateAsync(filter, updateDefinition, options);

            if (updatedWorkTypeConfig != null)
            {
                _logger.LogInformation("Updated work type config {WorkTypeConfigId} for user {UserId}", 
                    id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            }
            else
            {
                _logger.LogWarning("Work type config {WorkTypeConfigId} not found for update for user {UserId}", 
                    id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            }

            return updatedWorkTypeConfig;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating work type config {WorkTypeConfigId} for user {UserId}", 
                id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            throw;
        }
    }

    public async Task<bool> DeleteWorkTypeConfigAsync(string id, string userId)
    {
        try
        {
            var filter = Builders<WorkTypeConfig>.Filter.And(
                Builders<WorkTypeConfig>.Filter.Eq(w => w.Id, id),
                Builders<WorkTypeConfig>.Filter.Eq(w => w.UserId, userId)
            );

            var result = await _workTypeConfigs.DeleteOneAsync(filter);

            if (result.DeletedCount > 0)
            {
                _logger.LogInformation("Deleted work type config {WorkTypeConfigId} for user {UserId}", 
                    id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
                return true;
            }
            else
            {
                _logger.LogWarning("Work type config {WorkTypeConfigId} not found for deletion for user {UserId}", 
                    id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting work type config {WorkTypeConfigId} for user {UserId}", 
                id[..Math.Min(8, id.Length)] + "***", userId[..Math.Min(8, userId.Length)] + "***");
            throw;
        }
    }

    public async Task<List<WorkTypeConfig>> GetActiveWorkTypeConfigsByUserIdAsync(string userId)
    {
        try
        {
            var filter = Builders<WorkTypeConfig>.Filter.And(
                Builders<WorkTypeConfig>.Filter.Eq(w => w.UserId, userId),
                Builders<WorkTypeConfig>.Filter.Eq(w => w.IsActive, true)
            );

            var workTypeConfigs = await _workTypeConfigs
                .Find(filter)
                .SortBy(w => w.Name)
                .ToListAsync();

            _logger.LogInformation("Retrieved {Count} active work type configs for user {UserId}", 
                workTypeConfigs.Count, userId[..Math.Min(8, userId.Length)] + "***");

            return workTypeConfigs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving active work type configs for user {UserId}", 
                userId[..Math.Min(8, userId.Length)] + "***");
            throw;
        }
    }

    // Phase 1: Support for default work types
    public async Task<WorkTypeConfig> CreateAsync(WorkTypeConfig workTypeConfig)
    {
        try
        {
            workTypeConfig.CreatedAt = DateTime.UtcNow;
            workTypeConfig.UpdatedAt = DateTime.UtcNow;

            await _workTypeConfigs.InsertOneAsync(workTypeConfig);

            _logger.LogInformation("Created work type config {WorkTypeConfigId} '{Name}' for user {UserId}", 
                workTypeConfig.Id[..Math.Min(8, workTypeConfig.Id.Length)] + "***", 
                workTypeConfig.Name,
                workTypeConfig.UserId[..Math.Min(8, workTypeConfig.UserId.Length)] + "***");

            return workTypeConfig;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating work type config '{Name}' for user {UserId}", 
                workTypeConfig.Name, workTypeConfig.UserId[..Math.Min(8, workTypeConfig.UserId.Length)] + "***");
            throw;
        }
    }

    public async Task<List<WorkTypeConfig>> GetByUserIdAsync(string userId)
    {
        try
        {
            var workTypeConfigs = await _workTypeConfigs
                .Find(w => w.UserId == userId)
                .SortBy(w => w.Name)
                .ToListAsync();

            _logger.LogInformation("Retrieved {Count} work type configs for user {UserId}", 
                workTypeConfigs.Count, userId[..Math.Min(8, userId.Length)] + "***");

            return workTypeConfigs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving work type configs for user {UserId}", 
                userId[..Math.Min(8, userId.Length)] + "***");
            throw;
        }
    }
}