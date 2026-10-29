export declare const ImportTypes: {
    readonly MEDICINES: "MEDICINES";
};
export type ImportType = (typeof ImportTypes)[keyof typeof ImportTypes];
export declare const ImportJobStatuses: {
    readonly QUEUED: "QUEUED";
    readonly PROCESSING: "PROCESSING";
    readonly COMPLETED: "COMPLETED";
    readonly FAILED: "FAILED";
    readonly PARTIAL: "PARTIAL";
};
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
    createdCount?: number;
    updatedCount?: number;
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
    createdCount?: number;
    updatedCount?: number;
    errors: ImportRowError[];
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=import.d.ts.map