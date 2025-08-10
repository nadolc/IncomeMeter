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