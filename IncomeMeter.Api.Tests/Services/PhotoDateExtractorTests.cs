using FluentAssertions;
using IncomeMeter.Api.Services;
using Xunit;

namespace IncomeMeter.Api.Tests.Services;

public class PhotoDateExtractorTests
{
    [Theory]
    [InlineData("IMG_20250814_183212.jpg", 2025, 8, 14, 18, 32, 12)]          // Android camera
    [InlineData("PXL_20250814_183212123.jpg", 2025, 8, 14, 18, 32, 12)]       // Pixel camera (ms suffix)
    [InlineData("20250814_183212.jpg", 2025, 8, 14, 18, 32, 12)]              // Samsung
    [InlineData("Screenshot_2025-08-14-18-32-12.png", 2025, 8, 14, 18, 32, 12)] // Android screenshot
    [InlineData("2025-08-14 18.32.12.jpg", 2025, 8, 14, 18, 32, 12)]          // iOS export
    [InlineData("VID_20250814_183212.mp4", 2025, 8, 14, 18, 32, 12)]
    [InlineData("IMG_20250814.jpg", 2025, 8, 14, 0, 0, 0)]                    // date only
    [InlineData("receipt 2025-08-14.jpg", 2025, 8, 14, 0, 0, 0)]
    public void TryFilename_parses_common_camera_patterns(string fileName, int y, int mo, int d, int h, int mi, int s)
    {
        var result = PhotoDateExtractor.TryFilename(fileName);

        result.Should().Be(new DateTime(y, mo, d, h, mi, s));
        result!.Value.Kind.Should().Be(DateTimeKind.Unspecified);
    }

    [Theory]
    [InlineData("IMG_1234.jpg")]                 // iPhone default – no date
    [InlineData("WhatsApp Image.jpeg")]
    [InlineData("receipt.jpg")]
    [InlineData("IMG_20251340_183212.jpg")]      // month 13 – not a date
    [InlineData("IMG_19990814_183212.jpg")]      // implausibly old
    [InlineData("")]
    public void TryFilename_returns_null_when_no_plausible_date(string fileName)
    {
        PhotoDateExtractor.TryFilename(fileName).Should().BeNull();
    }

    [Fact]
    public void TryExif_returns_null_for_non_image_stream_and_restores_position()
    {
        using var stream = new MemoryStream(new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 });
        stream.Position = 3;

        var result = PhotoDateExtractor.TryExif(stream);

        result.Should().BeNull();
        stream.Position.Should().Be(3);
    }

    [Fact]
    public void Extract_falls_back_to_filename_when_stream_has_no_exif()
    {
        using var stream = new MemoryStream(new byte[] { 0xFF, 0xD8, 0xFF, 0xD9 }); // minimal JPEG SOI/EOI, no EXIF

        var (takenAt, source) = PhotoDateExtractor.Extract(stream, "IMG_20250814_183212.jpg");

        takenAt.Should().Be(new DateTime(2025, 8, 14, 18, 32, 12));
        source.Should().Be(PhotoDateExtractor.SourceFilename);
    }

    [Fact]
    public void Extract_returns_nulls_when_nothing_is_available()
    {
        using var stream = new MemoryStream(new byte[] { 0xFF, 0xD8, 0xFF, 0xD9 });

        var (takenAt, source) = PhotoDateExtractor.Extract(stream, "IMG_1234.jpg");

        takenAt.Should().BeNull();
        source.Should().BeNull();
    }
}
