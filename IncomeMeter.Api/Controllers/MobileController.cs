using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using IncomeMeter.Api.Services.Interfaces;
using IncomeMeter.Api.DTOs;
using System.Security.Claims;
using Serilog;
using System.IdentityModel.Tokens.Jwt;

namespace IncomeMeter.Api.Controllers
{
    /// <summary>
    /// Unified Mobile API Controller for iOS and Android applications
    /// Replaces platform-specific endpoints with unified mobile-optimized APIs
    /// </summary>
    [ApiController]
    [Route("api/mobile")]
    [Produces("application/json")]
    public class MobileController : ControllerBase
    {
        private readonly ITwoFactorAuthService _twoFactorService;
        private readonly IUserService _userService;
        private readonly IRouteService _routeService;
        private readonly IJwtTokenService _jwtTokenService;

        public MobileController(
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
        /// Mobile App Setup: Validate tokens and return user info for mobile app integration
        /// Supports both iOS and Android platforms
        /// </summary>
        [HttpPost("setup")]
        public async Task<IActionResult> SetupMobileIntegration([FromBody] MobileSetupRequest request)
        {
            try
            {
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();
                var platformName = request.Platform.ToString();

                // Validate access token
                var handler = new JwtSecurityTokenHandler();
                if (!handler.CanReadToken(request.AccessToken))
                {
                    Log.Logger
                        .ForContext("EventType", "MobileSetupFailed")
                        .ForContext("Platform", platformName)
                        .ForContext("RemoteIP", remoteIp)
                        .ForContext("Reason", "InvalidAccessTokenFormat")
                        .Warning("Mobile setup failed - invalid access token format");

                    return BadRequest(new MobileSetupResponse
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
                    return BadRequest(new MobileSetupResponse
                    {
                        Success = false,
                        Message = "Invalid token - no user ID found"
                    });
                }

                // Validate refresh token
                var user = await _twoFactorService.ValidateRefreshTokenAsync(request.RefreshToken);
                if (user == null || user.Id != userId)
                {
                    return BadRequest(new MobileSetupResponse
                    {
                        Success = false,
                        Message = "Invalid refresh token"
                    });
                }

                // Check if user has 2FA enabled (required for mobile integration)
                if (!user.TwoFactorEnabled)
                {
                    return BadRequest(new MobileSetupResponse
                    {
                        Success = false,
                        Message = "2FA must be enabled before mobile integration"
                    });
                }

                var refreshToken = user.RefreshTokens.FirstOrDefault(rt => rt.Token == request.RefreshToken);

                // Generate platform-specific configuration
                var platformConfig = GeneratePlatformConfig(request.Platform, request.AppVersion);

                Log.Logger
                    .ForContext("EventType", "MobileSetupSuccess")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("Platform", platformName)
                    .ForContext("AppVersion", request.AppVersion ?? "unknown")
                    .ForContext("RemoteIP", remoteIp)
                    .Information("Mobile integration setup completed successfully");

                return Ok(new MobileSetupResponse
                {
                    Success = true,
                    Message = "Mobile integration setup successful",
                    UserId = userId,
                    UserName = userName,
                    TokenExpiry = jwtToken.ValidTo,
                    RefreshExpiry = refreshToken?.ExpiresAt,
                    PlatformConfig = platformConfig
                });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "MobileSetupError")
                    .ForContext("Platform", request.Platform.ToString())
                    .Error(ex, "Error during mobile setup");

                return BadRequest(new MobileSetupResponse
                {
                    Success = false,
                    Message = "Error setting up mobile integration"
                });
            }
        }

        /// <summary>
        /// Mobile Login: Authenticate for mobile apps with 2FA support
        /// Unified endpoint for both iOS and Android
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> MobileLogin([FromBody] MobileLoginRequest request)
        {
            try
            {
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();
                var platformName = request.Platform.ToString();

                Log.Logger
                    .ForContext("EventType", "MobileLoginAttempt")
                    .ForContext("Email", request.Email.Split('@')[0] + "@***")
                    .ForContext("Platform", platformName)
                    .ForContext("AppVersion", request.AppVersion ?? "unknown")
                    .ForContext("DeviceId", request.DeviceId[..Math.Min(8, request.DeviceId.Length)] + "***")
                    .ForContext("RemoteIP", remoteIp)
                    .Information("Mobile login attempt");

                // Step 1: Validate email/password
                var user = await _userService.ValidateUserCredentialsAsync(request.Email, request.Password);
                if (user == null)
                {
                    Log.Logger
                        .ForContext("EventType", "MobileLoginFailed")
                        .ForContext("Email", request.Email.Split('@')[0] + "@***")
                        .ForContext("Platform", platformName)
                        .ForContext("DeviceId", request.DeviceId[..Math.Min(8, request.DeviceId.Length)] + "***")
                        .ForContext("RemoteIP", remoteIp)
                        .ForContext("Reason", "InvalidCredentials")
                        .Warning("Mobile login failed - invalid credentials");

                    return Unauthorized(new MobileTokenResponse
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
                        .ForContext("EventType", "MobileLoginFailed")
                        .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                        .ForContext("Platform", platformName)
                        .ForContext("DeviceId", request.DeviceId[..Math.Min(8, request.DeviceId.Length)] + "***")
                        .ForContext("RemoteIP", remoteIp)
                        .ForContext("Reason", "Invalid2FACode")
                        .Warning("Mobile login failed - invalid 2FA code");

                    return Unauthorized(new MobileTokenResponse
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

                // Generate mobile configuration
                var mobileConfig = GenerateMobileConfig(request.Platform, request.DeviceInfo);
                var userInfo = new MobileUserInfo
                {
                    UserId = user.Id!,
                    DisplayName = user.DisplayName ?? user.Email!,
                    Email = user.Email!,
                    ProfilePicture = user.ProfilePicture,
                    TwoFactorEnabled = user.TwoFactorEnabled,
                    EnabledFeatures = GetEnabledFeatures(user)
                };

                Log.Logger
                    .ForContext("EventType", "MobileLoginSuccess")
                    .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                    .ForContext("Platform", platformName)
                    .ForContext("AppVersion", request.AppVersion ?? "unknown")
                    .ForContext("DeviceId", request.DeviceId[..Math.Min(8, request.DeviceId.Length)] + "***")
                    .ForContext("RemoteIP", remoteIp)
                    .Information("Mobile login successful");

                return Ok(new MobileTokenResponse
                {
                    AccessToken = accessToken,
                    RefreshToken = refreshToken.Token,
                    ExpiresAt = DateTime.UtcNow.AddHours(1),
                    RefreshExpiresAt = refreshToken.ExpiresAt,
                    RequiresTwoFactor = false,
                    UserInfo = userInfo,
                    MobileConfig = mobileConfig
                });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "MobileLoginError")
                    .ForContext("Email", request.Email.Split('@')[0] + "@***")
                    .ForContext("Platform", request.Platform.ToString())
                    .ForContext("DeviceId", request.DeviceId[..Math.Min(8, request.DeviceId.Length)] + "***")
                    .Error(ex, "Error during mobile login");

                return BadRequest(new MobileTokenResponse
                {
                    AccessToken = "",
                    RefreshToken = "",
                    ExpiresAt = DateTime.MinValue,
                    RequiresTwoFactor = false
                });
            }
        }

        /// <summary>
        /// Mobile Token Refresh: Automatic token refresh for mobile apps
        /// Unified endpoint with platform detection
        /// </summary>
        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshMobileToken([FromBody] RefreshTokenRequest request)
        {
            try
            {
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();
                var userAgent = HttpContext.Request.Headers.UserAgent.ToString();
                var platform = DetectPlatformFromUserAgent(userAgent);

                // Validate refresh token
                var user = await _twoFactorService.ValidateRefreshTokenAsync(request.RefreshToken);
                if (user == null)
                {
                    Log.Logger
                        .ForContext("EventType", "MobileTokenRefreshFailed")
                        .ForContext("Platform", platform.ToString())
                        .ForContext("RemoteIP", remoteIp)
                        .ForContext("Reason", "InvalidRefreshToken")
                        .Warning("Mobile token refresh failed - invalid refresh token");

                    return Unauthorized(new { Message = "Invalid refresh token - please re-authenticate" });
                }

                // Generate new tokens
                var accessToken = _jwtTokenService.GenerateAccessToken(user);
                var newRefreshToken = await _twoFactorService.RotateRefreshTokenAsync(request.RefreshToken, remoteIp);

                // Update mobile configuration if needed
                var mobileConfig = GenerateMobileConfig(platform, null);
                var userInfo = new MobileUserInfo
                {
                    UserId = user.Id!,
                    DisplayName = user.DisplayName ?? user.Email!,
                    Email = user.Email!,
                    ProfilePicture = user.ProfilePicture,
                    TwoFactorEnabled = user.TwoFactorEnabled,
                    EnabledFeatures = GetEnabledFeatures(user)
                };

                Log.Logger
                    .ForContext("EventType", "MobileTokenRefreshed")
                    .ForContext("UserId", user.Id?[..Math.Min(8, user.Id.Length)] + "***")
                    .ForContext("Platform", platform.ToString())
                    .ForContext("RemoteIP", remoteIp)
                    .Information("Mobile token refreshed successfully");

                return Ok(new MobileTokenResponse
                {
                    AccessToken = accessToken,
                    RefreshToken = newRefreshToken.Token,
                    ExpiresAt = DateTime.UtcNow.AddHours(1),
                    RefreshExpiresAt = newRefreshToken.ExpiresAt,
                    RequiresTwoFactor = false,
                    UserInfo = userInfo,
                    MobileConfig = mobileConfig
                });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "MobileTokenRefreshError")
                    .Error(ex, "Error refreshing mobile token");

                return BadRequest(new { Message = "Error refreshing token - please re-authenticate" });
            }
        }

        /// <summary>
        /// Enhanced Start Route API for mobile applications
        /// Supports GPS location data and mobile-specific optimizations
        /// </summary>
        [HttpPost("routes/start")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> StartRoute([FromBody] MobileStartRouteRequest request)
        {
            try
            {
                var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();
                var platformName = request.Platform.ToString();

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { Message = "Invalid token - authentication required" });
                }

                // Validate user still has 2FA enabled for mobile access
                var user = await _userService.GetUserByIdAsync(userId);
                if (user?.TwoFactorEnabled != true)
                {
                    Log.Logger
                        .ForContext("EventType", "MobileRouteStartFailed")
                        .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                        .ForContext("Platform", platformName)
                        .ForContext("Reason", "2FANotEnabled")
                        .Warning("Mobile route start failed - 2FA not enabled");

                    return BadRequest(new { Message = "2FA is required for mobile integration" });
                }

                // Convert mobile request to base DTO
                var startRouteDto = new StartRouteDto
                {
                    WorkType = request.WorkType,
                    WorkTypeId = request.WorkTypeId,
                    StartMile = request.StartMile,
                    EstimatedIncome = request.EstimatedIncome
                };

                // Start the route using existing route service
                var result = await _routeService.StartRouteAsync(startRouteDto, userId);

                // Generate mobile-specific context
                var context = GenerateRouteContext(result, request, "start");

                Log.Logger
                    .ForContext("EventType", "MobileRouteStarted")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("Platform", platformName)
                    .ForContext("AppVersion", request.DeviceInfo?.AppVersion ?? "unknown")
                    .ForContext("RouteId", result?.Id?[..Math.Min(8, result.Id.Length)] + "***")
                    .ForContext("RemoteIP", remoteIp)
                    .Information("Route started via mobile app");

                return Ok(new MobileRouteResponse
                {
                    Success = true,
                    Message = "Route started successfully",
                    Route = MapToRouteResponse(result),
                    UserName = user.DisplayName,
                    Context = context
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { Message = "Token expired - please refresh" });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "MobileRouteStartError")
                    .ForContext("Platform", request.Platform.ToString())
                    .Error(ex, "Error starting route via mobile app");

                return BadRequest(new { Message = "Error starting route", Error = ex.Message });
            }
        }

        /// <summary>
        /// Enhanced End Route API for mobile applications
        /// Supports GPS waypoints and route quality metrics
        /// </summary>
        [HttpPost("routes/end")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        public async Task<IActionResult> EndRoute([FromBody] MobileEndRouteRequest request)
        {
            try
            {
                var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();
                var platformName = request.Platform.ToString();

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { Message = "Invalid token - authentication required" });
                }

                var user = await _userService.GetUserByIdAsync(userId);
                if (user?.TwoFactorEnabled != true)
                {
                    return BadRequest(new { Message = "2FA is required for mobile integration" });
                }

                // Convert mobile request to base DTO
                var endRouteDto = new EndRouteDto
                {
                    Id = request.Id,
                    EndMile = request.EndMile,
                    Incomes = request.Incomes
                };

                var result = await _routeService.EndRouteAsync(endRouteDto, userId);

                // Process mobile-specific data (waypoints, quality metrics)
                if (request.Waypoints?.Any() == true)
                {
                    await ProcessRouteWaypoints(request.Id, request.Waypoints, userId);
                }

                if (request.Quality != null)
                {
                    await ProcessRouteQuality(request.Id, request.Quality, userId);
                }

                // Generate mobile-specific context
                var context = GenerateRouteContext(result, request, "end");

                Log.Logger
                    .ForContext("EventType", "MobileRouteEnded")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("Platform", platformName)
                    .ForContext("AppVersion", request.DeviceInfo?.AppVersion ?? "unknown")
                    .ForContext("RouteId", result?.Id?[..Math.Min(8, result.Id.Length)] + "***")
                    .ForContext("WaypointCount", request.Waypoints?.Count ?? 0)
                    .ForContext("RemoteIP", remoteIp)
                    .Information("Route ended via mobile app");

                return Ok(new MobileRouteResponse
                {
                    Success = true,
                    Message = "Route ended successfully",
                    Route = MapToRouteResponse(result),
                    UserName = user.DisplayName,
                    Context = context
                });
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "MobileRouteEndError")
                    .ForContext("Platform", request.Platform.ToString())
                    .Error(ex, "Error ending route via mobile app");

                return BadRequest(new { Message = "Error ending route", Error = ex.Message });
            }
        }

        #region Private Helper Methods

        /// <summary>
        /// Generate platform-specific configuration
        /// </summary>
        private Dictionary<string, object> GeneratePlatformConfig(MobilePlatform platform, string? appVersion)
        {
            var config = new Dictionary<string, object>();

            switch (platform)
            {
                case MobilePlatform.iOS:
                    config["shortcuts_enabled"] = true;
                    config["siri_enabled"] = true;
                    config["carplay_support"] = true;
                    config["background_app_refresh"] = true;
                    break;

                case MobilePlatform.Android:
                    config["widgets_enabled"] = true;
                    config["auto_support"] = true;
                    config["background_location"] = true;
                    config["quick_settings_tile"] = true;
                    break;

                default:
                    config["basic_features_only"] = true;
                    break;
            }

            // Version-specific features
            if (!string.IsNullOrEmpty(appVersion))
            {
                config["app_version"] = appVersion;
                config["features_available"] = GetFeaturesForVersion(appVersion);
            }

            return config;
        }

        /// <summary>
        /// Generate mobile configuration based on platform and device info
        /// </summary>
        private MobileConfig GenerateMobileConfig(MobilePlatform platform, DeviceInfo? deviceInfo)
        {
            var config = new MobileConfig
            {
                LocationConfig = new LocationConfig
                {
                    MinAccuracy = platform == MobilePlatform.iOS ? 30.0 : 50.0,
                    UpdateInterval = 15,
                    BackgroundTracking = true,
                    BatteryOptimization = deviceInfo?.LowPowerMode == true ? "aggressive" : "balanced"
                },
                SyncConfig = new SyncConfig
                {
                    SyncInterval = 30,
                    OfflineRetentionDays = 7,
                    WifiOnlySync = deviceInfo?.NetworkType == "cellular" ? true : false,
                    BatchSize = 50
                },
                UIConfig = new UIConfig
                {
                    Theme = "auto",
                    Units = "imperial", // TODO: Get from user preferences
                    Language = deviceInfo?.Language ?? "en-US",
                    AccessibilityFeatures = Array.Empty<string>()
                }
            };

            // Platform-specific settings
            switch (platform)
            {
                case MobilePlatform.iOS:
                    config.PlatformSettings["haptic_feedback"] = true;
                    config.PlatformSettings["force_touch"] = true;
                    break;

                case MobilePlatform.Android:
                    config.PlatformSettings["material_design"] = true;
                    config.PlatformSettings["adaptive_icons"] = true;
                    break;
            }

            return config;
        }

        /// <summary>
        /// Detect platform from User-Agent string
        /// </summary>
        private MobilePlatform DetectPlatformFromUserAgent(string userAgent)
        {
            if (string.IsNullOrEmpty(userAgent))
                return MobilePlatform.Unknown;

            userAgent = userAgent.ToLowerInvariant();

            if (userAgent.Contains("ios") || userAgent.Contains("iphone") || userAgent.Contains("ipad"))
                return MobilePlatform.iOS;

            if (userAgent.Contains("android"))
                return MobilePlatform.Android;

            return MobilePlatform.Unknown;
        }

        /// <summary>
        /// Get enabled features for user
        /// </summary>
        private string[] GetEnabledFeatures(User user)
        {
            var features = new List<string>();

            if (user.TwoFactorEnabled)
                features.Add("2fa");

            // Add other feature flags based on user subscription, preferences, etc.
            features.Add("route_tracking");
            features.Add("income_entry");
            features.Add("analytics");

            return features.ToArray();
        }

        /// <summary>
        /// Get features available for specific app version
        /// </summary>
        private string[] GetFeaturesForVersion(string version)
        {
            // TODO: Implement version-based feature flags
            return new[] { "route_tracking", "income_entry", "gps_tracking", "offline_mode" };
        }

        /// <summary>
        /// Generate route context for mobile response
        /// </summary>
        private MobileRouteContext GenerateRouteContext(Models.Route? route, object request, string action)
        {
            var context = new MobileRouteContext
            {
                SuggestedActions = Array.Empty<string>(),
                Insights = new Dictionary<string, object>(),
                Notifications = Array.Empty<MobileNotification>()
            };

            if (route == null) return context;

            // Generate context based on action type
            switch (action)
            {
                case "start":
                    context.SuggestedActions = new[] { "track_location", "set_reminders", "check_weather" };
                    break;

                case "end":
                    context.SuggestedActions = new[] { "view_summary", "plan_next_route", "export_data" };
                    context.Insights["total_duration"] = route.ActualEndTime?.Subtract(route.ActualStartTime ?? DateTime.UtcNow).TotalMinutes ?? 0;
                    break;
            }

            return context;
        }

        /// <summary>
        /// Map route model to response DTO
        /// </summary>
        private RouteResponseDto? MapToRouteResponse(Models.Route? route)
        {
            if (route == null) return null;

            return new RouteResponseDto
            {
                Id = route.Id,
                UserId = route.UserId,
                WorkType = route.WorkType,
                WorkTypeId = route.WorkTypeId,
                Status = route.Status,
                ScheduleStart = route.ScheduleStart,
                ScheduleEnd = route.ScheduleEnd,
                ActualStartTime = route.ActualStartTime,
                ActualEndTime = route.ActualEndTime,
                Incomes = route.Incomes.Select(i => new IncomeItemDto { Source = i.Source, Amount = i.Amount }).ToList(),
                TotalIncome = route.TotalIncome,
                EstimatedIncome = route.EstimatedIncome ?? 0m,
                Distance = route.Distance,
                StartMile = route.StartMile,
                EndMile = route.EndMile,
                CreatedAt = route.CreatedAt,
                UpdatedAt = route.UpdatedAt
            };
        }

        /// <summary>
        /// Process route waypoints (placeholder for future implementation)
        /// </summary>
        private async Task ProcessRouteWaypoints(string routeId, List<LocationPoint> waypoints, string userId)
        {
            // TODO: Implement waypoint processing and storage
            // This could involve:
            // - Storing waypoints in a separate collection
            // - Calculating route efficiency
            // - Generating route maps
            // - Analyzing traffic patterns
            await Task.CompletedTask;
        }

        /// <summary>
        /// Process route quality metrics (placeholder for future implementation)
        /// </summary>
        private async Task ProcessRouteQuality(string routeId, RouteQuality quality, string userId)
        {
            // TODO: Implement quality metrics processing
            // This could involve:
            // - Storing quality metrics for analytics
            // - Providing feedback to users about tracking quality
            // - Suggesting improvements for better tracking
            await Task.CompletedTask;
        }

        #endregion
    }
}