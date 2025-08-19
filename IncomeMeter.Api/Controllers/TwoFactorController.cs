using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;
using IncomeMeter.Api.Services;
using System.Security.Claims;
using Serilog;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace IncomeMeter.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TwoFactorController : ControllerBase
    {
        private readonly ITwoFactorAuthService _twoFactorService;
        private readonly IUserService _userService;
        private readonly IJwtTokenService _jwtTokenService;

        public TwoFactorController(
            ITwoFactorAuthService twoFactorService,
            IUserService userService,
            IJwtTokenService jwtTokenService)
        {
            _twoFactorService = twoFactorService;
            _userService = userService;
            _jwtTokenService = jwtTokenService;
        }

        /// <summary>
        /// Step 1: Generate 2FA setup (QR code and backup codes)
        /// </summary>
        [HttpPost("setup")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> Setup([FromBody] Setup2FARequest request)
        {
            try
            {
                var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var email = HttpContext.User.FindFirst(ClaimTypes.Email)?.Value;

                if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(email))
                {
                    return Unauthorized(new Setup2FAResponse
                    {
                        Success = false,
                        Message = "Invalid authentication token"
                    });
                }

                var result = await _twoFactorService.GenerateSetupAsync(userId, email, request.RecoveryEmail);

                if (result.Success)
                {
                    Log.Logger
                        .ForContext("EventType", "2FASetupInitiated")
                        .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                        .Information("User initiated 2FA setup");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "2FASetupError")
                    .Error(ex, "Error during 2FA setup");

                return BadRequest(new Setup2FAResponse
                {
                    Success = false,
                    Message = "Error setting up 2FA"
                });
            }
        }

        /// <summary>
        /// Step 2: Verify TOTP code and complete 2FA setup
        /// </summary>
        [HttpPost("verify")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> Verify([FromBody] Verify2FARequest request)
        {
            try
            {
                var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new Verify2FAResponse
                    {
                        Success = false,
                        Message = "Invalid authentication token"
                    });
                }

                var result = await _twoFactorService.VerifyCodeAsync(userId, request.Code, request.BackupCode);
                return Ok(result);
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "2FAVerificationError")
                    .Error(ex, "Error during 2FA verification");

                return BadRequest(new Verify2FAResponse
                {
                    Success = false,
                    Message = "Error verifying 2FA code"
                });
            }
        }

        /// <summary>
        /// Disable 2FA (requires current TOTP code)
        /// </summary>
        [HttpPost("disable")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> Disable([FromBody] Verify2FARequest request)
        {
            try
            {
                var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized();
                }

                var success = await _twoFactorService.DisableTwoFactorAsync(userId, request.Code);

                if (success)
                {
                    Log.Logger
                        .ForContext("EventType", "2FADisabled")
                        .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                        .Information("User disabled 2FA");

                    return Ok(new { Success = true, Message = "2FA disabled successfully" });
                }

                return BadRequest(new { Success = false, Message = "Invalid verification code" });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "2FADisableError")
                    .Error(ex, "Error disabling 2FA");

                return BadRequest(new { Success = false, Message = "Error disabling 2FA" });
            }
        }

        /// <summary>
        /// Generate new backup codes
        /// </summary>
        [HttpPost("backup-codes/regenerate")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> RegenerateBackupCodes([FromBody] Verify2FARequest request)
        {
            try
            {
                var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized();
                }

                // Verify current TOTP code before regenerating
                var isValid = await _twoFactorService.ValidateTotpAsync(userId, request.Code);
                if (!isValid)
                {
                    return BadRequest(new { Success = false, Message = "Invalid verification code" });
                }

                var newCodes = await _twoFactorService.GenerateNewBackupCodesAsync(userId);

                Log.Logger
                    .ForContext("EventType", "BackupCodesRegenerated")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Information("User regenerated backup codes");

                return Ok(new { Success = true, BackupCodes = newCodes });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "BackupCodesRegenerateError")
                    .Error(ex, "Error regenerating backup codes");

                return BadRequest(new { Success = false, Message = "Error regenerating backup codes" });
            }
        }

        /// <summary>
        /// Get 2FA status for current user
        /// </summary>
        [HttpGet("status")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> GetStatus()
        {
            try
            {
                var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized();
                }

                var user = await _userService.GetUserByIdAsync(userId);
                if (user == null)
                {
                    return NotFound();
                }

                var remainingBackupCodes = await _twoFactorService.GetRemainingBackupCodesCountAsync(userId);

                return Ok(new
                {
                    IsTwoFactorEnabled = user.IsTwoFactorEnabled,
                    IsSetupComplete = user.TwoFactorAuth?.IsVerified ?? false,
                    RemainingBackupCodes = remainingBackupCodes,
                    RecoveryEmail = user.TwoFactorAuth?.RecoveryEmail
                });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "2FAStatusError")
                    .Error(ex, "Error getting 2FA status");

                return BadRequest(new { Success = false, Message = "Error getting 2FA status" });
            }
        }

        /// <summary>
        /// Email/Password + 2FA Login
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> LoginWith2FA([FromBody] LoginWith2FARequest request)
        {
            try
            {
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();

                // Step 1: Validate email/password
                var user = await _userService.ValidateUserCredentialsAsync(request.Email, request.Password);
                if (user == null)
                {
                    Log.Logger
                        .ForContext("EventType", "LoginFailed")
                        .ForContext("Email", request.Email.Split('@')[0] + "@***")
                        .ForContext("RemoteIP", remoteIp)
                        .ForContext("Reason", "InvalidCredentials")
                        .Warning("Login failed - invalid credentials");

                    return Unauthorized(new TokenResponse
                    {
                        AccessToken = "",
                        RefreshToken = "",
                        ExpiresAt = DateTime.MinValue,
                        RequiresTwoFactor = false
                    });
                }

                // Step 2: Check if 2FA is enabled
                if (!user.IsTwoFactorEnabled)
                {
                    Log.Logger
                        .ForContext("EventType", "LoginFailed")
                        .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                        .ForContext("Reason", "2FANotEnabled")
                        .Warning("Login failed - 2FA not enabled");

                    return BadRequest(new TokenResponse
                    {
                        AccessToken = "",
                        RefreshToken = "",
                        ExpiresAt = DateTime.MinValue,
                        RequiresTwoFactor = true
                    });
                }

                // Step 3: Validate 2FA code
                bool isTwoFactorValid = false;

                if (!string.IsNullOrEmpty(request.TwoFactorCode))
                {
                    isTwoFactorValid = await _twoFactorService.ValidateTotpAsync(user.Id!, request.TwoFactorCode);
                }
                else if (!string.IsNullOrEmpty(request.BackupCode))
                {
                    isTwoFactorValid = await _twoFactorService.ValidateBackupCodeAsync(user.Id!, request.BackupCode);
                }

                if (!isTwoFactorValid)
                {
                    Log.Logger
                        .ForContext("EventType", "LoginFailed")
                        .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                        .ForContext("RemoteIP", remoteIp)
                        .ForContext("Reason", "Invalid2FACode")
                        .Warning("Login failed - invalid 2FA code");

                    return Unauthorized(new TokenResponse
                    {
                        AccessToken = "",
                        RefreshToken = "",
                        ExpiresAt = DateTime.MinValue,
                        RequiresTwoFactor = true
                    });
                }

                // Step 4: Generate tokens
                var accessToken = _jwtTokenService.GenerateAccessToken(user);
                var refreshToken = await _twoFactorService.CreateRefreshTokenAsync(user.Id!, remoteIp);

                // Update last login
                user.LastLoginAt = DateTime.UtcNow;
                await _userService.UpdateUserAsync(user);

                Log.Logger
                    .ForContext("EventType", "LoginSuccess")
                    .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                    .ForContext("RemoteIP", remoteIp)
                    .ForContext("AuthMethod", "EmailPassword2FA")
                    .Information("User login successful with 2FA");

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
                    .ForContext("EventType", "LoginError")
                    .ForContext("Email", request.Email.Split('@')[0] + "@***")
                    .Error(ex, "Error during 2FA login");

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
        /// Refresh access token using refresh token
        /// </summary>
        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
        {
            try
            {
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();

                // Validate refresh token
                var user = await _twoFactorService.ValidateRefreshTokenAsync(request.RefreshToken);
                if (user == null)
                {
                    return Unauthorized(new { Message = "Invalid refresh token" });
                }

                // Generate new tokens
                var accessToken = _jwtTokenService.GenerateAccessToken(user);
                var newRefreshToken = await _twoFactorService.RotateRefreshTokenAsync(request.RefreshToken, remoteIp);

                Log.Logger
                    .ForContext("EventType", "TokenRefreshed")
                    .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                    .ForContext("RemoteIP", remoteIp)
                    .Information("Access token refreshed");

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
                    .ForContext("EventType", "TokenRefreshError")
                    .Error(ex, "Error refreshing token");

                return BadRequest(new { Message = "Error refreshing token" });
            }
        }

    }
}