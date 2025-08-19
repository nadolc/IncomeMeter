using MongoDB.Driver;
using OtpNet;
using QRCoder;
using System.Security.Cryptography;
using System.Text;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;
using Serilog;

namespace IncomeMeter.Api.Services
{
    public class TwoFactorAuthService : ITwoFactorAuthService
    {
        private readonly IMongoCollection<User> _users;
        private readonly ILogger<TwoFactorAuthService> _logger;
        private readonly string _applicationName;

        public TwoFactorAuthService(MongoDbContext context, ILogger<TwoFactorAuthService> logger, IConfiguration configuration)
        {
            _users = context.Users;
            _logger = logger;
            _applicationName = configuration["ApplicationName"] ?? "IncomeMeter";
        }

        public async Task<Setup2FAResponse> GenerateSetupAsync(string userId, string email, string? recoveryEmail = null)
        {
            try
            {
                var user = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
                if (user == null)
                {
                    return new Setup2FAResponse
                    {
                        Success = false,
                        Message = "User not found"
                    };
                }

                // Generate secret key
                var key = KeyGeneration.GenerateRandomKey(20);
                var base32String = Base32Encoding.ToString(key);

                // Generate backup codes
                var backupCodes = GenerateBackupCodes();

                // Create 2FA setup (not yet verified)
                var twoFactorAuth = new TwoFactorAuth
                {
                    SecretKey = base32String,
                    SetupAt = DateTime.UtcNow,
                    IsVerified = false,
                    RecoveryEmail = recoveryEmail
                };

                // Create backup code objects
                var backupCodeObjects = backupCodes.Select(code => new BackupCode
                {
                    Code = HashBackupCode(code),
                    CreatedAt = DateTime.UtcNow
                }).ToList();

                // Update user
                var update = Builders<User>.Update
                    .Set(u => u.TwoFactorAuth, twoFactorAuth)
                    .Set(u => u.BackupCodes, backupCodeObjects)
                    .Set(u => u.UpdatedAt, DateTime.UtcNow);

                await _users.UpdateOneAsync(u => u.Id == userId, update);

                // Generate QR code
                var qrCodeBase64 = GenerateQRCodeBase64(base32String, email, _applicationName);
                var manualEntryCode = FormatManualEntryKey(base32String);

                Log.Logger
                    .ForContext("EventType", "2FASetupGenerated")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Information("2FA setup generated for user");

                return new Setup2FAResponse
                {
                    Success = true,
                    Message = "2FA setup generated successfully",
                    SecretKey = base32String,
                    QRCodeBase64 = qrCodeBase64,
                    ManualEntryCode = manualEntryCode,
                    BackupCodes = backupCodes
                };
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "2FASetupError")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Error(ex, "Error generating 2FA setup");

                return new Setup2FAResponse
                {
                    Success = false,
                    Message = "Error generating 2FA setup"
                };
            }
        }

        public async Task<Verify2FAResponse> VerifyCodeAsync(string userId, string code, string? backupCode = null)
        {
            try
            {
                var user = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
                if (user?.TwoFactorAuth == null)
                {
                    return new Verify2FAResponse
                    {
                        Success = false,
                        Message = "2FA not set up for this user"
                    };
                }

                bool isValid = false;

                if (!string.IsNullOrEmpty(backupCode))
                {
                    isValid = await ValidateAndUseBackupCodeAsync(userId, backupCode);
                }
                else if (!string.IsNullOrEmpty(code))
                {
                    isValid = ValidateTotp(user.TwoFactorAuth.SecretKey, code);
                }

                if (isValid)
                {
                    // Mark 2FA as verified and enabled
                    var update = Builders<User>.Update
                        .Set(u => u.TwoFactorAuth.IsVerified, true)
                        .Set(u => u.IsTwoFactorEnabled, true)
                        .Set(u => u.UpdatedAt, DateTime.UtcNow);

                    await _users.UpdateOneAsync(u => u.Id == userId, update);

                    Log.Logger
                        .ForContext("EventType", "2FAVerificationSuccess")
                        .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                        .ForContext("CodeType", !string.IsNullOrEmpty(backupCode) ? "BackupCode" : "TOTP")
                        .Information("2FA verification successful");

                    return new Verify2FAResponse
                    {
                        Success = true,
                        Message = "2FA setup completed successfully",
                        IsSetupComplete = true
                    };
                }

                Log.Logger
                    .ForContext("EventType", "2FAVerificationFailed")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .ForContext("CodeType", !string.IsNullOrEmpty(backupCode) ? "BackupCode" : "TOTP")
                    .Warning("2FA verification failed - invalid code");

                return new Verify2FAResponse
                {
                    Success = false,
                    Message = "Invalid verification code"
                };
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "2FAVerificationError")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Error(ex, "Error during 2FA verification");

                return new Verify2FAResponse
                {
                    Success = false,
                    Message = "Error verifying code"
                };
            }
        }

        public async Task<bool> ValidateTotpAsync(string userId, string code)
        {
            var user = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
            if (user?.TwoFactorAuth?.IsVerified != true)
                return false;

            return ValidateTotp(user.TwoFactorAuth.SecretKey, code);
        }

        public async Task<bool> ValidateBackupCodeAsync(string userId, string backupCode)
        {
            return await ValidateAndUseBackupCodeAsync(userId, backupCode);
        }

        public async Task<bool> DisableTwoFactorAsync(string userId, string verificationCode)
        {
            try
            {
                var user = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
                if (user?.TwoFactorAuth == null)
                    return false;

                if (!ValidateTotp(user.TwoFactorAuth.SecretKey, verificationCode))
                    return false;

                var update = Builders<User>.Update
                    .Unset(u => u.TwoFactorAuth)
                    .Set(u => u.IsTwoFactorEnabled, false)
                    .Set(u => u.BackupCodes, new List<BackupCode>())
                    .Set(u => u.UpdatedAt, DateTime.UtcNow);

                await _users.UpdateOneAsync(u => u.Id == userId, update);

                Log.Logger
                    .ForContext("EventType", "2FADisabled")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Information("2FA disabled for user");

                return true;
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "2FADisableError")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Error(ex, "Error disabling 2FA");

                return false;
            }
        }

        public async Task<List<string>> GenerateNewBackupCodesAsync(string userId)
        {
            try
            {
                var backupCodes = GenerateBackupCodes();
                var backupCodeObjects = backupCodes.Select(code => new BackupCode
                {
                    Code = HashBackupCode(code),
                    CreatedAt = DateTime.UtcNow
                }).ToList();

                var update = Builders<User>.Update
                    .Set(u => u.BackupCodes, backupCodeObjects)
                    .Set(u => u.UpdatedAt, DateTime.UtcNow);

                await _users.UpdateOneAsync(u => u.Id == userId, update);

                Log.Logger
                    .ForContext("EventType", "BackupCodesRegenerated")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Information("New backup codes generated");

                return backupCodes;
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "BackupCodesError")
                    .ForContext("UserId", userId[..Math.Min(8, userId.Length)] + "***")
                    .Error(ex, "Error generating backup codes");

                return new List<string>();
            }
        }

        public async Task<int> GetRemainingBackupCodesCountAsync(string userId)
        {
            var user = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
            return user?.BackupCodes?.Count(bc => !bc.IsUsed) ?? 0;
        }

        public string GenerateQRCodeBase64(string secretKey, string userEmail, string issuer)
        {
            try
            {
                var otpUri = $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(userEmail)}?secret={secretKey}&issuer={Uri.EscapeDataString(issuer)}";
                
                using var qrGenerator = new QRCodeGenerator();
                using var qrCodeData = qrGenerator.CreateQrCode(otpUri, QRCodeGenerator.ECCLevel.Q);
                using var qrCode = new PngByteQRCode(qrCodeData);
                
                var qrCodeBytes = qrCode.GetGraphic(20);
                return Convert.ToBase64String(qrCodeBytes);
            }
            catch (Exception ex)
            {
                Log.Logger
                    .ForContext("EventType", "QRCodeGenerationError")
                    .Error(ex, "Error generating QR code");
                
                return string.Empty;
            }
        }

        public async Task<User?> ValidateRefreshTokenAsync(string token)
        {
            var user = await _users.Find(u => u.RefreshTokens.Any(rt => rt.Token == token && rt.IsActive)).FirstOrDefaultAsync();
            return user;
        }

        public async Task<RefreshToken> CreateRefreshTokenAsync(string userId, string? ipAddress = null)
        {
            var refreshToken = new RefreshToken
            {
                Token = GenerateRefreshToken(),
                ExpiresAt = DateTime.UtcNow.AddDays(30),
                CreatedAt = DateTime.UtcNow,
                CreatedByIp = ipAddress
            };

            var update = Builders<User>.Update
                .Push(u => u.RefreshTokens, refreshToken)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await _users.UpdateOneAsync(u => u.Id == userId, update);

            return refreshToken;
        }

        public async Task<bool> RevokeRefreshTokenAsync(string token, string? ipAddress = null)
        {
            var filter = Builders<User>.Filter.ElemMatch(u => u.RefreshTokens, rt => rt.Token == token);
            var user = await _users.Find(filter).FirstOrDefaultAsync();

            if (user == null) return false;

            var refreshToken = user.RefreshTokens.First(rt => rt.Token == token);
            refreshToken.RevokedAt = DateTime.UtcNow;
            refreshToken.RevokedByIp = ipAddress;

            var update = Builders<User>.Update
                .Set(u => u.RefreshTokens, user.RefreshTokens)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await _users.UpdateOneAsync(u => u.Id == user.Id, update);

            return true;
        }

        public async Task<RefreshToken> RotateRefreshTokenAsync(string oldToken, string? ipAddress = null)
        {
            var user = await ValidateRefreshTokenAsync(oldToken);
            if (user == null)
                throw new UnauthorizedAccessException("Invalid refresh token");

            var newRefreshToken = new RefreshToken
            {
                Token = GenerateRefreshToken(),
                ExpiresAt = DateTime.UtcNow.AddDays(30),
                CreatedAt = DateTime.UtcNow,
                CreatedByIp = ipAddress
            };

            // Revoke old token and add new one
            var oldRefreshToken = user.RefreshTokens.First(rt => rt.Token == oldToken);
            oldRefreshToken.RevokedAt = DateTime.UtcNow;
            oldRefreshToken.RevokedByIp = ipAddress;
            oldRefreshToken.ReplacedByToken = newRefreshToken.Token;

            user.RefreshTokens.Add(newRefreshToken);

            var update = Builders<User>.Update
                .Set(u => u.RefreshTokens, user.RefreshTokens)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await _users.UpdateOneAsync(u => u.Id == user.Id, update);

            return newRefreshToken;
        }

        #region Private Methods

        private bool ValidateTotp(string secretKey, string code)
        {
            try
            {
                var keyBytes = Base32Encoding.ToBytes(secretKey);
                var totp = new Totp(keyBytes);
                
                // Allow for clock drift by checking current and previous/next periods
                var currentTime = DateTime.UtcNow;
                var timesteps = new[]
                {
                    currentTime.AddSeconds(-30), // Previous period
                    currentTime,                  // Current period
                    currentTime.AddSeconds(30)    // Next period
                };

                foreach (var time in timesteps)
                {
                    var expectedCode = totp.ComputeTotp(time);
                    if (expectedCode == code)
                        return true;
                }

                return false;
            }
            catch
            {
                return false;
            }
        }

        private async Task<bool> ValidateAndUseBackupCodeAsync(string userId, string backupCode)
        {
            var user = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
            if (user == null) return false;

            var hashedCode = HashBackupCode(backupCode);
            var matchingCode = user.BackupCodes.FirstOrDefault(bc => !bc.IsUsed && bc.Code == hashedCode);

            if (matchingCode == null) return false;

            // Mark backup code as used
            matchingCode.IsUsed = true;
            matchingCode.UsedAt = DateTime.UtcNow;

            var update = Builders<User>.Update
                .Set(u => u.BackupCodes, user.BackupCodes)
                .Set(u => u.UpdatedAt, DateTime.UtcNow);

            await _users.UpdateOneAsync(u => u.Id == userId, update);

            return true;
        }

        private List<string> GenerateBackupCodes()
        {
            var codes = new List<string>();
            using var rng = RandomNumberGenerator.Create();

            for (int i = 0; i < 10; i++) // Generate 10 backup codes
            {
                var bytes = new byte[5]; // 5 bytes = 10 hex characters
                rng.GetBytes(bytes);
                var code = Convert.ToHexString(bytes).ToLower();
                codes.Add($"{code[..5]}-{code[5..]}"); // Format as XXXXX-XXXXX
            }

            return codes;
        }

        private string HashBackupCode(string code)
        {
            using var sha256 = SHA256.Create();
            var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(code.ToLower()));
            return Convert.ToBase64String(hashedBytes);
        }

        private string GenerateRefreshToken()
        {
            using var rng = RandomNumberGenerator.Create();
            var bytes = new byte[64];
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes);
        }

        private string FormatManualEntryKey(string secretKey)
        {
            // Format for easier manual entry: XXXX XXXX XXXX XXXX
            var chunks = new List<string>();
            for (int i = 0; i < secretKey.Length; i += 4)
            {
                var length = Math.Min(4, secretKey.Length - i);
                chunks.Add(secretKey.Substring(i, length));
            }
            return string.Join(" ", chunks);
        }

        #endregion
    }
}