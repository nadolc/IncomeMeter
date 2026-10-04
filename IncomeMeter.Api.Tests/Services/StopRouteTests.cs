using FluentAssertions;
using IncomeMeter.Api.Services;
using Xunit;

namespace IncomeMeter.Api.Tests.Services;

/// <summary>
/// Which route a stop from the iOS shortcut lands on. The old CarPlay shortcut sends the id of the last
/// route its own start step created; those routes were often never ended and stay "in progress" on the
/// server. Honouring that id filed stops on a stale route, where they synced to the phone but never
/// showed on the route being driven.
/// </summary>
public class StopRouteTests
{
    private const string Stale = "64a1b2c3d4e5f60718293a4b";
    private const string Current = "66f0e1d2c3b4a59687706f1e";

    [Fact]
    public void A_stale_route_id_from_the_shortcut_gives_way_to_the_route_being_driven()
    {
        LocationService.RouteForStop(Stale, Current).Should().Be(Current);
    }

    [Fact]
    public void No_route_id_uses_the_route_being_driven()
    {
        LocationService.RouteForStop(null, Current).Should().Be(Current);
        LocationService.RouteForStop("  ", Current).Should().Be(Current);
    }

    [Fact]
    public void With_nothing_in_progress_a_given_route_id_is_used_as_sent()
    {
        LocationService.RouteForStop(Stale, null).Should().Be(Stale);
    }

    [Fact]
    public void With_nothing_in_progress_and_no_route_id_there_is_nowhere_to_put_the_stop()
    {
        LocationService.RouteForStop(null, null).Should().BeNull();
    }
}
