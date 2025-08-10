using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public interface IUserService
{
    Task<User?> GetUserByApiKeyHashAsync(string keyHash);
    Task<CreateApiKeyResponseDto> GenerateAndAddApiKeyAsync(string userId, string description);
}