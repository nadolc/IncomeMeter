using System.ComponentModel.DataAnnotations;
using System.Reflection;

namespace IncomeMeter.Api.DTOs;

public class CreateApiKeyRequestDto
{
    [Required]
    public string Description { get; set; } = null!;
}

public class CreateApiKeyResponseDto
{
    public string ApiKey { get; set; } = null!;
    public Models.ApiKey ApiKeyDetails { get; set; } = null!;
}

public class RegisterRequest
{
    [Required]
    public string GoogleId { get; set; } = null!;
    
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;
    
    [Required]
    public string DisplayName { get; set; } = null!;
}

public class AuthResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = null!;
    public string? Token { get; set; }
    public object? User { get; set; }
}