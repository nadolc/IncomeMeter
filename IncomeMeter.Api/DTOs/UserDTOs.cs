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