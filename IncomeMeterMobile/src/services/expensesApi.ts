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
    const form = new FormData();
    assets.forEach((a, i) => {
      form.append('files', {
        uri: a.uri,
        type: a.type ?? 'image/jpeg',
        name: a.fileName ?? `photo_${i}.jpg`,
      } as unknown as Blob);
    });

    const response = await apiClient.post<AttachmentUploadResult[]>('/attachments/batch', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 5 * 60 * 1000,
      onUploadProgress: evt => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    });
    return response.data;
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
