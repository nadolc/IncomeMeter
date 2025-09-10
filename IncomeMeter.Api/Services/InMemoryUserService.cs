using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using System.Collections.Concurrent;

namespace IncomeMeter.Api.Services;

public class InMemoryUserService : IUserService
{
    private readonly ConcurrentDictionary<string, User> _users = new();
    private readonly ConcurrentDictionary<string, User> _usersByGoogleId = new();
    private readonly ConcurrentDictionary<string, User> _usersByEmail = new();

    public Task<User?> GetUserByApiKeyHashAsync(string keyHash)
    {
        var user = _users.Values.FirstOrDefault(u => u.ApiKeys.Any(k => k.KeyHash == keyHash));
        return Task.FromResult(user);
    }

    public Task<User?> GetUserByGoogleIdAsync(string googleId)
    {
        _usersByGoogleId.TryGetValue(googleId, out var user);
        return Task.FromResult(user);
    }

    public Task<User?> GetUserByEmailAsync(string email)
    {
        _usersByEmail.TryGetValue(email, out var user);
        return Task.FromResult(user);
    }

    public Task<User?> GetUserByIdAsync(string id)
    {
        _users.TryGetValue(id, out var user);
        return Task.FromResult(user);
    }

    public Task<User> CreateUserAsync(string googleId, string email, string displayName)
    {
        var user = new User
        {
            Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
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

        _users[user.Id] = user;
        _usersByGoogleId[googleId] = user;
        _usersByEmail[email] = user;

        return Task.FromResult(user);
    }

    public Task<CreateApiKeyResponseDto> GenerateAndAddApiKeyAsync(string userId, string description)
    {
        if (!_users.TryGetValue(userId, out var user))
        {
            throw new KeyNotFoundException("User not found.");
        }

        // Generate a simple API key for development
        var apiKey = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        var keyHash = apiKey.GetHashCode().ToString();

        var newApiKey = new ApiKey
        {
            KeyHash = keyHash,
            Description = description,
            CreatedAt = DateTime.UtcNow
        };

        user.ApiKeys.Add(newApiKey);

        return Task.FromResult(new CreateApiKeyResponseDto 
        { 
            ApiKey = apiKey, 
            ApiKeyDetails = newApiKey 
        });
    }

    public Task<User> UpdateUserAsync(User user)
    {
        if (user.Id == null || !_users.ContainsKey(user.Id))
        {
            throw new KeyNotFoundException("User not found.");
        }

        // Update all dictionaries
        _users[user.Id] = user;
        _usersByGoogleId[user.GoogleId] = user;
        _usersByEmail[user.Email] = user;

        return Task.FromResult(user);
    }

    public Task<User?> ValidateUserCredentialsAsync(string email, string password)
    {
        // InMemoryUserService placeholder - OAuth system doesn't use password validation
        return Task.FromResult<User?>(null);
    }
}