import { Vehicle } from './types';

const dayOf = (iso: string) => iso.slice(0, 10);

/**
 * Which vehicle was in use on `date`. Port of VehicleAssignment.PickForDate:
 * 1. Candidates: purchase unset or on/before the day, disposal unset or on/after the day.
 * 2. A candidate with a disposal date wins over open-ended ones (hand-over day keeps the old car).
 * 3. Otherwise the most recently purchased candidate.
 * 4. No candidates: the single active vehicle, else null.
 */
export function pickVehicleForDate(vehicles: Vehicle[], date: Date | string): string | null {
  if (vehicles.length === 0) return null;
  const day = typeof date === 'string' ? dayOf(date) : dayOf(date.toISOString());
  const byPurchaseDesc = (a: Vehicle, b: Vehicle) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? '');

  const candidates = vehicles.filter(
    (v) => (!v.purchaseDate || dayOf(v.purchaseDate) <= day) && (!v.disposalDate || dayOf(v.disposalDate) >= day));

  if (candidates.length > 0) {
    const bounded = candidates.filter((v) => v.disposalDate).sort(byPurchaseDesc);
    if (bounded.length > 0) return bounded[0].id;
    return [...candidates].sort(byPurchaseDesc)[0].id;
  }

  const active = vehicles.filter((v) => v.isActive);
  return active.length === 1 ? active[0].id : null;
}
