import React, { useEffect, useState } from 'react';
import type { Vehicle } from '../../types';
import { loadVehicles, peekVehicle } from '../../utils/vehicleCache';

interface VehiclePlateProps {
  vehicleId?: string | null;
  /** "badge" (default) renders a number-plate style chip; "text" renders plain text. */
  variant?: 'badge' | 'text';
  className?: string;
}

/** Shows the registration plate for a vehicle id, or nothing when unassigned / unknown. */
const VehiclePlate: React.FC<VehiclePlateProps> = ({ vehicleId, variant = 'badge', className = '' }) => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(() => (vehicleId ? peekVehicle(vehicleId) : null));

  useEffect(() => {
    if (!vehicleId) {
      setVehicle(null);
      return;
    }
    let cancelled = false;
    loadVehicles().then(map => {
      if (!cancelled) setVehicle(map.get(vehicleId) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (!vehicle) return null;

  const title = [vehicle.make, vehicle.model].filter(Boolean).join(' ');

  if (variant === 'text') {
    return (
      <span className={className} title={title}>
        {vehicle.registration}{title ? ` · ${title}` : ''}
      </span>
    );
  }

  return (
    <span
      title={title || vehicle.registration}
      className={`inline-flex items-center rounded border border-gray-400 bg-yellow-300 px-1.5 py-0 font-mono text-[11px] font-bold tracking-wider text-gray-900 ${className}`}
    >
      {vehicle.registration}
    </span>
  );
};

export default VehiclePlate;
