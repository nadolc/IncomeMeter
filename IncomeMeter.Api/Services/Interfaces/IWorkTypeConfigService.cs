using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services.Interfaces;

public interface IWorkTypeConfigService
{
    Task<List<WorkTypeConfig>> GetWorkTypeConfigsByUserIdAsync(string userId);
    Task<WorkTypeConfig?> GetWorkTypeConfigByIdAsync(string id, string userId);
    Task<WorkTypeConfig> CreateWorkTypeConfigAsync(CreateWorkTypeConfigDto dto, string userId);
    Task<WorkTypeConfig?> UpdateWorkTypeConfigAsync(string id, UpdateWorkTypeConfigDto dto, string userId);
    Task<bool> DeleteWorkTypeConfigAsync(string id, string userId);
    Task<List<WorkTypeConfig>> GetActiveWorkTypeConfigsByUserIdAsync(string userId);
    
    // Phase 1: Support for default work types
    Task<WorkTypeConfig> CreateAsync(WorkTypeConfig workTypeConfig);
    Task<List<WorkTypeConfig>> GetByUserIdAsync(string userId);
}