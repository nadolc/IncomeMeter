using MongoDB.Bson;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;

namespace IncomeMeter.Api.Services;

public class DefaultWorkTypeService
{
    private readonly IWorkTypeConfigService _workTypeConfigService;

    public DefaultWorkTypeService(IWorkTypeConfigService workTypeConfigService)
    {
        _workTypeConfigService = workTypeConfigService;
    }

    /// <summary>
    /// Gets predefined system default work types
    /// </summary>
    public List<WorkTypeConfig> GetSystemDefaultWorkTypes()
    {
        return new List<WorkTypeConfig>
        {
            new WorkTypeConfig
            {
                Id = ObjectId.GenerateNewId().ToString(),
                UserId = "system", // System-created
                Name = "Delivery Driver",
                Description = "Multi-app delivery service including food delivery platforms",
                IsDefault = true,
                IsActive = true,
                Scope = WorkTypeScope.System,
                IncomeSourceTemplates = new List<IncomeSourceTemplate>
                {
                    new() { Name = "Uber Eats", Category = "Delivery", IsRequired = false, DisplayOrder = 1 },
                    new() { Name = "Deliveroo", Category = "Delivery", IsRequired = false, DisplayOrder = 2 },
                    new() { Name = "Just Eat", Category = "Delivery", IsRequired = false, DisplayOrder = 3 },
                    new() { Name = "Tips", Category = "Tips", IsRequired = false, DisplayOrder = 4 },
                    new() { Name = "Bonuses", Category = "Incentives", IsRequired = false, DisplayOrder = 5 }
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new WorkTypeConfig
            {
                Id = ObjectId.GenerateNewId().ToString(),
                UserId = "system",
                Name = "Taxi Driver",
                Description = "Traditional taxi service with meter-based fares",
                IsDefault = true,
                IsActive = true,
                Scope = WorkTypeScope.System,
                IncomeSourceTemplates = new List<IncomeSourceTemplate>
                {
                    new() { Name = "Fare", Category = "Base", IsRequired = true, DisplayOrder = 1 },
                    new() { Name = "Tips", Category = "Tips", IsRequired = false, DisplayOrder = 2 },
                    new() { Name = "Airport Surcharge", Category = "Surcharge", IsRequired = false, DisplayOrder = 3 },
                    new() { Name = "Late Night Premium", Category = "Surcharge", IsRequired = false, DisplayOrder = 4 }
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new WorkTypeConfig
            {
                Id = ObjectId.GenerateNewId().ToString(),
                UserId = "system",
                Name = "Rideshare Driver",
                Description = "App-based rideshare service for passenger transport",
                IsDefault = true,
                IsActive = true,
                Scope = WorkTypeScope.System,
                IncomeSourceTemplates = new List<IncomeSourceTemplate>
                {
                    new() { Name = "Uber", Category = "Rideshare", IsRequired = false, DisplayOrder = 1 },
                    new() { Name = "Lyft", Category = "Rideshare", IsRequired = false, DisplayOrder = 2 },
                    new() { Name = "Bolt", Category = "Rideshare", IsRequired = false, DisplayOrder = 3 },
                    new() { Name = "Tips", Category = "Tips", IsRequired = false, DisplayOrder = 4 },
                    new() { Name = "Surge Pricing", Category = "Incentives", IsRequired = false, DisplayOrder = 5 }
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
    }

    /// <summary>
    /// Creates user-specific copies of default work types for a new user
    /// </summary>
    public async Task<List<string>> AssignDefaultWorkTypesToUserAsync(string userId)
    {
        var defaultWorkTypes = GetSystemDefaultWorkTypes();
        var assignedWorkTypeIds = new List<string>();

        foreach (var defaultWorkType in defaultWorkTypes)
        {
            // Create user-specific copy
            var userWorkType = new WorkTypeConfig
            {
                Id = ObjectId.GenerateNewId().ToString(),
                UserId = userId, // Assign to user
                Name = defaultWorkType.Name,
                Description = defaultWorkType.Description,
                IncomeSourceTemplates = defaultWorkType.IncomeSourceTemplates.Select(template => new IncomeSourceTemplate
                {
                    Name = template.Name,
                    Category = template.Category,
                    DefaultAmount = template.DefaultAmount,
                    IsRequired = template.IsRequired,
                    Description = template.Description,
                    DisplayOrder = template.DisplayOrder
                }).ToList(),
                IsActive = true,
                IsDefault = false, // User copy is not a default
                Scope = WorkTypeScope.Individual, // User-owned
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            try
            {
                var createdWorkType = await _workTypeConfigService.CreateAsync(userWorkType);
                assignedWorkTypeIds.Add(createdWorkType.Id);
            }
            catch (Exception ex)
            {
                // Log error but continue with other work types
                Console.WriteLine($"Failed to create default work type '{userWorkType.Name}' for user {userId}: {ex.Message}");
            }
        }

        return assignedWorkTypeIds;
    }

    /// <summary>
    /// Checks if a user has any work types assigned
    /// </summary>
    public async Task<bool> UserHasWorkTypesAsync(string userId)
    {
        var userWorkTypes = await _workTypeConfigService.GetByUserIdAsync(userId);
        return userWorkTypes.Any();
    }
}