using FluentAssertions;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Xunit;

namespace IncomeMeter.Api.Tests.Services;

public class VehicleAssignmentTests
{
    private static readonly Vehicle Subaru = new()
    {
        Id = "subaru", Registration = "SUBARU", UserId = "u",
        PurchaseDate = new DateTime(2022, 1, 1), DisposalDate = new DateTime(2025, 5, 27), IsActive = false
    };
    private static readonly Vehicle Kia = new()
    {
        Id = "kia", Registration = "KIA", UserId = "u",
        PurchaseDate = new DateTime(2025, 5, 27), IsActive = true
    };
    private static readonly Vehicle[] Fleet = { Kia, Subaru };

    [Theory]
    [InlineData(2024, 12, 22, "subaru")]
    [InlineData(2025, 5, 26, "subaru")]
    [InlineData(2025, 5, 27, "subaru")]   // hand-over day: old car until its disposal date has passed
    [InlineData(2025, 5, 28, "kia")]
    [InlineData(2025, 7, 17, "kia")]
    public void Picks_the_vehicle_in_use_on_the_date(int y, int m, int d, string expected)
    {
        VehicleAssignment.PickForDate(Fleet, new DateTime(y, m, d, 9, 0, 0)).Should().Be(expected);
    }

    [Fact]
    public void Date_before_any_purchase_falls_back_to_the_single_active_vehicle()
    {
        VehicleAssignment.PickForDate(Fleet, new DateTime(2020, 1, 1)).Should().Be("kia");
    }

    [Fact]
    public void Date_before_any_purchase_with_two_active_vehicles_is_unassigned()
    {
        var a = new Vehicle { Id = "a", Registration = "A", UserId = "u", PurchaseDate = new DateTime(2025, 1, 1), IsActive = true };
        var b = new Vehicle { Id = "b", Registration = "B", UserId = "u", PurchaseDate = new DateTime(2025, 6, 1), IsActive = true };

        VehicleAssignment.PickForDate(new[] { a, b }, new DateTime(2024, 1, 1)).Should().BeNull();
        VehicleAssignment.PickForDate(new[] { a, b }, new DateTime(2025, 3, 1)).Should().Be("a");
        VehicleAssignment.PickForDate(new[] { a, b }, new DateTime(2025, 7, 1)).Should().Be("b");   // newest purchase wins
    }

    [Fact]
    public void Vehicle_without_purchase_date_is_always_a_candidate()
    {
        var only = new Vehicle { Id = "x", Registration = "X", UserId = "u", IsActive = true };
        VehicleAssignment.PickForDate(new[] { only }, new DateTime(2019, 1, 1)).Should().Be("x");
    }

    [Fact]
    public void No_vehicles_gives_null()
    {
        VehicleAssignment.PickForDate(Array.Empty<Vehicle>(), DateTime.UtcNow).Should().BeNull();
    }
}
