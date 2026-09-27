import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { getSettings, saveSettings } from '../db/repo';
import { AttachmentOcr } from '../domain/types';

/**
 * Talks to IncomeMeter.Api on Azure. Signing in uses the existing Google OAuth flow in the system
 * browser; the short-lived session JWT is immediately swapped for a long-lived API token with a refresh
 * token (POST /api/tokens/generate), which is what the app keeps.
 */
const ACCESS = 'im.accessToken';
const REFRESH = 'im.refreshToken';
export const APP_RETURN_URL = 'incomemeter://auth';

const SCOPES = [
  'read:routes', 'write:routes', 'delete:routes', 'read:locations', 'write:locations', 'delete:locations',
  'read:dashboard', 'read:configuration', 'read:users',
];

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const base = () => getSettings().apiBaseUrl.replace(/\/+$/, '');

export async function isSignedIn(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(ACCESS)) && !!base();
}

async function storeTokens(access: string, refresh?: string | null) {
  await SecureStore.setItemAsync(ACCESS, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH, refresh);
}

export async function signOut() {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
  saveSettings({ syncEnabled: false, userEmail: null, lastSyncAt: null });
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error ?? body.message ?? body.title ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH);
  if (!refreshToken) return false;
  const res = await fetch(`${base()}/api/tokens/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const body = await res.json();
  await storeTokens(body.accessToken, body.refreshToken);
  return true;
}

/** Authenticated fetch with one automatic token refresh on 401. */
export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!base()) throw new ApiError(0, 'Server address is not set');
  const token = await SecureStore.getItemAsync(ACCESS);
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && retry && (await refreshTokens())) return api<T>(path, init, false);
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Google sign-in via the web app's OAuth endpoint, then mint a long-lived device token. */
export async function signInWithGoogle(): Promise<string> {
  const url = `${base()}/api/auth/login?returnUrl=${encodeURIComponent(APP_RETURN_URL)}`;
  const result = await WebBrowser.openAuthSessionAsync(url, APP_RETURN_URL);
  if (result.type !== 'success') throw new ApiError(0, 'Sign-in was cancelled');
  const sessionToken = new URL(result.url).searchParams.get('token');
  if (!sessionToken) throw new ApiError(0, 'Sign-in did not return a token. Register on the web app first, then try again.');
  return adoptSessionToken(sessionToken);
}

/** Exchange a session JWT (or accept a pasted API token) for the stored device token. */
export async function adoptSessionToken(sessionToken: string): Promise<string> {
  await storeTokens(sessionToken);
  try {
    const minted = await api<{ accessToken: string; refreshToken?: string }>('/api/tokens/generate', {
      method: 'POST',
      body: JSON.stringify({ description: 'IncomeMeter mobile app', scopes: SCOPES, expiryDays: 365, generateRefreshToken: true }),
    }, false);
    await storeTokens(minted.accessToken, minted.refreshToken);
  } catch {
    // A pasted API token can't mint another one – keep using it as is.
  }
  const profile = await api<{ email?: string; user?: { email?: string } }>('/api/auth/profile').catch(() => null);
  const email = profile?.email ?? profile?.user?.email ?? null;
  saveSettings({ syncEnabled: true, userEmail: email });
  return email ?? '';
}

// ---------- online-only helpers ----------

export interface UploadResult {
  attachmentId: string | null;
  isDuplicate: boolean;
  takenAt: string | null;
  error: string | null;
  ocr: AttachmentOcr | null;
}

/** Upload a photo (POST /api/attachments/batch). The server stores it, de-duplicates by hash and runs OCR. */
export async function uploadAttachment(localUri: string, fileName: string, contentType: string): Promise<UploadResult> {
  const form = new FormData();
  // React Native's multipart file part: the networking layer streams the file from `uri`.
  form.append('files', { uri: localUri, name: fileName, type: contentType } as unknown as Blob);
  const results = await api<UploadResult[]>('/api/attachments/batch', { method: 'POST', body: form });
  const r = results[0];
  if (!r || r.error || !r.attachmentId) throw new ApiError(400, r?.error ?? 'Upload failed');
  return r;
}

export interface VehicleLookup {
  registration: string; make?: string; model?: string; colour?: string; fuelType?: string; co2GPerKm?: number;
  vehicleType?: string; firstUsedDate?: string; motTests?: { completedDate?: string; odometerValue?: number; odometerUnit?: string }[];
  warnings?: string[];
}

export const lookupVehicle = (registration: string) =>
  api<VehicleLookup>(`/api/vehicles/lookup/${encodeURIComponent(registration.replace(/\s+/g, ''))}`);

export const fetchRouteLocations = (routeId: string) =>
  api<{ id: string; routeId: string; latitude: number; longitude: number; timestamp: string; accuracy?: number; speed?: number; address?: string; distanceFromLastKm?: number; distanceFromLastMi?: number }[]>(
    `/api/locations?routeId=${routeId}`);
