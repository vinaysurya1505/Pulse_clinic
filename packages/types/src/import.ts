export const ImportTypes = {
  MEDICINES: 'MEDICINES',
} as const;

export type ImportType = (typeof ImportTypes)[keyof typeof ImportTypes];

export const ImportJobStatuses = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
} as const;

export type ImportJobStatus = (typeof ImportJobStatuses)[keyof typeof ImportJobStatuses];

export interface ImportRowError {
  rowNumber: number;
  rawRow?: Record<string, string>;
  message: string;
  field?: string;
}

export interface CSVPreviewResult {
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  headers: string[];
  samplePreview: Array<Record<string, unknown>>;
  validationErrors: ImportRowError[];
  fileHash: string;
}

export interface ImportJob {
  id: string;
  storeId: string;
  importType: ImportType;
  fileHash: string;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  errors: ImportRowError[];
  createdAt: string;
  updatedAt: string;
}
