import { averageHourly } from '../domain/metrics';
import { useCollection, useSettings } from './hooks';

/** Target hourly for judging offers: the one set in Settings, else the rider's own 4-week average. */
export function useTargetHourly(): { target: number | null; auto: boolean } {
  const settings = useSettings();
  const routes = useCollection('routes');
  if (settings.targetHourly != null && settings.targetHourly > 0) return { target: settings.targetHourly, auto: false };
  const avg = averageHourly(routes);
  return { target: avg != null ? Math.round(avg) : null, auto: true };
}
