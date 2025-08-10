namespace IncomeMeter.Api.Models
{
    public class AuthModels
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public string? RedirectUrl { get; set; }
        public string? AccessToken { get; set; }
    }

    public class TokenResponse
    {
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
    }

    public class GmailMessage
    {
        public string Id { get; set; } = string.Empty;
        public string ThreadId { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string From { get; set; } = string.Empty;
        public string To { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string Snippet { get; set; } = string.Empty;
    }

}