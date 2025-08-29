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

public class ConfigurationResponseDto
{
    public UserInfo User { get; set; } = null!;
    public List<WorkTypeConfigResponseDto> WorkTypes { get; set; } = new();
    public ApiEndpoints ApiEndpoints { get; set; } = null!;
}

public class UserInfo
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Currency { get; set; } = "GBP";
    public string Language { get; set; } = "en-GB";
    public string TimeZone { get; set; } = "Europe/London";
}


public class ApiEndpoints
{
    public string StartRoute { get; set; } = null!;
    public string AddLocation { get; set; } = null!;
    public string EndRoute { get; set; } = null!;
    public string GetRoutes { get; set; } = null!;
    public string GetRoute { get; set; } = null!;
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