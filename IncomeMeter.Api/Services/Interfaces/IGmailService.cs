using IncomeMeter.Api.Models;
using System.Security.Claims;

namespace IncomeMeter.Api.Services.Interfaces
{

    public interface IGmailService
    {
        Task<IEnumerable<GmailMessage>> GetMessagesAsync(ClaimsPrincipal user, int maxResults = 10);
        Task<GmailMessage?> GetMessageAsync(ClaimsPrincipal user, string messageId);
        Task<bool> SendEmailAsync(ClaimsPrincipal user, string to, string subject, string body);
    }
}
