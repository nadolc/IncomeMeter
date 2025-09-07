using MongoDB.Bson;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;
using System.Text.Json;

namespace IncomeMeter.Api.Services;

public class DefaultWorkTypeService
{
    private readonly IWorkTypeConfigService _workTypeConfigService;
    private readonly IWebHostEnvironment _webHostEnvironment;

    public DefaultWorkTypeService(IWorkTypeConfigService workTypeConfigService, IWebHostEnvironment webHostEnvironment)
    {
        _workTypeConfigService = workTypeConfigService;
        _webHostEnvironment = webHostEnvironment;
    }

    /// <summary>
    /// Gets predefined system default work types localized for the specified language
    /// </summary>
    /// <param name="languageCode">Language code (e.g., "en-GB", "zh-HK")</param>
    public List<WorkTypeConfig> GetSystemDefaultWorkTypes(string languageCode = "en-GB")
    {
        var localizedWorkTypes = LoadLocalizedWorkTypes(languageCode);
        
        return new List<WorkTypeConfig>
        {
            new WorkTypeConfig
            {
                Id = ObjectId.GenerateNewId().ToString(),
                UserId = "system", // System-created
                Name = GetLocalizedValue(localizedWorkTypes, "deliveryDriver", "name"),
                Description = GetLocalizedValue(localizedWorkTypes, "deliveryDriver", "description"),
                IsDefault = true,
                IsActive = true,
                Scope = WorkTypeScope.System,
                IncomeSourceTemplates = new List<IncomeSourceTemplate>
                {
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "deliveryDriver", "uberEats"), Category = GetLocalizedCategory(localizedWorkTypes, "deliveryDriver", "delivery"), IsRequired = false, DisplayOrder = 1 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "deliveryDriver", "deliveroo"), Category = GetLocalizedCategory(localizedWorkTypes, "deliveryDriver", "delivery"), IsRequired = false, DisplayOrder = 2 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "deliveryDriver", "keeta"), Category = GetLocalizedCategory(localizedWorkTypes, "deliveryDriver", "delivery"), IsRequired = false, DisplayOrder = 3 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "deliveryDriver", "foodpanda"), Category = GetLocalizedCategory(localizedWorkTypes, "deliveryDriver", "delivery"), IsRequired = false, DisplayOrder = 4 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "deliveryDriver", "justEat"), Category = GetLocalizedCategory(localizedWorkTypes, "deliveryDriver", "delivery"), IsRequired = false, DisplayOrder = 5 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "deliveryDriver", "tips"), Category = GetLocalizedCategory(localizedWorkTypes, "deliveryDriver", "tips"), IsRequired = false, DisplayOrder = 6 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "deliveryDriver", "bonuses"), Category = GetLocalizedCategory(localizedWorkTypes, "deliveryDriver", "incentives"), IsRequired = false, DisplayOrder = 7 }
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new WorkTypeConfig
            {
                Id = ObjectId.GenerateNewId().ToString(),
                UserId = "system",
                Name = GetLocalizedValue(localizedWorkTypes, "taxiDriver", "name"),
                Description = GetLocalizedValue(localizedWorkTypes, "taxiDriver", "description"),
                IsDefault = true,
                IsActive = true,
                Scope = WorkTypeScope.System,
                IncomeSourceTemplates = new List<IncomeSourceTemplate>
                {
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "taxiDriver", "fare"), Category = GetLocalizedCategory(localizedWorkTypes, "taxiDriver", "base"), IsRequired = true, DisplayOrder = 1 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "taxiDriver", "tips"), Category = GetLocalizedCategory(localizedWorkTypes, "taxiDriver", "tips"), IsRequired = false, DisplayOrder = 2 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "taxiDriver", "airportSurcharge"), Category = GetLocalizedCategory(localizedWorkTypes, "taxiDriver", "surcharge"), IsRequired = false, DisplayOrder = 3 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "taxiDriver", "lateNightPremium"), Category = GetLocalizedCategory(localizedWorkTypes, "taxiDriver", "surcharge"), IsRequired = false, DisplayOrder = 4 }
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new WorkTypeConfig
            {
                Id = ObjectId.GenerateNewId().ToString(),
                UserId = "system",
                Name = GetLocalizedValue(localizedWorkTypes, "rideshareDriver", "name"),
                Description = GetLocalizedValue(localizedWorkTypes, "rideshareDriver", "description"),
                IsDefault = true,
                IsActive = true,
                Scope = WorkTypeScope.System,
                IncomeSourceTemplates = new List<IncomeSourceTemplate>
                {
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "rideshareDriver", "uber"), Category = GetLocalizedCategory(localizedWorkTypes, "rideshareDriver", "rideshare"), IsRequired = false, DisplayOrder = 1 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "rideshareDriver", "lyft"), Category = GetLocalizedCategory(localizedWorkTypes, "rideshareDriver", "rideshare"), IsRequired = false, DisplayOrder = 2 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "rideshareDriver", "bolt"), Category = GetLocalizedCategory(localizedWorkTypes, "rideshareDriver", "rideshare"), IsRequired = false, DisplayOrder = 3 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "rideshareDriver", "tips"), Category = GetLocalizedCategory(localizedWorkTypes, "rideshareDriver", "tips"), IsRequired = false, DisplayOrder = 4 },
                    new() { Name = GetLocalizedIncomeSource(localizedWorkTypes, "rideshareDriver", "surgePricing"), Category = GetLocalizedCategory(localizedWorkTypes, "rideshareDriver", "incentives"), IsRequired = false, DisplayOrder = 5 }
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
    }

    /// <summary>
    /// Creates user-specific copies of default work types for a new user
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <param name="languageCode">User's preferred language code</param>
    public async Task<List<string>> AssignDefaultWorkTypesToUserAsync(string userId, string languageCode = "en-GB")
    {
        var defaultWorkTypes = GetSystemDefaultWorkTypes(languageCode);
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
    /// Loads localized work type data from resource files
    /// </summary>
    private Dictionary<string, JsonElement> LoadLocalizedWorkTypes(string languageCode)
    {
        try
        {
            var resourcePath = Path.Combine(_webHostEnvironment.ContentRootPath, "Resources", $"WorkTypes.{languageCode}.json");
            
            // Fall back to English if the requested language is not available
            if (!File.Exists(resourcePath))
            {
                resourcePath = Path.Combine(_webHostEnvironment.ContentRootPath, "Resources", "WorkTypes.en-GB.json");
            }

            var jsonContent = File.ReadAllText(resourcePath);
            var jsonDocument = JsonDocument.Parse(jsonContent);
            
            return jsonDocument.RootElement.EnumerateObject()
                .ToDictionary(property => property.Name, property => property.Value);
        }
        catch (Exception ex)
        {
            // Log error and return empty dictionary as fallback
            Console.WriteLine($"Error loading localized work types for language '{languageCode}': {ex.Message}");
            return new Dictionary<string, JsonElement>();
        }
    }

    /// <summary>
    /// Gets localized value for a work type property
    /// </summary>
    private string GetLocalizedValue(Dictionary<string, JsonElement> localizedData, string workType, string property)
    {
        try
        {
            if (localizedData.ContainsKey(workType) && localizedData[workType].TryGetProperty(property, out var value))
            {
                return value.GetString() ?? string.Empty;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting localized value for {workType}.{property}: {ex.Message}");
        }
        
        // Return fallback values
        return workType switch
        {
            "deliveryDriver" when property == "name" => "Delivery Driver",
            "deliveryDriver" when property == "description" => "Multi-app delivery service including food delivery platforms",
            "taxiDriver" when property == "name" => "Taxi Driver",
            "taxiDriver" when property == "description" => "Traditional taxi service with meter-based fares",
            "rideshareDriver" when property == "name" => "Rideshare Driver",
            "rideshareDriver" when property == "description" => "App-based rideshare service for passenger transport",
            _ => string.Empty
        };
    }

    /// <summary>
    /// Gets localized income source name
    /// </summary>
    private string GetLocalizedIncomeSource(Dictionary<string, JsonElement> localizedData, string workType, string sourceKey)
    {
        try
        {
            if (localizedData.ContainsKey(workType) && 
                localizedData[workType].TryGetProperty("incomeSources", out var sources) &&
                sources.TryGetProperty(sourceKey, out var sourceName))
            {
                return sourceName.GetString() ?? string.Empty;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting localized income source for {workType}.{sourceKey}: {ex.Message}");
        }

        // Fallback values
        return sourceKey switch
        {
            "uberEats" => "Uber Eats",
            "deliveroo" => "Deliveroo",
            "keeta" => "Keeta",
            "foodpanda" => "Foodpanda",
            "justEat" => "Just Eat",
            "tips" => "Tips",
            "bonuses" => "Bonuses",
            "fare" => "Fare",
            "airportSurcharge" => "Airport Surcharge",
            "lateNightPremium" => "Late Night Premium",
            "uber" => "Uber",
            "lyft" => "Lyft",
            "bolt" => "Bolt",
            "surgePricing" => "Surge Pricing",
            _ => sourceKey
        };
    }

    /// <summary>
    /// Gets localized category name
    /// </summary>
    private string GetLocalizedCategory(Dictionary<string, JsonElement> localizedData, string workType, string categoryKey)
    {
        try
        {
            if (localizedData.ContainsKey(workType) &&
                localizedData[workType].TryGetProperty("incomeCategories", out var categories) &&
                categories.TryGetProperty(categoryKey, out var categoryName))
            {
                return categoryName.GetString() ?? string.Empty;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting localized category for {workType}.{categoryKey}: {ex.Message}");
        }

        // Fallback values
        return categoryKey switch
        {
            "delivery" => "Delivery",
            "tips" => "Tips",
            "incentives" => "Incentives",
            "base" => "Base",
            "surcharge" => "Surcharge",
            "rideshare" => "Rideshare",
            _ => categoryKey
        };
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