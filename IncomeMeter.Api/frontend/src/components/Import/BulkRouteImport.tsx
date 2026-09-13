import React, { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { useLanguage } from '../../contexts/LanguageContext';
import type { WorkTypeConfig } from '../../types';

interface BulkImportRow {
  workTypeName: string;
  scheduleDate: string; // dd/MM/yyyy
  fromTime: string; // HHmm
  toTime: string; // HHmm
  startMile: string;
  endMile: string;
  incomeSources: string; // JSON format: {"Uber": 25.50, "Tips": 5.00} OR pipe format: Uber:25.50|Tips:5.00
}

interface ParsedRoute {
  workTypeName: string;
  scheduleStart: Date;
  scheduleEnd: Date;
  startMile: number;
  endMile: number;
  incomes: Array<{ source: string; amount: number }>;
  rowIndex: number;
  errors: string[];
}

interface BulkRouteImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (routes: ParsedRoute[]) => Promise<void>;
  workTypes: WorkTypeConfig[];
}

const BulkRouteImport: React.FC<BulkRouteImportProps> = ({
  isOpen,
  onClose,
  onImport,
  workTypes
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRoute[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    isImporting: boolean;
  }>({ current: 0, total: 0, isImporting: false });

  const generateTemplate = useCallback(() => {
    const templateData = [
      {
        workTypeName: 'Uber Driver',
        scheduleDate: '15/01/2024',
        fromTime: '0900',
        toTime: '1700',
        startMile: '12345',
        endMile: '12445',
        incomeSources: '{"Uber": 120.50, "Tips": 15.00}'
      },
      {
        workTypeName: 'Delivery Driver',
        scheduleDate: '16/01/2024',
        fromTime: '1800',
        toTime: '2300',
        startMile: '12445',
        endMile: '12545',
        incomeSources: 'Delivery Fee:45.00|Tips:8.00|Bonus:5.00'
      }
    ];

    const csv = Papa.unparse(templateData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'route_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const parseTime = useCallback((timeStr: string): { hours: number; minutes: number } | null => {
    try {
      // Parse HHmm format (e.g., "0900", "1730")
      if (timeStr.length !== 4) return null;

      const hours = parseInt(timeStr.substring(0, 2), 10);
      const minutes = parseInt(timeStr.substring(2, 4), 10);

      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }

      return { hours, minutes };
    } catch {
      return null;
    }
  }, []);

  const parseDate = useCallback((dateStr: string, timeStr: string): Date | null => {
    try {
      // Parse dd/MM/yyyy format
      const [day, month, year] = dateStr.split('/').map(Number);
      if (!day || !month || !year) return null;

      // Parse HHmm format
      const time = parseTime(timeStr);
      if (!time) return null;

      const date = new Date(year, month - 1, day, time.hours, time.minutes);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }, [parseTime]);

  const parseIncomes = useCallback((incomeStr: string): Array<{ source: string; amount: number }> => {
    try {
      // First try JSON format: {"Uber": 25.50, "Tips": 5.00}
      if (incomeStr.trim().startsWith('{')) {
        const parsed = JSON.parse(incomeStr);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Income sources must be an object');
        }

        return Object.entries(parsed).map(([source, amount]) => ({
          source: source.trim(),
          amount: Number(amount)
        })).filter(item => item.source && !isNaN(item.amount) && item.amount >= 0);
      }

      // Try pipe-separated format: Uber:25.50|Tips:5.00|Bonus:10.00
      const pipeItems = incomeStr.split('|').map(item => item.trim()).filter(Boolean);
      const incomes: Array<{ source: string; amount: number }> = [];

      for (const item of pipeItems) {
        const [source, amountStr] = item.split(':').map(s => s.trim());
        if (!source || !amountStr) continue;

        const amount = Number(amountStr);
        if (isNaN(amount) || amount < 0) continue;

        incomes.push({ source, amount });
      }

      return incomes;
    } catch {
      return [];
    }
  }, []);

  const validateRow = useCallback((row: BulkImportRow, index: number): ParsedRoute => {
    const errors: string[] = [];

    // Validate work type
    const workType = workTypes.find(wt =>
      wt.name.toLowerCase() === row.workTypeName.toLowerCase() && wt.isActive
    );
    if (!workType) {
      errors.push(`Work type "${row.workTypeName}" not found or inactive`);
    }

    // Parse and validate dates
    const scheduleStart = parseDate(row.scheduleDate, row.fromTime);
    const scheduleEnd = parseDate(row.scheduleDate, row.toTime);

    if (!scheduleStart) {
      errors.push(`Invalid schedule start: ${row.scheduleDate} ${row.fromTime} (expected format: dd/MM/yyyy HHmm)`);
    }
    if (!scheduleEnd) {
      errors.push(`Invalid schedule end: ${row.scheduleDate} ${row.toTime} (expected format: dd/MM/yyyy HHmm)`);
    }
    if (scheduleStart && scheduleEnd && scheduleStart >= scheduleEnd) {
      errors.push('Schedule start must be before schedule end');
    }

    // Validate mileage
    const startMile = Number(row.startMile);
    const endMile = Number(row.endMile);

    if (isNaN(startMile) || startMile < 0) {
      errors.push(`Invalid start mile: ${row.startMile}`);
    }
    if (isNaN(endMile) || endMile < 0) {
      errors.push(`Invalid end mile: ${row.endMile}`);
    }
    if (!isNaN(startMile) && !isNaN(endMile) && endMile <= startMile) {
      errors.push('End mile must be greater than start mile');
    }

    // Parse and validate income sources
    const incomes = parseIncomes(row.incomeSources);
    if (incomes.length === 0) {
      errors.push('No valid income sources found. Use JSON format {"Source": amount} or pipe format Source:amount|Source2:amount2');
    }

    return {
      workTypeName: row.workTypeName,
      scheduleStart: scheduleStart || new Date(),
      scheduleEnd: scheduleEnd || new Date(),
      startMile: startMile || 0,
      endMile: endMile || 0,
      incomes,
      rowIndex: index + 2, // +2 because CSV is 1-indexed and has header
      errors
    };
  }, [workTypes, parseDate, parseIncomes]);

  const processFile = useCallback((uploadedFile: File) => {
    setIsProcessing(true);
    setErrors([]);
    setParsedData([]);
    setShowPreview(false);

    Papa.parse<BulkImportRow>(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parseErrors: string[] = [];

        if (results.errors.length > 0) {
          parseErrors.push(...results.errors.map(err => `CSV Parse Error: ${err.message}`));
        }

        if (results.data.length === 0) {
          parseErrors.push('No data found in CSV file');
          setErrors(parseErrors);
          setIsProcessing(false);
          return;
        }

        // Validate required columns
        const requiredColumns = ['workTypeName', 'scheduleDate', 'fromTime', 'toTime', 'startMile', 'endMile', 'incomeSources'];
        const actualColumns = Object.keys(results.data[0] || {});
        const missingColumns = requiredColumns.filter(col => !actualColumns.includes(col));

        if (missingColumns.length > 0) {
          parseErrors.push(`Missing required columns: ${missingColumns.join(', ')}`);
          setErrors(parseErrors);
          setIsProcessing(false);
          return;
        }

        // Validate and parse each row
        const parsedRoutes = results.data.map((row, index) => validateRow(row, index));

        setParsedData(parsedRoutes);
        setErrors(parseErrors);
        setShowPreview(true);
        setIsProcessing(false);
      },
      error: (error) => {
        setErrors([`Failed to parse CSV: ${error.message}`]);
        setIsProcessing(false);
      }
    });
  }, [validateRow]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file =>
      file.type === 'text/csv' ||
      file.name.toLowerCase().endsWith('.csv')
    );

    if (csvFile) {
      setFile(csvFile);
      processFile(csvFile);
    } else {
      setErrors(['Please upload a CSV file']);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFile(selectedFile);
    }
  }, [processFile]);

  const handleImport = useCallback(async () => {
    const validRoutes = parsedData.filter(route => route.errors.length === 0);

    if (validRoutes.length === 0) {
      setErrors(['No valid routes to import']);
      return;
    }

    setImportProgress({ current: 0, total: validRoutes.length, isImporting: true });

    try {
      await onImport(validRoutes);
      onClose();
    } catch (error) {
      setErrors([`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setImportProgress({ current: 0, total: 0, isImporting: false });
    }
  }, [parsedData, onImport, onClose]);

  const handleClose = useCallback(() => {
    if (!importProgress.isImporting) {
      setFile(null);
      setParsedData([]);
      setErrors([]);
      setShowPreview(false);
      setImportProgress({ current: 0, total: 0, isImporting: false });
      onClose();
    }
  }, [importProgress.isImporting, onClose]);

  const validRoutes = parsedData.filter(route => route.errors.length === 0);
  const invalidRoutes = parsedData.filter(route => route.errors.length > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {t('routes.bulkImport.title', 'Bulk Import Routes')}
          </h2>
          <button
            onClick={handleClose}
            disabled={importProgress.isImporting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!showPreview ? (
            <>
              {/* File Upload Area with Template */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t('routes.bulkImport.upload.title', 'Upload CSV File')}
                  </h3>
                  <button
                    onClick={generateTemplate}
                    className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('routes.bulkImport.template.download', 'Download Template')}
                  </button>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">
                      {t('routes.bulkImport.upload.dragDrop', 'Drag and drop your CSV file here, or')}
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {t('routes.bulkImport.upload.browse', 'browse to upload')}
                    </button>
                  </div>
                  {file && (
                    <p className="mt-2 text-sm text-gray-500">
                      Selected: {file.name}
                    </p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Format Instructions */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  {t('routes.bulkImport.format.title', 'CSV Format Requirements')}
                </h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Required columns:</strong> workTypeName, scheduleDate, fromTime, toTime, startMile, endMile, incomeSources</p>
                  <p><strong>Date format:</strong> dd/MM/yyyy (e.g., 15/01/2024)</p>
                  <p><strong>Time format:</strong> HHmm (e.g., 0900, 1730)</p>
                  <p><strong>Income Sources (2 options):</strong></p>
                  <ul className="ml-4 space-y-1">
                    <li>• JSON format: <code>{`{"Uber": 25.50, "Tips": 5.00}`}</code></li>
                    <li>• Pipe format: <code>Uber:25.50|Tips:5.00|Bonus:10.00</code></li>
                  </ul>
                </div>
              </div>

              {/* Processing */}
              {isProcessing && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">
                    {t('routes.bulkImport.processing', 'Processing CSV file...')}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Preview */
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('routes.bulkImport.preview.title', 'Import Preview')}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-green-800 font-medium">{validRoutes.length}</p>
                    <p className="text-green-600">{t('routes.bulkImport.preview.valid', 'Valid routes')}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded">
                    <p className="text-red-800 font-medium">{invalidRoutes.length}</p>
                    <p className="text-red-600">{t('routes.bulkImport.preview.invalid', 'Invalid routes')}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-blue-800 font-medium">{parsedData.length}</p>
                    <p className="text-blue-600">{t('routes.bulkImport.preview.total', 'Total rows')}</p>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Work Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Miles</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Income Sources</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedData.map((route, index) => (
                      <tr key={index} className={route.errors.length > 0 ? 'bg-red-50' : 'bg-white'}>
                        <td className="px-3 py-2 text-sm text-gray-900">{route.rowIndex}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{route.workTypeName}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {route.scheduleStart.toLocaleDateString()}<br />
                          <span className="text-xs text-gray-600">
                            {route.scheduleStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} - {route.scheduleEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {route.startMile} → {route.endMile}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          <div className="space-y-1">
                            {route.incomes.map((inc, i) => (
                              <div key={i} className="text-xs">
                                {inc.source}: ${inc.amount.toFixed(2)}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {route.errors.length === 0 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Valid
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mb-1">
                                Error
                              </span>
                              <ul className="text-xs text-red-600 max-w-48">
                                {route.errors.map((error, i) => (
                                  <li key={i} className="break-words">• {error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                {t('routes.bulkImport.errors.title', 'Import Errors')}
              </h4>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Import Progress */}
          {importProgress.isImporting && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">
                  {t('routes.bulkImport.importing', 'Importing routes...')}
                </span>
                <span className="text-sm text-blue-600">
                  {importProgress.current} / {importProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={handleClose}
            disabled={importProgress.isImporting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {t('common.cancel', 'Cancel')}
          </button>

          {showPreview && validRoutes.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importProgress.isImporting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {importProgress.isImporting
                ? t('routes.bulkImport.importing', 'Importing...')
                : t('routes.bulkImport.import', `Import ${validRoutes.length} routes`)
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkRouteImport;