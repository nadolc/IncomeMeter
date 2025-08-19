using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    // POST /api/users/me/apikeys
    [HttpPost("me/apikeys")]
    public async Task<IActionResult> CreateApiKey([FromBody] CreateApiKeyRequestDto dto)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        try
        {
            var result = await _userService.GenerateAndAddApiKeyAsync(userId, dto.Description);
            // NOTE: The plain-text key is only returned ONCE upon creation.
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound("User not found.");
        }
    }
}