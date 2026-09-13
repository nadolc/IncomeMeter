using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace IncomeMeter.Api.Services;

/// <summary>DVLA Vehicle Enquiry Service – free, one API key per customer, throttled (429).</summary>
public class DvlaSettings
{
    /// <summary>API key from https://developer-portal.driver-vehicle-licensing.api.gov.uk/</summary>
    public string? ApiKey { get; set; }
    public string BaseUrl { get; set; } = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";
}

/// <summary>DVSA MOT History API – free, OAuth2 client-credentials + X-API-Key. Fills the model / MOT history gap.</summary>
public class DvsaSettings
{
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string? Scope { get; set; }
    public string? TokenUrl { get; set; }
    public string? ApiKey { get; set; }
    public string BaseUrl { get; set; } = "https://history.mot.api.gov.uk";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret) &&
        !string.IsNullOrWhiteSpace(TokenUrl) && !string.IsNullOrWhiteSpace(ApiKey);
}

public class MotTestSummary
{
    public DateTime? CompletedDate { get; set; }
    public string? Result { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public double? OdometerValue { get; set; }
    /// <summary>"mi" | "km"</summary>
    public string? OdometerUnit { get; set; }
}

/// <summary>Vehicle facts merged from the DVLA VES and DVSA MOT History APIs, mapped to the Vehicle form fields.</summary>
public class VehicleLookupResult
{
    public string Registration { get; set; } = null!;
    public string? Make { get; set; }
    public string? Model { get; set; }
    public string? Colour { get; set; }
    /// <summary>"petrol" | "diesel" | "hybrid" | "electric" | "other"</summary>
    public string? FuelType { get; set; }
    public string? FuelTypeRaw { get; set; }
    public int? Co2GPerKm { get; set; }
    public int? EngineCapacityCc { get; set; }
    public int? YearOfManufacture { get; set; }
    public string? MonthOfFirstRegistration { get; set; }
    public DateTime? FirstUsedDate { get; set; }
    /// <summary>"car" | "van" | "motorcycle" – derived from the type approval category.</summary>
    public string? VehicleType { get; set; }
    public string? TypeApproval { get; set; }
    public string? EuroStatus { get; set; }
    public string? TaxStatus { get; set; }
    public DateTime? TaxDueDate { get; set; }
    public string? MotStatus { get; set; }
    public DateTime? MotExpiryDate { get; set; }
    /// <summary>Most recent first. Odometer readings recorded at each MOT are handy mileage checkpoints.</summary>
    public List<MotTestSummary> MotTests { get; set; } = new();
    public List<string> Sources { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

public class VehicleLookupThrottledException : Exception
{
    public VehicleLookupThrottledException(string source) : base($"{source} rate limit hit – try again in a few seconds") { }
}

public interface IVehicleLookupService
{
    bool IsConfigured { get; }
    /// <summary>Returns null when no source has a record for the registration.</summary>
    Task<VehicleLookupResult?> LookupAsync(string registration, CancellationToken ct = default);
}

public class DvlaVehicleLookupService : IVehicleLookupService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly DvlaSettings _dvla;
    private readonly DvsaSettings _dvsa;
    private readonly ILogger<DvlaVehicleLookupService> _logger;

    // DVSA bearer token cache (tokens last ~1 hour).
    private static readonly SemaphoreSlim TokenLock = new(1, 1);
    private static string? _dvsaToken;
    private static DateTime _dvsaTokenExpiresUtc = DateTime.MinValue;

    public DvlaVehicleLookupService(
        IHttpClientFactory httpClientFactory,
        IOptions<DvlaSettings> dvla,
        IOptions<DvsaSettings> dvsa,
        ILogger<DvlaVehicleLookupService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _dvla = dvla.Value;
        _dvsa = dvsa.Value;
        _logger = logger;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_dvla.ApiKey) || _dvsa.IsConfigured;

    public async Task<VehicleLookupResult?> LookupAsync(string registration, CancellationToken ct = default)
    {
        if (!IsConfigured) throw new InvalidOperationException("Neither Dvla:ApiKey nor the Dvsa:* settings are configured");

        var reg = new string(registration.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        if (reg.Length is < 2 or > 8) throw new ArgumentException("Invalid registration");

        var result = new VehicleLookupResult { Registration = reg };
        var found = false;

        // 1. DVLA VES – authoritative for CO2, tax, type approval.
        if (!string.IsNullOrWhiteSpace(_dvla.ApiKey))
        {
            try
            {
                var ves = await QueryDvlaAsync(reg, ct);
                if (ves != null)
                {
                    found = true;
                    result.Sources.Add("DVLA VES");
                    result.Registration = ves.RegistrationNumber ?? reg;
                    result.Make = ToTitle(ves.Make);
                    result.Colour = ToTitle(ves.Colour);
                    result.FuelTypeRaw = ves.FuelType;
                    result.FuelType = MapFuel(ves.FuelType);
                    result.Co2GPerKm = ves.Co2Emissions;
                    result.EngineCapacityCc = ves.EngineCapacity;
                    result.YearOfManufacture = ves.YearOfManufacture;
                    result.MonthOfFirstRegistration = ves.MonthOfFirstRegistration;
                    result.TypeApproval = ves.TypeApproval;
                    result.EuroStatus = ves.EuroStatus;
                    result.VehicleType = MapType(ves.TypeApproval, ves.Wheelplan);
                    result.TaxStatus = ves.TaxStatus;
                    result.TaxDueDate = ves.TaxDueDate;
                    result.MotStatus = ves.MotStatus;
                    result.MotExpiryDate = ves.MotExpiryDate;
                }
                else
                {
                    result.Warnings.Add("DVLA has no record for this registration.");
                }
            }
            catch (VehicleLookupThrottledException) when (_dvsa.IsConfigured)
            {
                result.Warnings.Add("DVLA rate limit hit – only MOT history data returned.");
            }
        }

        // 2. DVSA MOT history – model, first-used date, MOT odometer readings.
        if (_dvsa.IsConfigured)
        {
            try
            {
                var mot = await QueryDvsaAsync(reg, ct);
                if (mot != null)
                {
                    found = true;
                    result.Sources.Add("DVSA MOT History");
                    result.Make ??= ToTitle(mot.Make);
                    result.Model = ToTitle(mot.Model);
                    result.Colour ??= ToTitle(mot.PrimaryColour);
                    result.FuelTypeRaw ??= mot.FuelType;
                    result.FuelType ??= MapFuel(mot.FuelType);
                    result.EngineCapacityCc ??= int.TryParse(mot.EngineSize, out var cc) ? cc : null;
                    result.FirstUsedDate = ParseDvsaDate(mot.FirstUsedDate) ?? ParseDvsaDate(mot.RegistrationDate);
                    result.YearOfManufacture ??= ParseDvsaDate(mot.ManufactureDate)?.Year ?? result.FirstUsedDate?.Year;
                    result.MotTests = (mot.MotTests ?? new())
                        .Select(t => new MotTestSummary
                        {
                            CompletedDate = ParseDvsaDate(t.CompletedDate),
                            Result = t.TestResult,
                            ExpiryDate = ParseDvsaDate(t.ExpiryDate),
                            OdometerValue = double.TryParse(t.OdometerValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : null,
                            OdometerUnit = t.OdometerUnit?.ToLowerInvariant() switch { "mi" or "miles" => "mi", "km" => "km", _ => t.OdometerUnit }
                        })
                        .OrderByDescending(t => t.CompletedDate)
                        .ToList();
                    if (result.MotExpiryDate == null)
                        result.MotExpiryDate = result.MotTests.FirstOrDefault(t => t.Result?.StartsWith("PASS", StringComparison.OrdinalIgnoreCase) == true)?.ExpiryDate;
                }
                else
                {
                    result.Warnings.Add("DVSA has no MOT history for this registration (vehicles under 3 years old have none).");
                }
            }
            catch (VehicleLookupThrottledException) when (found)
            {
                result.Warnings.Add("DVSA rate limit hit – MOT history not included.");
            }
        }

        return found ? result : null;
    }

    // ---------- DVLA ----------

    private async Task<DvlaResponse?> QueryDvlaAsync(string reg, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("dvla");
        using var request = new HttpRequestMessage(HttpMethod.Post, _dvla.BaseUrl)
        {
            Content = JsonContent.Create(new { registrationNumber = reg })
        };
        request.Headers.Add("x-api-key", _dvla.ApiKey);

        using var response = await client.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        if (response.StatusCode == HttpStatusCode.TooManyRequests) throw new VehicleLookupThrottledException("DVLA");
        if (response.StatusCode == HttpStatusCode.BadRequest) throw new ArgumentException("DVLA rejected the registration number");
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("DVLA lookup failed with {Status}", response.StatusCode);
            throw new HttpRequestException($"DVLA lookup failed ({(int)response.StatusCode})");
        }
        return await response.Content.ReadFromJsonAsync<DvlaResponse>(cancellationToken: ct);
    }

    // ---------- DVSA ----------

    private async Task<DvsaVehicleResponse?> QueryDvsaAsync(string reg, CancellationToken ct)
    {
        var token = await GetDvsaTokenAsync(ct);
        var client = _httpClientFactory.CreateClient("dvsa");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{_dvsa.BaseUrl.TrimEnd('/')}/v1/trade/vehicles/registration/{Uri.EscapeDataString(reg)}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Add("X-API-Key", _dvsa.ApiKey);

        using var response = await client.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        if (response.StatusCode == HttpStatusCode.TooManyRequests) throw new VehicleLookupThrottledException("DVSA");
        if (response.StatusCode == HttpStatusCode.BadRequest) throw new ArgumentException("DVSA rejected the registration number");
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("DVSA MOT lookup failed with {Status}", response.StatusCode);
            throw new HttpRequestException($"DVSA MOT lookup failed ({(int)response.StatusCode})");
        }
        return await response.Content.ReadFromJsonAsync<DvsaVehicleResponse>(cancellationToken: ct);
    }

    private async Task<string> GetDvsaTokenAsync(CancellationToken ct)
    {
        if (_dvsaToken != null && DateTime.UtcNow < _dvsaTokenExpiresUtc) return _dvsaToken;

        await TokenLock.WaitAsync(ct);
        try
        {
            if (_dvsaToken != null && DateTime.UtcNow < _dvsaTokenExpiresUtc) return _dvsaToken;

            var client = _httpClientFactory.CreateClient("dvsa");
            using var response = await client.PostAsync(_dvsa.TokenUrl, new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = _dvsa.ClientId!,
                ["client_secret"] = _dvsa.ClientSecret!,
                ["scope"] = _dvsa.Scope ?? "https://tapi.dvsa.gov.uk/.default"
            }), ct);
            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException($"DVSA token request failed ({(int)response.StatusCode})");

            var token = await response.Content.ReadFromJsonAsync<OAuthTokenResponse>(cancellationToken: ct)
                        ?? throw new HttpRequestException("DVSA token response was empty");
            _dvsaToken = token.AccessToken;
            _dvsaTokenExpiresUtc = DateTime.UtcNow.AddSeconds(Math.Max(60, token.ExpiresIn - 60));
            return _dvsaToken!;
        }
        finally
        {
            TokenLock.Release();
        }
    }

    // ---------- mapping helpers ----------

    private static string? MapFuel(string? raw)
    {
        if (raw == null) return null;
        var u = raw.ToUpperInvariant();
        if (u.Contains("HYBRID")) return "hybrid";
        if (u.Contains("ELECTRIC")) return "electric";
        if (u.Contains("DIESEL")) return "diesel";
        if (u.Contains("PETROL")) return "petrol";
        return "other";
    }

    private static string? MapType(string? typeApproval, string? wheelplan)
    {
        var ta = typeApproval?.ToUpperInvariant();
        if (ta != null)
        {
            if (ta.StartsWith("M1")) return "car";
            if (ta.StartsWith("N")) return "van";
            if (ta.StartsWith("L")) return "motorcycle";
        }
        var wp = wheelplan?.ToUpperInvariant();
        if (wp != null && wp.Contains("2 WHEEL")) return "motorcycle";
        return null;
    }

    private static string? ToTitle(string? s) =>
        string.IsNullOrWhiteSpace(s) ? s : CultureInfo.InvariantCulture.TextInfo.ToTitleCase(s.ToLowerInvariant());

    // DVSA uses "yyyy.MM.dd", "yyyy.MM.dd HH:mm:ss" and ISO-8601 depending on the field.
    private static DateTime? ParseDvsaDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        string[] formats = { "yyyy.MM.dd HH:mm:ss", "yyyy.MM.dd", "yyyy-MM-ddTHH:mm:ss.fffZ", "yyyy-MM-ddTHH:mm:ssZ", "yyyy-MM-dd" };
        if (DateTime.TryParseExact(s, formats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dt)) return dt;
        return DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out dt) ? dt : null;
    }

    // ---------- wire DTOs ----------

    private sealed class DvlaResponse
    {
        [JsonPropertyName("registrationNumber")] public string? RegistrationNumber { get; set; }
        [JsonPropertyName("make")] public string? Make { get; set; }
        [JsonPropertyName("colour")] public string? Colour { get; set; }
        [JsonPropertyName("fuelType")] public string? FuelType { get; set; }
        [JsonPropertyName("co2Emissions")] public int? Co2Emissions { get; set; }
        [JsonPropertyName("engineCapacity")] public int? EngineCapacity { get; set; }
        [JsonPropertyName("yearOfManufacture")] public int? YearOfManufacture { get; set; }
        [JsonPropertyName("monthOfFirstRegistration")] public string? MonthOfFirstRegistration { get; set; }
        [JsonPropertyName("typeApproval")] public string? TypeApproval { get; set; }
        [JsonPropertyName("wheelplan")] public string? Wheelplan { get; set; }
        [JsonPropertyName("euroStatus")] public string? EuroStatus { get; set; }
        [JsonPropertyName("taxStatus")] public string? TaxStatus { get; set; }
        [JsonPropertyName("taxDueDate")] public DateTime? TaxDueDate { get; set; }
        [JsonPropertyName("motStatus")] public string? MotStatus { get; set; }
        [JsonPropertyName("motExpiryDate")] public DateTime? MotExpiryDate { get; set; }
    }

    private sealed class DvsaVehicleResponse
    {
        [JsonPropertyName("registration")] public string? Registration { get; set; }
        [JsonPropertyName("make")] public string? Make { get; set; }
        [JsonPropertyName("model")] public string? Model { get; set; }
        [JsonPropertyName("firstUsedDate")] public string? FirstUsedDate { get; set; }
        [JsonPropertyName("registrationDate")] public string? RegistrationDate { get; set; }
        [JsonPropertyName("manufactureDate")] public string? ManufactureDate { get; set; }
        [JsonPropertyName("fuelType")] public string? FuelType { get; set; }
        [JsonPropertyName("primaryColour")] public string? PrimaryColour { get; set; }
        [JsonPropertyName("engineSize")] public string? EngineSize { get; set; }
        [JsonPropertyName("motTests")] public List<DvsaMotTest>? MotTests { get; set; }
    }

    private sealed class DvsaMotTest
    {
        [JsonPropertyName("completedDate")] public string? CompletedDate { get; set; }
        [JsonPropertyName("testResult")] public string? TestResult { get; set; }
        [JsonPropertyName("expiryDate")] public string? ExpiryDate { get; set; }
        [JsonPropertyName("odometerValue")] public string? OdometerValue { get; set; }
        [JsonPropertyName("odometerUnit")] public string? OdometerUnit { get; set; }
    }

    private sealed class OAuthTokenResponse
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; set; }
        [JsonPropertyName("expires_in")] public int ExpiresIn { get; set; } = 3600;
    }
}
