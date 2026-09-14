using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

/// <summary>
/// Decides which of the user's vehicles was in use on a given date, from each vehicle's
/// purchase date and (optional) disposal date.
/// </summary>
public static class VehicleAssignment
{
    /// <summary>
    /// Rules, in order:
    /// 1. A vehicle is a candidate when PurchaseDate is unset or on/before the date, and DisposalDate is unset or on/after the date.
    /// 2. Among candidates, one with a disposal date (a bounded window that contains the date) wins over open-ended ones –
    ///    so on the hand-over day the old car is still "in use" until its disposal date has passed.
    /// 3. Otherwise the most recently purchased candidate wins.
    /// 4. No candidates: the single active vehicle if there is exactly one, else null.
    /// </summary>
    public static string? PickForDate(IReadOnlyCollection<Vehicle> vehicles, DateTime date)
    {
        if (vehicles.Count == 0) return null;
        var day = date.Date;

        var candidates = vehicles
            .Where(v => (!v.PurchaseDate.HasValue || v.PurchaseDate.Value.Date <= day)
                        && (!v.DisposalDate.HasValue || v.DisposalDate.Value.Date >= day))
            .ToList();

        if (candidates.Count > 0)
        {
            var bounded = candidates.Where(v => v.DisposalDate.HasValue).OrderByDescending(v => v.PurchaseDate ?? DateTime.MinValue).ToList();
            if (bounded.Count > 0) return bounded[0].Id;
            return candidates.OrderByDescending(v => v.PurchaseDate ?? DateTime.MinValue).First().Id;
        }

        var active = vehicles.Where(v => v.IsActive).ToList();
        return active.Count == 1 ? active[0].Id : null;
    }
}
