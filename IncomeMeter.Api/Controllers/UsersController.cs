using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace WorkTracker.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    private User GetCurrentUser() => (User)HttpContext.Items["User"]!;

    // POST /api/users/me/apikeys
    [HttpPost("me/apikeys")]
    public async Task<IActionResult> CreateApiKey([FromBody] CreateApiKeyRequestDto dto)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized();

        try
        {
            var result = await _userService.GenerateAndAddApiKeyAsync(user.Id!, dto.Description);
            // NOTE: The plain-text key is only returned ONCE upon creation.
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound("User not found.");
        }
    }
}