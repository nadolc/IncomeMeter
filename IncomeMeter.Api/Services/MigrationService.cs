using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;
using MongoDB.Driver;

namespace IncomeMeter.Api.Services;

/// <summary>
/// Service to handle data migration tasks, especially for Phase 1 default work types
/// </summary>
public class MigrationService
{
    private readonly IMongoCollection<User> _users;
    private readonly DefaultWorkTypeService _defaultWorkTypeService;
    private readonly ILogger<MigrationService> _logger;

    public MigrationService(
        MongoDbContext context, 
        DefaultWorkTypeService defaultWorkTypeService,
        ILogger<MigrationService> logger)
    {
        _users = context.Users;
        _defaultWorkTypeService = defaultWorkTypeService;
        _logger = logger;
    }

    /// <summary>
    /// Migrates existing users to Phase 1 structure and assigns default work types
    /// </summary>
    public async Task MigrateExistingUsersToPhase1Async()
    {
        try
        {
            _logger.LogInformation("Starting Phase 1 migration for existing users");

            // Get all existing users
            var existingUsers = await _users.Find(_ => true).ToListAsync();
            var migratedCount = 0;
            var errorCount = 0;

            foreach (var user in existingUsers)
            {
                try
                {
                    var needsUpdate = false;
                    var updateBuilder = Builders<User>.Update.Combine();

                    // Initialize Role if not set
                    if (user.Role == 0 && user.Role != UserRole.Member) // Default enum value check
                    {
                        updateBuilder = updateBuilder.Set(u => u.Role, UserRole.Member);
                        needsUpdate = true;
                    }

                    // Initialize AssignedWorkTypeIds if null or empty
                    if (user.AssignedWorkTypeIds == null)
                    {
                        updateBuilder = updateBuilder.Set(u => u.AssignedWorkTypeIds, new List<string>());
                        user.AssignedWorkTypeIds = new List<string>();
                        needsUpdate = true;
                    }

                    // Check if user has work types assigned
                    var hasWorkTypes = await _defaultWorkTypeService.UserHasWorkTypesAsync(user.Id!);
                    
                    if (!hasWorkTypes)
                    {
                        // Assign default work types
                        var assignedWorkTypeIds = await _defaultWorkTypeService.AssignDefaultWorkTypesToUserAsync(user.Id!);
                        
                        if (assignedWorkTypeIds.Any())
                        {
                            updateBuilder = updateBuilder.Set(u => u.AssignedWorkTypeIds, assignedWorkTypeIds);
                            needsUpdate = true;
                            
                            _logger.LogInformation("Assigned {Count} default work types to user {UserId}", 
                                assignedWorkTypeIds.Count, user.Id[..Math.Min(8, user.Id.Length)] + "***");
                        }
                    }

                    // Apply updates if needed
                    if (needsUpdate)
                    {
                        await _users.UpdateOneAsync(u => u.Id == user.Id, updateBuilder);
                        migratedCount++;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to migrate user {UserId}", 
                        user.Id?[..Math.Min(8, user.Id.Length)] + "***");
                    errorCount++;
                }
            }

            _logger.LogInformation("Phase 1 migration completed. Migrated: {MigratedCount}, Errors: {ErrorCount}, Total: {TotalCount}", 
                migratedCount, errorCount, existingUsers.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Phase 1 migration failed");
            throw;
        }
    }

    /// <summary>
    /// Test method to verify default work type assignment
    /// </summary>
    public async Task<bool> TestDefaultWorkTypeAssignmentAsync()
    {
        try
        {
            _logger.LogInformation("Testing default work type assignment");

            // Get system defaults
            var systemDefaults = _defaultWorkTypeService.GetSystemDefaultWorkTypes();
            
            if (!systemDefaults.Any())
            {
                _logger.LogWarning("No system default work types found");
                return false;
            }

            _logger.LogInformation("Found {Count} system default work types: {Names}", 
                systemDefaults.Count, string.Join(", ", systemDefaults.Select(w => w.Name)));

            // Test assignment to a dummy user ID
            var testUserId = "test-user-" + Guid.NewGuid().ToString()[..8];
            
            try
            {
                var assignedIds = await _defaultWorkTypeService.AssignDefaultWorkTypesToUserAsync(testUserId);
                
                _logger.LogInformation("Successfully assigned {Count} work types to test user: {Ids}", 
                    assignedIds.Count, string.Join(", ", assignedIds.Select(id => id[..8] + "***")));

                return assignedIds.Count == systemDefaults.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to assign default work types to test user");
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Default work type assignment test failed");
            return false;
        }
    }
}