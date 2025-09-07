using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using MongoDB.Driver;
using System.Security.Cryptography;
using System.Text;

namespace IncomeMeter.Api.Services;

public class UserService : IUserService
{
    private readonly IMongoCollection<User> _users;
    private readonly DefaultWorkTypeService _defaultWorkTypeService;

    public UserService(MongoDbContext context, DefaultWorkTypeService defaultWorkTypeService)
    {
        _users = context.Users;
        _defaultWorkTypeService = defaultWorkTypeService;
    }

    public async Task<User?> GetUserByApiKeyHashAsync(string keyHash) =>
        await _users.Find(u => u.ApiKeys.Any(k => k.KeyHash == keyHash)).FirstOrDefaultAsync();

    public async Task<User?> GetUserByGoogleIdAsync(string googleId) =>
        await _users.Find(u => u.GoogleId == googleId).FirstOrDefaultAsync();

    public async Task<User?> GetUserByEmailAsync(string email) =>
        await _users.Find(u => u.Email == email).FirstOrDefaultAsync();

    public async Task<User?> GetUserByIdAsync(string id) =>
        await _users.Find(u => u.Id == id).FirstOrDefaultAsync();

    public async Task<User> CreateUserAsync(string googleId, string email, string displayName)
    {
        var user = new User
        {
            GoogleId = googleId,
            Email = email,
            DisplayName = displayName,
            CreatedAt = DateTime.UtcNow,
            Role = UserRole.Member, // Phase 1: Set default role
            AssignedWorkTypeIds = new List<string>(), // Initialize empty list
            Settings = new UserSettings
            {
                Language = "en-GB",
                CurrencyCode = "GBP"
            }
        };

        // Insert user first to get the ID
        await _users.InsertOneAsync(user);

        // Phase 1: Assign default work types to new user
        try
        {
            var assignedWorkTypeIds = await _defaultWorkTypeService.AssignDefaultWorkTypesToUserAsync(user.Id!, user.Settings.Language);
            
            // Update user with assigned work type IDs
            if (assignedWorkTypeIds.Any())
            {
                user.AssignedWorkTypeIds = assignedWorkTypeIds;
                await UpdateUserWorkTypeIdsAsync(user.Id!, assignedWorkTypeIds);
            }
        }
        catch (Exception ex)
        {
            // Log error but don't fail user creation
            Console.WriteLine($"Warning: Failed to assign default work types to user {user.Id}: {ex.Message}");
        }

        return user;
    }

    public async Task<CreateApiKeyResponseDto> GenerateAndAddApiKeyAsync(string userId, string description)
    {
        var user = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
        if (user == null) throw new KeyNotFoundException("User not found.");

        // Generate key and its hash
        var apiKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        using var sha256 = SHA256.Create();
        var keyHash = BitConverter.ToString(sha256.ComputeHash(Encoding.UTF8.GetBytes(apiKey))).Replace("-", "").ToLower();

        var newApiKey = new ApiKey
        {
            KeyHash = keyHash,
            Description = description,
            CreatedAt = DateTime.UtcNow
        };

        var update = Builders<User>.Update.Push(u => u.ApiKeys, newApiKey);
        await _users.UpdateOneAsync(u => u.Id == userId, update);

        return new CreateApiKeyResponseDto { ApiKey = apiKey, ApiKeyDetails = newApiKey };
    }

    public async Task<User> UpdateUserAsync(User user)
    {
        await _users.ReplaceOneAsync(u => u.Id == user.Id, user);
        return user;
    }

    // Phase 1: Helper method to update user's assigned work type IDs
    private async Task UpdateUserWorkTypeIdsAsync(string userId, List<string> workTypeIds)
    {
        var update = Builders<User>.Update.Set(u => u.AssignedWorkTypeIds, workTypeIds);
        await _users.UpdateOneAsync(u => u.Id == userId, update);
    }
}