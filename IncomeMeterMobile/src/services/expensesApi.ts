import { apiClient } from './dashboardApi';
import type { Asset } from 'react-native-image-picker';

export type ExpenseCategory =
  | 'fuel' | 'insurance' | 'servicing' | 'repairs' | 'mot' | 'roadTax' | 'breakdown'
  | 'parking' | 'tolls' | 'cleaning' | 'financeInterest' | 'vehiclePurchase' | 'other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'fuel', 'insurance', 'servicing', 'repairs', 'mot', 'roadTax', 'breakdown',
  'parking', 'tolls', 'cleaning', 'financeInterest', 'vehiclePurchase', 'other',
];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: 'Fuel', insurance: 'Insurance', servicing: 'Servicing', repairs: 'Repairs', mot: 'MOT',
  roadTax: 'Road tax', breakdown: 'Breakdown cover', parking: 'Parking', tolls: 'Tolls',
  cleaning: 'Cleaning', financeInterest: 'Finance interest', vehiclePurchase: 'Vehicle purchase', other: 'Other',
};

export type DateSource = 'exif' | 'filename' | 'ocr' | 'manual';

export interface AttachmentUploadResult {
  attachmentId: string | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  sha256: string | null;
  takenAt: string | null;
  dateSource: 'exif' | 'filename' | null;
  isDuplicate: boolean;
  error: string | null;
  ocr?: {
    kind: 'receipt' | 'dashboard' | null;
    merchant: string | null;
    date: string | null;
    total: number | null;
    currency: string | null;
    litres: number | null;
    pricePerLitre: number | null;
    fuelType: string | null;
    odometerMiles: number | null;
    tripMiles: number | null;
    mpg: number | null;
    confidence: number;
    rawText?: string | null;
  } | null;
}

export interface Vehicle {
  id: string;
  registration: string;
  make?: string | null;
  model?: string | null;
}

export interface BatchImportItem {
  kind: 'expense' | 'odometer';
  expense?: {
    vehicleId?: string | null;
    category: ExpenseCategory;
    date: string;
    amount: number;
    currency?: string;
    merchant?: string | null;
    notes?: string | null;
    fuel?: { litres?: number | null; odometerMiles?: number | null } | null;
    attachmentIds: string[];
    isFullyBusiness?: boolean;
    dateSource: DateSource;
  };
  odometer?: {
    vehicleId?: string | null;
    date: string;
    miles: number;
    source: 'fuelStop' | 'taxYearStart' | 'taxYearEnd' | 'manual';
    photoAttachmentId?: string | null;
    dateSource: DateSource;
    notes?: string | null;
  };
}

export interface BatchImportResult {
  created: number;
  failed: number;
  results: Array<{ index: number; kind: string; id: string | null; error: string | null }>;
}

export class ExpensesApiService {
  /**
   * Upload gallery assets in one multipart request. The server reads EXIF/filename dates and
   * de-duplicates by content hash; results are returned in the same order as `assets`.
   */
  static async uploadAttachments(assets: Asset[], onProgress?: (percent: number) => void): Promise<AttachmentUploadResult[]> {
    // Upload a few photos per request so no single request approaches server body limits,
    // and a failure in one chunk does not lose the others.
    const CHUNK = 4;
    const results: AttachmentUploadResult[] = [];
    for (let start = 0; start < assets.length; start += CHUNK) {
      const chunk = assets.slice(start, start + CHUNK);
      const form = new FormData();
      chunk.forEach((a, i) => {
        form.append('files', {
          uri: a.uri,
          type: a.type ?? 'image/jpeg',
          name: a.fileName ?? `photo_${start + i}.jpg`,
        } as unknown as Blob);
      });
      try {
        const response = await apiClient.post<AttachmentUploadResult[]>('/attachments/batch', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 5 * 60 * 1000,
          onUploadProgress: evt => {
            if (onProgress && evt.total) {
              const chunkFraction = Math.min(1, evt.loaded / evt.total);
              onProgress(Math.min(99, Math.round(((start + chunkFraction * chunk.length) * 100) / assets.length)));
            }
          },
        });
        results.push(...response.data);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const message = status === 413 ? 'Request too large (413)' : status ? `Upload failed (HTTP ${status})` : 'Upload failed (network error or timeout)';
        chunk.forEach(a => results.push({
          attachmentId: null, fileName: a.fileName ?? 'photo', contentType: a.type ?? null, sizeBytes: a.fileSize ?? 0,
          sha256: null, takenAt: null, dateSource: null, isDuplicate: false, error: message, ocr: null,
        }));
      }
      onProgress?.(Math.min(99, Math.round(((start + chunk.length) * 100) / assets.length)));
    }
    onProgress?.(100);
    return results;
  }

  static async createBatch(items: BatchImportItem[]): Promise<BatchImportResult> {
    const response = await apiClient.post<BatchImportResult>('/expenses/batch', { items });
    return response.data;
  }

  static async getVehicles(): Promise<Vehicle[]> {
    const response = await apiClient.get<Vehicle[]>('/vehicles');
    return response.data;
  }
}
