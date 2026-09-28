import { requireOptionalNativeModule } from 'expo';

/** Native module in ./ios – iOS builds only (null on Android and in Expo Go). */
export interface RouteLiveActivityNative {
  isEnabled(): boolean;
  count(): number;
  start(routeId: string, url: string | null, state: string): Promise<string>;
  update(state: string): Promise<void>;
  end(state: string, dismissAfterSeconds: number): Promise<void>;
}

export default requireOptionalNativeModule<RouteLiveActivityNative>('RouteLiveActivity');
