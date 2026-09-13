using System.Globalization;
using System.Text.RegularExpressions;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

/// <summary>
/// Pulls structured values out of raw OCR text for the two photo types drivers upload:
/// UK fuel receipts (Sainsbury's / Tesco / Shell / BP …) and the car's "trip / accumulated info"
/// dashboard screen (odometer, trip miles, MPG). Pure regex – no external calls – so it is unit-testable
/// and can post-process any OCR engine's output.
/// </summary>
public static partial class ReceiptTextParser
{
    public const string KindReceipt = "receipt";
    public const string KindDashboard = "dashboard";

    // "Fuelling start time: 20/03/2026 20:07", "Date: 20/03/2026 20:07:31", "20-03-2026 20:07"
    [GeneratedRegex(@"(?<!\d)(\d{1,2})[/\-.](\d{1,2})[/\-.](20\d{2})(?:\D{1,3}(\d{1,2}):(\d{2})(?::(\d{2}))?)?", RegexOptions.Compiled)]
    private static partial Regex UkDateTime();

    // "33.66 LTR @ £1.389", "33.66L @ 138.9p", "Litres 33.66", "33.66 ltr"
    [GeneratedRegex(@"(?<!\d)(\d{1,3}\.\d{2})\s*(?:LTR|LTRS|LITRES?|LT|L)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex Litres();
    [GeneratedRegex(@"(?:LITRES?|LTR)\s*[:\-]?\s*(\d{1,3}\.\d{2})(?!\d)", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex LitresLabelFirst();

    // "@ £1.389", "@ 138.9p", "£1.389/L", "PPL 138.9"
    [GeneratedRegex(@"(?:@|PPL|PER\s*LITRE|/\s*L)\s*£?\s*(\d{1,3}\.\d{1,3})\s*(p)?", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex PricePerLitre();

    [GeneratedRegex(@"\b(UNLEADED|DIESEL|SUPER\s*UNLEADED|PREMIUM\s*UNLEADED|V-?POWER|MOMENTUM|ULTIMATE|E10|E5|B7|LPG|PETROL)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex FuelType();

    // "BALANCE DUE £46.75", "TOTAL 46.75", "Total to pay £46.75"
    [GeneratedRegex(@"(?:BALANCE\s*DUE|TOTAL(?:\s*TO\s*PAY)?|AMOUNT\s*DUE)\s*[:\-]?\s*£?\s*(\d{1,5}\.\d{2})(?!\d)", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex Total();

    // Dashboard: "84299 mi" (odometer, no decimals, >= 4 digits) vs "402.3 mi" (trip) vs "57.1 MPG".
    // OCR regularly reads "mi" as "ml", "m1" or "mI" and inserts thousands separators, so accept those too.
    [GeneratedRegex(@"(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d{4,7})\s*(?:mi|ml|m1|mI|miles)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex OdometerMiles();
    [GeneratedRegex(@"(?<![\d.,])(\d{1,5}[.,]\d)\s*(?:mi|ml|m1|mI|miles)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex TripMiles();
    [GeneratedRegex(@"(?<![\d.,])(\d{1,3}(?:[.,]\d)?)\s*(?:MPG|MPC|M\.P\.G)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex Mpg();
    [GeneratedRegex(@"ACCUMULATED\s*INFO|TRIP\s*(?:A|B|INFO|COMPUTER)|SINCE\s*(?:REFUEL|LAST\s*FUEL|START)|AVG\.?\s*(?:FUEL|CONSUMPTION)|DRIVE\s*INFO", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex DashboardWords();
    [GeneratedRegex(@"VAT|RECEIPT|PUMP|LITRE|LTR|CARDHOLDER|AUTH\s*CODE|MERCHANT|CONTACTLESS|VISA|MASTERCARD|CHANGE\s*£?\s*\d", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex ReceiptWords();

    /// <summary>Parse OCR text into a partially-filled <see cref="AttachmentOcr"/>. Returns null when nothing recognisable is found.</summary>
    public static AttachmentOcr? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        var result = new AttachmentOcr { RawText = text.Length > 8000 ? text[..8000] : text };
        var receiptScore = ReceiptWords().Matches(text).Count;
        var dashboardScore = DashboardWords().Matches(text).Count;

        // ---- dashboard trip screen ----
        var odo = OdometerMiles().Matches(text).Select(m => double.Parse(m.Groups[1].Value.Replace(",", ""), CultureInfo.InvariantCulture)).ToList();
        var trip = TripMiles().Matches(text).Select(m => double.Parse(m.Groups[1].Value.Replace(',', '.'), CultureInfo.InvariantCulture)).ToList();
        var mpg = Mpg().Match(text);

        if (odo.Count > 0 && (dashboardScore > 0 || mpg.Success || trip.Count > 0) && receiptScore == 0)
        {
            result.Kind = KindDashboard;
            result.OdometerMiles = odo.Max();                // the odometer is the biggest "NNNNN mi" on screen
            if (trip.Count > 0) result.TripMiles = trip.Max();
            if (mpg.Success) result.Mpg = double.Parse(mpg.Groups[1].Value.Replace(',', '.'), CultureInfo.InvariantCulture);
            result.Confidence = Math.Max(result.Confidence, 0.7f);
            return result;
        }

        // ---- fuel receipt ----
        var dateMatch = FindBestDate(text);
        if (dateMatch.HasValue) result.Date = dateMatch;

        var litres = Litres().Match(text);
        if (!litres.Success) litres = LitresLabelFirst().Match(text);
        if (litres.Success) result.Litres = double.Parse(litres.Groups[1].Value, CultureInfo.InvariantCulture);

        var ppl = PricePerLitre().Match(text);
        if (ppl.Success)
        {
            var v = decimal.Parse(ppl.Groups[1].Value, CultureInfo.InvariantCulture);
            if (ppl.Groups[2].Success || v > 20) v /= 100m;   // pence → pounds
            result.PricePerLitre = v;
        }

        var fuel = FuelType().Match(text);
        if (fuel.Success) result.FuelType = NormaliseFuel(fuel.Groups[1].Value);

        var total = Total().Match(text);
        if (total.Success) result.Total = decimal.Parse(total.Groups[1].Value, CultureInfo.InvariantCulture);
        else if (result.Litres.HasValue && result.PricePerLitre.HasValue)
            result.Total = Math.Round((decimal)result.Litres.Value * result.PricePerLitre.Value, 2);

        var found = result.Date.HasValue || result.Litres.HasValue || result.Total.HasValue || result.FuelType != null;
        if (!found && receiptScore == 0) return null;

        result.Kind = KindReceipt;
        result.Confidence = Math.Max(result.Confidence, found ? 0.6f : 0.3f);
        return result;
    }

    /// <summary>
    /// UK receipts print dd/MM/yyyy. Prefer a match that carries a time (the transaction line) over a bare date
    /// (e.g. an expiry or "valid until" date), and the first such occurrence on the receipt.
    /// </summary>
    private static DateTime? FindBestDate(string text)
    {
        DateTime? bare = null;
        foreach (Match m in UkDateTime().Matches(text))
        {
            var day = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            var month = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
            var year = int.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture);
            if (month > 12 && day <= 12) (day, month) = (month, day);   // tolerate MM/dd if it is the only valid reading
            if (month is < 1 or > 12 || day < 1 || day > DateTime.DaysInMonth(year, month)) continue;

            var hasTime = m.Groups[4].Success;
            var hour = hasTime ? int.Parse(m.Groups[4].Value, CultureInfo.InvariantCulture) : 0;
            var minute = hasTime ? int.Parse(m.Groups[5].Value, CultureInfo.InvariantCulture) : 0;
            var second = hasTime && m.Groups[6].Success ? int.Parse(m.Groups[6].Value, CultureInfo.InvariantCulture) : 0;
            if (hour > 23 || minute > 59) { hasTime = false; hour = minute = second = 0; }

            var dt = new DateTime(year, month, day, hour, minute, second, DateTimeKind.Unspecified);
            if (dt > DateTime.UtcNow.AddDays(2) || dt.Year < 2005) continue;

            if (hasTime) return dt;
            bare ??= dt;
        }
        return bare;
    }

    private static string NormaliseFuel(string raw)
    {
        var u = raw.ToUpperInvariant().Replace(" ", "");
        return u switch
        {
            "DIESEL" or "B7" => "diesel",
            "LPG" => "lpg",
            "SUPERUNLEADED" or "PREMIUMUNLEADED" or "V-POWER" or "VPOWER" or "MOMENTUM" or "ULTIMATE" or "E5" => "premiumUnleaded",
            _ => "unleaded"
        };
    }
}
