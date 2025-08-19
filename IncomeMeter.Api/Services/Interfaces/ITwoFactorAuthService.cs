using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services.Interfaces
{
    public interface ITwoFactorAuthService
    {
        /// <summary>
        /// Generates a new 2FA secret key and QR code for user setup
        /// </summary>
        Task<Setup2FAResponse> GenerateSetupAsync(string userId, string email, string? recoveryEmail = null);
        
        /// <summary>
        /// Verifies a TOTP code or backup code and enables 2FA if setup is complete
        /// </summary>
        Task<Verify2FAResponse> VerifyCodeAsync(string userId, string code, string? backupCode = null);
        
        /// <summary>
        /// Validates a TOTP code for login
        /// </summary>
        Task<bool> ValidateTotpAsync(string userId, string code);
        
        /// <summary>
        /// Validates and uses a backup code
        /// </summary>
        Task<bool> ValidateBackupCodeAsync(string userId, string backupCode);
        
        /// <summary>
        /// Disables 2FA for a user
        /// </summary>
        Task<bool> DisableTwoFactorAsync(string userId, string verificationCode);
        
        /// <summary>
        /// Generates new backup codes
        /// </summary>
        Task<List<string>> GenerateNewBackupCodesAsync(string userId);
        
        /// <summary>
        /// Gets remaining backup codes count
        /// </summary>
        Task<int> GetRemainingBackupCodesCountAsync(string userId);
        
        /// <summary>
        /// Generates QR code as base64 image
        /// </summary>
        string GenerateQRCodeBase64(string secretKey, string userEmail, string issuer);
        
        /// <summary>
        /// Validates refresh token and returns user info
        /// </summary>
        Task<User?> ValidateRefreshTokenAsync(string token);
        
        /// <summary>
        /// Creates new refresh token for user
        /// </summary>
        Task<RefreshToken> CreateRefreshTokenAsync(string userId, string? ipAddress = null);
        
        /// <summary>
        /// Revokes refresh token
        /// </summary>
        Task<bool> RevokeRefreshTokenAsync(string token, string? ipAddress = null);
        
        /// <summary>
        /// Rotates refresh token (revokes old, creates new)
        /// </summary>
        Task<RefreshToken> RotateRefreshTokenAsync(string oldToken, string? ipAddress = null);
    }
}