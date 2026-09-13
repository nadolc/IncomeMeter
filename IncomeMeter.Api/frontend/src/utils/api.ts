import axios from 'axios';
import type { DashboardStats, RegisterFormData, Route, User, UserSettings, WorkTypeConfig, CreateWorkTypeConfigRequest, UpdateWorkTypeConfigRequest, ConfigurationResponse, WorkTypeConfigResponseDto, ApiEndpoints, PeriodIncomeData, AttachmentUploadResult, Expense, OdometerReading, BatchImportItem, BatchImportResult, Vehicle, VehicleInput, TaxYearReport, VehicleLookupResult, BackfillVehicleOptions, BackfillVehicleResult } from "../types";

// Get API URL from backend config endpoint
/*const _getApiUrl = async (): Promise<string> => {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    return config.ApiBaseUrl || window.location.origin;
  } catch {
    return import.meta.env.DEV ? 'https://localhost:7079' : window.location.origin;
  }
};*/

// Build-time URL validation
const validateApiUrl = (url: string): void => {
  if (!import.meta.env.DEV) {
    if (url.includes('localhost')) {
      console.error('❌ PRODUCTION BUILD ERROR: API URL contains localhost!');
      console.error('Set VITE_API_BASE_URL environment variable for production');
      console.error('Current URL:', url);
    }
    if (!url.startsWith('https://')) {
      console.warn('⚠️  WARNING: Production API URL should use HTTPS');
    }
  }
};

// For development: point to .NET API server
// For production: use VITE_API_BASE_URL or fallback to current domain
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.DEV ? 'https://localhost:7079' : window.location.origin
);

// Validate the URL at module load time
validateApiUrl(API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  console.log('API Request:', config.method?.toUpperCase(), config.url);
  console.log('Token present:', !!token);
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('No access token found in localStorage');
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config?.url);
    return response;
  },
  (error) => {
    console.error('API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      data: error.response?.data
    });
    
    if (error.response?.status === 401) {
      console.warn('Unauthorized - removing token and redirecting to login');
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const getProfile = async (): Promise<User> => {
  const response = await api.get<User>('/api/auth/profile');
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/api/auth/logout');
};

export const register = async (data: RegisterFormData): Promise<User> => {
  const response = await api.post<User>('/api/users', data);
  return response.data;
};

export const registerWithGoogle = async (googleId: string, email: string, displayName: string): Promise<{ success: boolean; token?: string; user?: User; message: string }> => {
  const response = await api.post('/api/auth/register', {
    googleId,
    email,
    displayName
  });
  return response.data;
};

// Dashboard endpoints
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await api.get<DashboardStats>('/api/dashboard/stats');
  return response.data;
};

export const getTodaysRoutes = async (): Promise<Route[]> => {
  const response = await api.get<Route[]>('/api/dashboard/todays-routes');
  
  // Ensure response.data is an array
  const routes = Array.isArray(response.data) ? response.data : [];
  
  // Convert date strings to Date objects
  return routes.map(route => ({
    ...route,
    scheduleStart: new Date(route.scheduleStart),
    scheduleEnd: new Date(route.scheduleEnd),
    actualStartTime: route.actualStartTime ? new Date(route.actualStartTime) : undefined,
    actualEndTime: route.actualEndTime ? new Date(route.actualEndTime) : undefined,
  }));
};

export const getPeriodStats = async (
  period: 'weekly' | 'monthly' | 'annual',
  offset: number = 0,
  fiscalStartDate?: string
): Promise<PeriodIncomeData> => {
  const response = await api.post<PeriodIncomeData>('/api/dashboard/period-stats', {
    period,
    offset,
    fiscalStartDate
  });
  
  return {
    ...response.data,
    chartData: response.data.chartData.map((item: any) => ({
      ...item,
      date: new Date(item.date).toISOString()
    }))
  };
};

// Settings endpoints
export const getUserSettings = async (): Promise<UserSettings> => {
  const response = await api.get<UserSettings>('/api/users/settings');
  return response.data;
};

export const updateUserSettings = async (settings: Partial<UserSettings>): Promise<UserSettings> => {
  const response = await api.put<UserSettings>('/api/users/settings', settings);
  return response.data;
};

// Route endpoints
export const getRoutes = async (): Promise<Route[]> => {
  const response = await api.get<Route[]>('/api/routes');
  return response.data;
};

export const getRouteById = async (routeId: string): Promise<Route> => {
  const response = await api.get<Route>(`/api/routes/${routeId}`);
  return response.data;
};

export const getRoutesByStatus = async (status: string): Promise<Route[]> => {
  const response = await api.get<Route[]>(`/api/routes/status/${status}`);
  return response.data;
};

export const getRoutesByDateRange = async (startDate: string, endDate: string): Promise<Route[]> => {
  const response = await api.get<Route[]>(`/api/routes/date-range?startDate=${startDate}&endDate=${endDate}`);
  return response.data;
};

export const createRoute = async (routeData: Partial<Route>): Promise<Route> => {
  const response = await api.post<Route>('/api/routes', routeData);
  return response.data;
};

export const createBulkRoutes = async (routesData: Array<{
  workType: string;
  scheduleStart: Date;
  scheduleEnd: Date;
  actualStartTime: Date;
  actualEndTime: Date;
  startMile: number;
  endMile: number;
  incomes: Array<{ source: string; amount: number }>;
}>): Promise<Route[]> => {
  const response = await api.post<Route[]>('/api/routes/bulk', routesData);
  return response.data;
};

export const updateRoute = async (routeId: string, routeData: Partial<Route>): Promise<Route> => {
  const response = await api.put<Route>(`/api/routes/${routeId}`, routeData);
  return response.data;
};

export const deleteRoute = async (routeId: string): Promise<void> => {
  await api.delete(`/api/routes/${routeId}`);
};

export const startRoute = async (routeData: { workType: string; startMile: number; estimatedIncome?: number }): Promise<Route> => {
  const response = await api.post<Route>('/api/routes/start', routeData);
  return response.data;
};

export const endRoute = async (routeData: { id: string; endMile: number; incomes: Array<{ source: string; amount: number }> }): Promise<Route> => {
  const response = await api.post<Route>('/api/routes/end', routeData);
  return response.data;
};

// Location endpoints
export const getLocationsByRouteId = async (routeId: string) => {
  const response = await api.get(`/api/locations?routeId=${routeId}`);
  return response.data;
};

export const getLocationById = async (locationId: string) => {
  const response = await api.get(`/api/locations/${locationId}`);
  return response.data;
};

export const createLocation = async (locationData: {
  routeId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
}) => {
  const response = await api.post('/api/locations', locationData);
  return response.data;
};

export const updateLocation = async (locationId: string, locationData: {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  accuracy?: number;
  speed?: number;
  address?: string;
}) => {
  const response = await api.put(`/api/locations/${locationId}`, locationData);
  return response.data;
};

export const deleteLocation = async (locationId: string): Promise<void> => {
  await api.delete(`/api/locations/${locationId}`);
};

export const deleteLocationsByRouteId = async (routeId: string): Promise<void> => {
  await api.delete(`/api/locations/route/${routeId}`);
};

// Work Type Configuration endpoints
export const getWorkTypeConfigs = async (): Promise<WorkTypeConfig[]> => {
  const response = await api.get<WorkTypeConfig[]>('/api/work-type-configs');
  return response.data;
};

export const getActiveWorkTypeConfigs = async (): Promise<WorkTypeConfig[]> => {
  const response = await api.get<WorkTypeConfig[]>('/api/work-type-configs/active');
  return response.data;
};

export const getWorkTypeConfigById = async (id: string): Promise<WorkTypeConfig> => {
  const response = await api.get<WorkTypeConfig>(`/api/work-type-configs/${id}`);
  return response.data;
};

export const createWorkTypeConfig = async (data: CreateWorkTypeConfigRequest): Promise<WorkTypeConfig> => {
  const response = await api.post<WorkTypeConfig>('/api/work-type-configs', data);
  return response.data;
};

export const updateWorkTypeConfig = async (id: string, data: UpdateWorkTypeConfigRequest): Promise<WorkTypeConfig> => {
  const response = await api.put<WorkTypeConfig>(`/api/work-type-configs/${id}`, data);
  return response.data;
};

export const deleteWorkTypeConfig = async (id: string): Promise<void> => {
  await api.delete(`/api/work-type-configs/${id}`);
};

// API Key endpoints
export const generateApiKey = async (description: string): Promise<{ apiKey: string; apiKeyDetails: Record<string, unknown> }> => {
  const response = await api.post('/api/users/me/apikeys', { description });
  return response.data;
};

// Configuration API (using API key authentication)
export const getConfigurationWithApiKey = async (apiKey: string): Promise<ConfigurationResponse> => {
  const response = await axios.get(`${API_BASE_URL}/api/configuration`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

export const getWorkTypesWithApiKey = async (apiKey: string): Promise<{ workTypes: WorkTypeConfigResponseDto[] }> => {
  const response = await axios.get(`${API_BASE_URL}/api/configuration/work-types`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

export const getApiEndpointsWithApiKey = async (apiKey: string): Promise<ApiEndpoints> => {
  const response = await axios.get(`${API_BASE_URL}/api/configuration/endpoints`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

// JWT Token Management endpoints
export const getAvailableScopes = async () => {
  const response = await api.get('/api/tokens/scopes');
  return response.data;
};

export const getUserTokens = async () => {
  const response = await api.get('/api/tokens');
  return response.data;
};

export const generateJwtToken = async (request: {
  description: string;
  scopes: string[];
  expiryDays?: number;
  generateRefreshToken?: boolean;
}) => {
  const response = await api.post('/api/tokens/generate', request);
  return response.data;
};

export const revokeJwtToken = async (tokenId: string) => {
  const response = await api.post('/api/tokens/revoke', { tokenId });
  return response.data;
};
// ---------- Attachments (receipt / odometer photos) ----------

/**
 * Upload many photos in one multipart request. The server reads EXIF / filename dates
 * and de-duplicates by content hash; results come back in the same order as `files`.
 */
/** Photos per HTTP request. Keeps each request well under proxy/IIS body limits and lets OCR run per chunk. */
const UPLOAD_CHUNK_SIZE = 4;
const UPLOAD_CHUNK_MAX_BYTES = 20 * 1024 * 1024;

export const uploadAttachmentsBatch = async (
  files: File[],
  onProgress?: (percent: number) => void
): Promise<AttachmentUploadResult[]> => {
  // Split into chunks by count and by total size.
  const chunks: File[][] = [];
  let current: File[] = [];
  let currentBytes = 0;
  for (const f of files) {
    if (current.length > 0 && (current.length >= UPLOAD_CHUNK_SIZE || currentBytes + f.size > UPLOAD_CHUNK_MAX_BYTES)) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(f);
    currentBytes += f.size;
  }
  if (current.length > 0) chunks.push(current);

  const totalBytes = files.reduce((s, f) => s + f.size, 0) || 1;
  let doneBytes = 0;
  const results: AttachmentUploadResult[] = [];

  for (const chunk of chunks) {
    const chunkBytes = chunk.reduce((s, f) => s + f.size, 0);
    const form = new FormData();
    chunk.forEach(f => form.append('files', f, f.name));
    try {
      const response = await api.post<AttachmentUploadResult[]>('/api/attachments/batch', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000,
        onUploadProgress: evt => {
          if (onProgress && evt.total) {
            const loaded = Math.min(evt.loaded, chunkBytes);
            onProgress(Math.min(99, Math.round(((doneBytes + loaded) * 100) / totalBytes)));
          }
        },
      });
      results.push(...response.data);
    } catch (err: unknown) {
      // One failed chunk must not lose the others: report each file in it as failed and carry on.
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message = status === 413
        ? 'Request too large (413) – the server rejected this chunk'
        : status
          ? `Upload failed (HTTP ${status})`
          : 'Upload failed (network error or timeout)';
      chunk.forEach(f => results.push({
        attachmentId: null, fileName: f.name, contentType: f.type, sizeBytes: f.size, sha256: null,
        takenAt: null, dateSource: null, isDuplicate: false, error: message, ocr: null
      }));
    }
    doneBytes += chunkBytes;
    onProgress?.(Math.min(99, Math.round((doneBytes * 100) / totalBytes)));
  }
  onProgress?.(100);
  return results;
};

/** Fetch a private attachment with the bearer token and return an object URL usable in <img src>. */
export const fetchAttachmentObjectUrl = async (attachmentId: string): Promise<string> => {
  const response = await api.get(`/api/attachments/${attachmentId}/content`, { responseType: 'blob' });
  return URL.createObjectURL(response.data as Blob);
};

export const deleteAttachment = async (attachmentId: string): Promise<void> => {
  await api.delete(`/api/attachments/${attachmentId}`);
};

// ---------- Expenses ----------

export const getExpenses = async (params?: { from?: string; to?: string; category?: string }): Promise<Expense[]> => {
  const response = await api.get<Expense[]>('/api/expenses', { params });
  return response.data;
};

export const createExpensesBatch = async (items: BatchImportItem[]): Promise<BatchImportResult> => {
  const response = await api.post<BatchImportResult>('/api/expenses/batch', { items });
  return response.data;
};

export const updateExpense = async (id: string, data: Partial<Expense>): Promise<Expense> => {
  const response = await api.put<Expense>(`/api/expenses/${id}`, data);
  return response.data;
};

export const deleteExpense = async (id: string): Promise<void> => {
  await api.delete(`/api/expenses/${id}`);
};

export const getOdometerReadings = async (params?: { from?: string; to?: string }): Promise<OdometerReading[]> => {
  const response = await api.get<OdometerReading[]>('/api/expenses/odometer', { params });
  return response.data;
};

export const deleteOdometerReading = async (id: string): Promise<void> => {
  await api.delete(`/api/expenses/odometer/${id}`);
};

// ---------- Vehicles ----------

export const getVehicles = async (includeInactive = false): Promise<Vehicle[]> => {
  const response = await api.get<Vehicle[]>('/api/vehicles', { params: { includeInactive } });
  return response.data;
};

export const createVehicle = async (data: VehicleInput): Promise<Vehicle> => {
  const response = await api.post<Vehicle>('/api/vehicles', data);
  return response.data;
};

export const updateVehicle = async (id: string, data: Partial<VehicleInput>): Promise<Vehicle> => {
  const response = await api.put<Vehicle>(`/api/vehicles/${id}`, data);
  return response.data;
};

export const deleteVehicle = async (id: string): Promise<void> => {
  await api.delete(`/api/vehicles/${id}`);
};

/** Attach a vehicle to existing routes / expenses / odometer readings (default: only unassigned ones, from the purchase date). */
export const backfillVehicle = async (id: string, options: BackfillVehicleOptions = {}): Promise<BackfillVehicleResult> => {
  const response = await api.post<BackfillVehicleResult>(`/api/vehicles/${id}/backfill`, options);
  return response.data;
};

/** DVLA number-plate lookup (make, fuel, CO2, MOT/tax). Requires Dvla:ApiKey on the server. */
export const lookupVehicle = async (registration: string): Promise<VehicleLookupResult> => {
  const response = await api.get<VehicleLookupResult>(`/api/vehicles/lookup/${encodeURIComponent(registration.replace(/\s+/g, ''))}`);
  return response.data;
};

// ---------- Tax year report ----------

export interface TaxReportParams {
  vehicleId?: string;
  businessUsePercent?: number;
}

export const getTaxYearReport = async (taxYear: number, params?: TaxReportParams): Promise<TaxYearReport> => {
  const response = await api.get<TaxYearReport>(`/api/tax-report/${taxYear}`, { params });
  return response.data;
};

/** Download a file that needs the bearer token, then hand it to the browser as a normal download. */
const downloadWithAuth = async (url: string, params: object | undefined, fallbackName: string) => {
  const response = await api.get(url, { params, responseType: 'blob' });
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^";]+)"?/);
  const name = match?.[1] ?? fallbackName;
  const objectUrl = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
};

export const downloadTaxYearReportCsv = (taxYear: number, params?: TaxReportParams) =>
  downloadWithAuth(`/api/tax-report/${taxYear}/csv`, params, `tax-year-${taxYear}-report.csv`);

export const downloadTaxYearReceiptsZip = (taxYear: number, params?: { vehicleId?: string }) =>
  downloadWithAuth(`/api/tax-report/${taxYear}/receipts.zip`, params, `tax-year-${taxYear}-receipts.zip`);
