using System.Security.Claims;
using IncomeMeter.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace IncomeMeter.Api.Controllers;

public static class CurrentUserExtensions
{
    /// <summary>
    /// Resolves the authenticated user's id. The built-in Bearer scheme populates the claims principal;
    /// the custom JWT / API-key middleware populates HttpContext.Items["User"]. Either may be the one that ran.
    /// </summary>
    public static string? CurrentUserId(this ControllerBase controller) =>
        controller.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? (controller.HttpContext.Items["User"] as User)?.Id;
}
