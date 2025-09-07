using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public interface IUserService
{
    Task<User?> GetUserByApiKeyHashAsync(string keyHash);
    Task<User?> GetUserByGoogleIdAsync(string googleId);
    Task<User?> GetUserByEmailAsync(string email);
    Task<User?> GetUserByIdAsync(string id);
    Task<User> CreateUserAsync(string googleId, string email, string displayName);
    Task<CreateApiKeyResponseDto> GenerateAndAddApiKeyAsync(string userId, string description);
    Task<User> UpdateUserAsync(User user);
}