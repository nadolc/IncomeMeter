using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
using System.Text;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Gmail.v1;
using Google.Apis.Gmail.v1.Data;
using Google.Apis.Services;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
using System.Text;

namespace IncomeMeter.Api.Services
{
    public class GmailService : IGmailService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public GmailService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        private async Task<Google.Apis.Gmail.v1.GmailService> GetGmailServiceAsync(ClaimsPrincipal user)
        {
            var accessToken = await _httpContextAccessor.HttpContext!
                .GetTokenAsync("access_token");

            if (string.IsNullOrEmpty(accessToken))
            {
                throw new UnauthorizedAccessException("No access token available");
            }

            var credential = GoogleCredential.FromAccessToken(accessToken);

            return new Google.Apis.Gmail.v1.GmailService(new BaseClientService.Initializer()
            {
                HttpClientInitializer = credential,
                ApplicationName = "Gmail OAuth App",
            });
        }

        public async Task<IEnumerable<GmailMessage>> GetMessagesAsync(ClaimsPrincipal user, int maxResults = 10)
        {
            var service = await GetGmailServiceAsync(user);

            var request = service.Users.Messages.List("me");
            request.MaxResults = maxResults;

            var response = await request.ExecuteAsync();
            var messages = new List<GmailMessage>();

            if (response.Messages != null)
            {
                foreach (var message in response.Messages)
                {
                    var fullMessage = await service.Users.Messages.Get("me", message.Id).ExecuteAsync();
                    messages.Add(MapToGmailMessage(fullMessage));
                }
            }

            return messages;
        }

        public async Task<GmailMessage?> GetMessageAsync(ClaimsPrincipal user, string messageId)
        {
            var service = await GetGmailServiceAsync(user);

            try
            {
                var message = await service.Users.Messages.Get("me", messageId).ExecuteAsync();
                return MapToGmailMessage(message);
            }
            catch
            {
                return null;
            }
        }

        public async Task<bool> SendEmailAsync(ClaimsPrincipal user, string to, string subject, string body)
        {
            var service = await GetGmailServiceAsync(user);

            var message = new Message
            {
                Raw = EncodeMessage(to, subject, body)
            };

            try
            {
                await service.Users.Messages.Send(message, "me").ExecuteAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static GmailMessage MapToGmailMessage(Message message)
        {
            var gmailMessage = new GmailMessage
            {
                Id = message.Id,
                ThreadId = message.ThreadId,
                Snippet = message.Snippet ?? string.Empty
            };

            if (message.Payload?.Headers != null)
            {
                foreach (var header in message.Payload.Headers)
                {
                    switch (header.Name?.ToLower())
                    {
                        case "subject":
                            gmailMessage.Subject = header.Value ?? string.Empty;
                            break;
                        case "from":
                            gmailMessage.From = header.Value ?? string.Empty;
                            break;
                        case "to":
                            gmailMessage.To = header.Value ?? string.Empty;
                            break;
                        case "date":
                            if (DateTime.TryParse(header.Value, out var date))
                                gmailMessage.Date = date;
                            break;
                    }
                }
            }

            return gmailMessage;
        }

        private static string EncodeMessage(string to, string subject, string body)
        {
            var message = $"To: {to}\r\n" +
                         $"Subject: {subject}\r\n" +
                         $"Content-Type: text/plain; charset=utf-8\r\n\r\n" +
                         $"{body}";

            return Convert.ToBase64String(Encoding.UTF8.GetBytes(message))
                .Replace('+', '-')
                .Replace('/', '_')
                .Replace("=", "");
        }
    }
}
