import { getVehicles } from './api';
import type { Vehicle } from '../types';

// One shared vehicle fetch per session; VehiclePlate and friends read from it.
let cache: Map<string, Vehicle> | null = null;
let pending: Promise<Map<string, Vehicle>> | null = null;

export const loadVehicles = (): Promise<Map<string, Vehicle>> => {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = getVehicles(true)
      .then(list => {
        cache = new Map(list.map(v => [v.id, v]));
        return cache;
      })
      .catch(() => {
        pending = null;
        return new Map<string, Vehicle>();
      });
  }
  return pending;
};

export const peekVehicle = (id: string): Vehicle | null => cache?.get(id) ?? null;

/** Call after creating/editing vehicles so plates refresh. */
export const invalidateVehicleCache = () => {
  cache = null;
  pending = null;
};
