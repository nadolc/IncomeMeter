using System.Globalization;
using System.Text.RegularExpressions;
using MetadataExtractor;
using MetadataExtractor.Formats.Exif;

namespace IncomeMeter.Api.Services;

/// <summary>
/// Works out when a photo was taken: EXIF DateTimeOriginal first, then common
/// camera/phone filename patterns (IMG_20250814_183212, PXL_..., Screenshot_2025-08-14-18-32-12, ...).
/// </summary>
public static class PhotoDateExtractor
{
    public const string SourceExif = "exif";
    public const string SourceFilename = "filename";

    // yyyyMMdd[_-]HHmmss   e.g. IMG_20250814_183212.jpg, PXL_20250814_183212123.jpg, 20250814_183212.jpg
    private static readonly Regex CompactWithTime = new(@"(?<!\d)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[_\-T ]?([01]\d|2[0-3])([0-5]\d)([0-5]\d)(?:\d{3})?(?!\d)", RegexOptions.Compiled);
    // yyyy-MM-dd[ _-]HH[.:-]mm[.:-]ss   e.g. Screenshot_2025-08-14-18-32-12, 2025-08-14 18.32.12.jpg
    private static readonly Regex DashedWithTime = new(@"(?<!\d)(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[ _\-T]([01]\d|2[0-3])[.:\-]([0-5]\d)[.:\-]([0-5]\d)(?!\d)", RegexOptions.Compiled);
    // yyyyMMdd only (no time)   e.g. IMG_20250814.jpg
    private static readonly Regex CompactDateOnly = new(@"(?<!\d)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)", RegexOptions.Compiled);
    // yyyy-MM-dd only
    private static readonly Regex DashedDateOnly = new(@"(?<!\d)(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?!\d)", RegexOptions.Compiled);

    /// <summary>
    /// Returns the best-guess capture time (as an unspecified-kind local wall-clock time) and its source, or (null, null).
    /// The stream position is restored after reading.
    /// </summary>
    public static (DateTime? takenAt, string? source) Extract(Stream stream, string fileName)
    {
        var exif = TryExif(stream);
        if (exif.HasValue) return (exif, SourceExif);

        var fromName = TryFilename(fileName);
        if (fromName.HasValue) return (fromName, SourceFilename);

        return (null, null);
    }

    public static DateTime? TryExif(Stream stream)
    {
        if (!stream.CanSeek) return null;
        var pos = stream.Position;
        try
        {
            stream.Position = 0;
            var directories = ImageMetadataReader.ReadMetadata(stream);

            var subIfd = directories.OfType<ExifSubIfdDirectory>().FirstOrDefault();
            if (subIfd != null)
            {
                if (subIfd.TryGetDateTime(ExifDirectoryBase.TagDateTimeOriginal, out var original)) return Normalize(original);
                if (subIfd.TryGetDateTime(ExifDirectoryBase.TagDateTimeDigitized, out var digitized)) return Normalize(digitized);
            }

            var ifd0 = directories.OfType<ExifIfd0Directory>().FirstOrDefault();
            if (ifd0 != null && ifd0.TryGetDateTime(ExifDirectoryBase.TagDateTime, out var modified)) return Normalize(modified);

            return null;
        }
        catch
        {
            // Not an image, or unreadable metadata – treat as "no EXIF".
            return null;
        }
        finally
        {
            stream.Position = pos;
        }
    }

    public static DateTime? TryFilename(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)) return null;
        var name = Path.GetFileNameWithoutExtension(fileName);

        var m = CompactWithTime.Match(name);
        if (!m.Success) m = DashedWithTime.Match(name);
        if (m.Success)
            return Build(m, withTime: true);

        m = CompactDateOnly.Match(name);
        if (!m.Success) m = DashedDateOnly.Match(name);
        if (m.Success)
            return Build(m, withTime: false);

        return null;
    }

    private static DateTime? Build(Match m, bool withTime)
    {
        try
        {
            int y = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            int mo = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
            int d = int.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture);
            int h = withTime ? int.Parse(m.Groups[4].Value, CultureInfo.InvariantCulture) : 0;
            int mi = withTime ? int.Parse(m.Groups[5].Value, CultureInfo.InvariantCulture) : 0;
            int s = withTime ? int.Parse(m.Groups[6].Value, CultureInfo.InvariantCulture) : 0;
            var dt = new DateTime(y, mo, d, h, mi, s, DateTimeKind.Unspecified);
            return IsPlausible(dt) ? dt : null;
        }
        catch
        {
            return null;
        }
    }

    private static DateTime? Normalize(DateTime dt)
    {
        // EXIF has no timezone; keep it as an unspecified local wall-clock time.
        var result = DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);
        return IsPlausible(result) ? result : null;
    }

    // Cameras with a dead battery report 2000-01-01 etc. – reject anything obviously wrong.
    private static bool IsPlausible(DateTime dt) =>
        dt.Year >= 2005 && dt <= DateTime.UtcNow.AddDays(2);
}
