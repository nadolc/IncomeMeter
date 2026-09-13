using FluentAssertions;
using IncomeMeter.Api.Services;
using Xunit;

namespace IncomeMeter.Api.Tests.Services;

public class ReceiptTextParserTests
{
    // OCR text as it comes back for a Sainsbury's forecourt receipt.
    private const string SainsburysReceipt = @"Sainsbury's
Good food for all of us
WST BFD MELTN RD LOC
0330 013 7803
Sainsbury's Supermarkets Ltd
33 Charterhouse Street London EC1M 6HA
www.sainsburys.co.uk
Vat Number : 660 4548 36
Fuelling start time: 20/03/2026 20:07
*UNLEADED PETROL          Pump #2
33.66 LTR @ £1.389        £46.75 C
1 BALANCE DUE             £46.75
Visa DEBIT                £46.75
contactless
[ICC] ************3547
AID:            A0000000031010
PAN SEQUENCE:   00
MERCHANT:       ****1180
AUTH CODE:      020724
TID:            ****8104
Cardholder Device Verified
CHANGE                    £0.00
VAT RECEIPT SUMMARY - FUEL ONLY
Rate    NET     VAT     TOTAL
C 20.00% 38.96  7.79    46.75
Vat Number: 660 4548 36
MY NECTAR SUMMARY
NEW POINTS BALANCE 632
YOUR POINTS ARE WORTH £3.16
PLEASE KEEP FOR YOUR RECORDS";

    // OCR text for the Kia "Accumulated info" trip screen.
    private const string KiaDashboard = @"EV
Accumulated info
402.3 mi
57.1 MPG
28:22 h
Hold OK : Reset
84299 mi
ECO
D 11°C
60 MPH 80 100 120 km/h";

    [Fact]
    public void Parses_uk_fuel_receipt()
    {
        var r = ReceiptTextParser.Parse(SainsburysReceipt)!;

        r.Kind.Should().Be("receipt");
        r.Date.Should().Be(new DateTime(2026, 3, 20, 20, 7, 0));
        r.Date!.Value.Kind.Should().Be(DateTimeKind.Unspecified);
        r.Litres.Should().Be(33.66);
        r.PricePerLitre.Should().Be(1.389m);
        r.Total.Should().Be(46.75m);
        r.FuelType.Should().Be("unleaded");
        r.OdometerMiles.Should().BeNull();
        r.Confidence.Should().BeGreaterThan(0.5f);
    }

    [Fact]
    public void Parses_dashboard_trip_screen()
    {
        var r = ReceiptTextParser.Parse(KiaDashboard)!;

        r.Kind.Should().Be("dashboard");
        r.OdometerMiles.Should().Be(84299);
        r.TripMiles.Should().Be(402.3);
        r.Mpg.Should().Be(57.1);
        r.Date.Should().BeNull();
        r.Total.Should().BeNull();
    }

    [Fact]
    public void Receipt_date_prefers_the_line_with_a_time_over_bare_dates()
    {
        var text = "Card expiry 01/01/2028\nDate 05/03/2026 09:15\nTotal £10.00";

        ReceiptTextParser.Parse(text)!.Date.Should().Be(new DateTime(2026, 3, 5, 9, 15, 0));
    }

    [Fact]
    public void Reads_day_first_dates_not_month_first()
    {
        // 03/05/2026 must be 3 May, not 5 March.
        ReceiptTextParser.Parse("TOTAL 12.00\n03/05/2026 10:00")!.Date.Should().Be(new DateTime(2026, 5, 3, 10, 0, 0));
    }

    [Theory]
    [InlineData("DIESEL 40.00 LTR @ 145.9p  TOTAL 58.36", "diesel", 40.00, 1.459, 58.36)]
    [InlineData("SUPER UNLEADED\nLitres 25.10\n@ £1.599\nBALANCE DUE £40.13", "premiumUnleaded", 25.10, 1.599, 40.13)]
    public void Parses_other_forecourt_layouts(string text, string fuel, double litres, double ppl, double total)
    {
        var r = ReceiptTextParser.Parse(text)!;

        r.FuelType.Should().Be(fuel);
        r.Litres.Should().Be(litres);
        r.PricePerLitre.Should().Be((decimal)ppl);
        r.Total.Should().Be((decimal)total);
    }

    [Fact]
    public void Computes_total_from_litres_and_price_when_no_total_line()
    {
        var r = ReceiptTextParser.Parse("UNLEADED 30.00 LTR @ £1.400")!;

        r.Total.Should().Be(42.00m);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Hello world, nothing to see here")]
    public void Returns_null_for_unrecognised_text(string text)
    {
        ReceiptTextParser.Parse(text).Should().BeNull();
    }
}
