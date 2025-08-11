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

    public UserService(MongoDbContext context)
    {
        _users = context.Users;
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
            Settings = new UserSettings
            {
                Language = "en-GB",
                CurrencyCode = "GBP"
            }
        };

        await _users.InsertOneAsync(user);
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
}