namespace IncomeMeter.Api.Models;

public class AppSettings
{
    public string FrontendBaseUrl { get; set; } = "http://localhost:5173";
    public string ApiBaseUrl { get; set; } = "https://localhost:7079";
    public string[] AllowedCorsOrigins { get; set; } = Array.Empty<string>();
}