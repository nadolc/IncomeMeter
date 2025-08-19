using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.DTOs;
using System.Security.Claims;
using Serilog;
using System.IdentityModel.Tokens.Jwt;

namespace IncomeMeter.Api.Controllers
{
    [ApiController]
    [Route("api/ios")]
    public class IOSIntegrationController : ControllerBase
    {
        private readonly ITwoFactorAuthService _twoFactorService;
        private readonly IUserService _userService;
        private readonly IRouteService _routeService;
        private readonly IJwtTokenService _jwtTokenService;

        public IOSIntegrationController(
            ITwoFactorAuthService twoFactorService,
            IUserService userService,
            IRouteService routeService,
            IJwtTokenService jwtTokenService)
        {
            _twoFactorService = twoFactorService;
            _userService = userService;
            _routeService = routeService;
            _jwtTokenService = jwtTokenService;
        }

        /// <summary>
        /// iOS Setup: Validate tokens and return user info for iOS shortcut setup
        /// Called once during "Setup 2FA iOS Integration" shortcut
        /// </summary>
        [HttpPost("setup")]
        public async Task<IActionResult> SetupIOSIntegration([FromBody] IOSSetupRequest request)
        {
            try
            {
                // Validate access token
                var handler = new JwtSecurityTokenHandler();
                if (!handler.CanReadToken(request.AccessToken))
                {
                    return BadRequest(new IOSSetupResponse
                    {
                        Success = false,
                        Message = "Invalid access token format"
                    });
                }

                var jwtToken = handler.ReadJwtToken(request.AccessToken);
                var userId = jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;
                var userName = jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Name)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    return BadRequest(new IOSSetupResponse
                    {
                        Success = false,
                        Message = "Invalid token - no user ID found"
                    });
                }

                // Validate refresh token
                var user = await _twoFactorService.ValidateRefreshTokenAsync(request.RefreshToken);
                if (user == null || user.Id != userId)
                {
                    return BadRequest(new IOSSetupResponse
                    {
                        Success = false,
                        Message = "Invalid refresh token"
                    });
                }

                // Check if user has 2FA enabled
                if (!user.IsTwoFactorEnabled)
                {
                    return BadRequest(new IOSSetupResponse
                    {
                        Success = false,
                        Message = "2FA must be enabled before iOS integration"
                    });
                }

                var refreshToken = user.RefreshTokens.FirstOrDefault(rt => rt.Token == request.RefreshToken);

                Log.Logger
                    .ForContext("EventType", "IOSSetupSuccess")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Information("iOS integration setup completed successfully");

                return Ok(new IOSSetupResponse
                {
                    Success = true,
                    Message = "iOS integration setup successful",
                    UserId = userId,
                    UserName = userName,
                    TokenExpiry = jwtToken.ValidTo,
                    RefreshExpiry = refreshToken?.ExpiresAt
                });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "IOSSetupError")
                    .Error(ex, "Error during iOS setup");

                return BadRequest(new IOSSetupResponse
                {
                    Success = false,
                    Message = "Error setting up iOS integration"
                });
            }
        }

        /// <summary>
        /// iOS Login: Authenticate for iOS shortcuts when refresh token expires
        /// Called monthly when refresh token expires
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> IOSLogin([FromBody] IOSLoginRequest request)
        {
            try
            {
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();

                // Step 1: Validate email/password
                var user = await _userService.ValidateUserCredentialsAsync(request.Email, request.Password);
                if (user == null)
                {
                    Log.Logger
                        .ForContext("EventType", "IOSLoginFailed")
                        .ForContext("Email", request.Email.Split('@')[0] + "@***")
                        .ForContext("DeviceId", request.DeviceId[..Math.Min(8, request.DeviceId.Length)] + "***")
                        .ForContext("RemoteIP", remoteIp)
                        .ForContext("Reason", "InvalidCredentials")
                        .Warning("iOS login failed - invalid credentials");

                    return Unauthorized(new TokenResponse
                    {
                        AccessToken = "",
                        RefreshToken = "",
                        ExpiresAt = DateTime.MinValue,
                        RequiresTwoFactor = true
                    });
                }

                // Step 2: Validate 2FA code
                var isTwoFactorValid = await _twoFactorService.ValidateTotpAsync(user.Id!, request.TwoFactorCode);
                if (!isTwoFactorValid)
                {
                    Log.Logger
                        .ForContext("EventType", "IOSLoginFailed")
                        .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                        .ForContext("DeviceId", request.DeviceId[..Math.Min(8, request.DeviceId.Length)] + "***")
                        .ForContext("RemoteIP", remoteIp)
                        .ForContext("Reason", "Invalid2FACode")
                        .Warning("iOS login failed - invalid 2FA code");

                    return Unauthorized(new TokenResponse
                    {
                        AccessToken = "",
                        RefreshToken = "",
                        ExpiresAt = DateTime.MinValue,
                        RequiresTwoFactor = true
                    });
                }

                // Step 3: Generate tokens
                var accessToken = _jwtTokenService.GenerateAccessToken(user);
                var refreshToken = await _twoFactorService.CreateRefreshTokenAsync(user.Id!, remoteIp);

                // Update last login
                user.LastLoginAt = DateTime.UtcNow;
                await _userService.UpdateUserAsync(user);

                Log.Logger
                    .ForContext("EventType", "IOSLoginSuccess")
                    .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                    .ForContext("DeviceId", request.DeviceId[..Math.Min(8, request.DeviceId.Length)] + "***")
                    .ForContext("RemoteIP", remoteIp)
                    .Information("iOS login successful");

                return Ok(new TokenResponse
                {
                    AccessToken = accessToken,
                    RefreshToken = refreshToken.Token,
                    ExpiresAt = DateTime.UtcNow.AddHours(1),
                    RefreshExpiresAt = refreshToken.ExpiresAt,
                    RequiresTwoFactor = false
                });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "IOSLoginError")
                    .ForContext("Email", request.Email.Split('@')[0] + "@***")
                    .ForContext("DeviceId", request.DeviceId[..Math.Min(8, request.DeviceId.Length)] + "***")
                    .Error(ex, "Error during iOS login");

                return BadRequest(new TokenResponse
                {
                    AccessToken = "",
                    RefreshToken = "",
                    ExpiresAt = DateTime.MinValue,
                    RequiresTwoFactor = false
                });
            }
        }

        /// <summary>
        /// iOS Token Refresh: Automatic token refresh for iOS shortcuts
        /// Called automatically by shortcuts when access token expires
        /// </summary>
        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshIOSToken([FromBody] RefreshTokenRequest request)
        {
            try
            {
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();

                // Validate refresh token
                var user = await _twoFactorService.ValidateRefreshTokenAsync(request.RefreshToken);
                if (user == null)
                {
                    Log.Logger
                        .ForContext("EventType", "IOSTokenRefreshFailed")
                        .ForContext("RemoteIP", remoteIp)
                        .ForContext("Reason", "InvalidRefreshToken")
                        .Warning("iOS token refresh failed - invalid refresh token");

                    return Unauthorized(new { Message = "Invalid refresh token - please re-authenticate" });
                }

                // Generate new tokens
                var accessToken = _jwtTokenService.GenerateAccessToken(user);
                var newRefreshToken = await _twoFactorService.RotateRefreshTokenAsync(request.RefreshToken, remoteIp);

                Log.Logger
                    .ForContext("EventType", "IOSTokenRefreshed")
                    .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                    .ForContext("RemoteIP", remoteIp)
                    .Information("iOS token refreshed successfully");

                return Ok(new TokenResponse
                {
                    AccessToken = accessToken,
                    RefreshToken = newRefreshToken.Token,
                    ExpiresAt = DateTime.UtcNow.AddHours(1),
                    RefreshExpiresAt = newRefreshToken.ExpiresAt,
                    RequiresTwoFactor = false
                });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "IOSTokenRefreshError")
                    .Error(ex, "Error refreshing iOS token");

                return BadRequest(new { Message = "Error refreshing token - please re-authenticate" });
            }
        }

        /// <summary>
        /// Enhanced Start Route API for iOS shortcuts
        /// Handles automatic token refresh and provides detailed feedback
        /// </summary>
        [HttpPost("start-route")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> StartRouteWithTwoFactor([FromBody] StartRouteDto dto)
        {
            try
            {
                var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { Message = "Invalid token - authentication required" });
                }

                // Validate user still has 2FA enabled
                var user = await _userService.GetUserByIdAsync(userId);
                if (user?.IsTwoFactorEnabled != true)
                {
                    Log.Logger
                        .ForContext("EventType", "IOSRouteStartFailed")
                        .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                        .ForContext("Reason", "2FANotEnabled")
                        .Warning("iOS route start failed - 2FA not enabled");

                    return BadRequest(new { Message = "2FA is required for iOS integration" });
                }

                // Start the route using existing route service
                var result = await _routeService.StartRouteAsync(dto, userId);

                Log.Logger
                    .ForContext("EventType", "IOSRouteStarted")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("RouteId", result.Id?[..Math.Min(8, result.Id.Length)] + "***")
                    .ForContext("RemoteIP", remoteIp)
                    .Information("Route started via iOS shortcut");

                return Ok(new
                {
                    Success = true,
                    Message = "Route started successfully",
                    Route = result,
                    UserName = user.DisplayName
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { Message = "Token expired - please refresh" });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "IOSRouteStartError")
                    .Error(ex, "Error starting route via iOS");

                return BadRequest(new { Message = "Error starting route", Error = ex.Message });
            }
        }

        /// <summary>
        /// Enhanced End Route API for iOS shortcuts
        /// </summary>
        [HttpPost("end-route")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> EndRouteWithTwoFactor([FromBody] EndRouteDto dto)
        {
            try
            {
                var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { Message = "Invalid token - authentication required" });
                }

                var user = await _userService.GetUserByIdAsync(userId);
                if (user?.IsTwoFactorEnabled != true)
                {
                    return BadRequest(new { Message = "2FA is required for iOS integration" });
                }

                var result = await _routeService.EndRouteAsync(dto, userId);

                Log.Logger
                    .ForContext("EventType", "IOSRouteEnded")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("RouteId", result.Id?[..Math.Min(8, result.Id.Length)] + "***")
                    .ForContext("RemoteIP", remoteIp)
                    .Information("Route ended via iOS shortcut");

                return Ok(new
                {
                    Success = true,
                    Message = "Route ended successfully",
                    Route = result,
                    UserName = user.DisplayName
                });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "IOSRouteEndError")
                    .Error(ex, "Error ending route via iOS");

                return BadRequest(new { Message = "Error ending route", Error = ex.Message });
            }
        }

    }
}