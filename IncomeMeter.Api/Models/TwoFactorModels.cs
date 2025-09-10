namespace IncomeMeter.Api.Models;

public class Setup2FAResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? SecretKey { get; set; }
    public string? QrCodeBase64 { get; set; }
    public List<string>? BackupCodes { get; set; }
}

public class Verify2FAResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public List<string>? RemainingBackupCodes { get; set; }
}

public class TwoFactorAuth
{
    public string SecretKey { get; set; } = string.Empty;
    public DateTime SetupAt { get; set; }
    public bool IsVerified { get; set; }
    public List<string> BackupCodes { get; set; } = new();
    public List<string> UsedBackupCodes { get; set; } = new();
    public DateTime? EnabledAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
}

public class RefreshToken
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedByIp { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? RevokedByIp { get; set; }
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsRevoked => RevokedAt != null;
    public bool IsActive => !IsRevoked && !IsExpired;
}