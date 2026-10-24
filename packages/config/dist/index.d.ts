export declare const APP_CONFIG: {
    readonly apiVersion: "v1";
    readonly pagination: {
        readonly defaultLimit: 25;
        readonly maxLimit: 50;
    };
    readonly approvalCode: {
        readonly length: 8;
        readonly expiryMinutes: 15;
        readonly maxAttempts: 3;
    };
    readonly csvImport: {
        readonly maxRowsPerChunk: 25;
    };
    readonly gstSlabs: readonly [0, 500, 1200, 1800, 2800];
};
export declare const COLLECTIONS: {
    readonly stores: "stores";
    readonly members: (storeId: string) => string;
    readonly medicines: (storeId: string) => string;
    readonly batches: (storeId: string) => string;
    readonly invoices: (storeId: string) => string;
    readonly stockLedger: (storeId: string) => string;
    readonly salesLedger: (storeId: string) => string;
    readonly suppliers: (storeId: string) => string;
    readonly supplierLedger: (storeId: string) => string;
    readonly purchaseOrders: (storeId: string) => string;
    readonly doctors: (storeId: string) => string;
    readonly employees: (storeId: string) => string;
    readonly employeeLedger: (storeId: string) => string;
    readonly expenses: (storeId: string) => string;
    readonly dailySummaries: (storeId: string) => string;
    readonly monthlySummaries: (storeId: string) => string;
    readonly dailyClosings: (storeId: string) => string;
    readonly approvalRequests: (storeId: string) => string;
    readonly refunds: (storeId: string) => string;
    readonly auditLogs: (storeId: string) => string;
    readonly notifications: (storeId: string) => string;
    readonly importJobs: (storeId: string) => string;
    readonly reportJobs: (storeId: string) => string;
    readonly counters: (storeId: string) => string;
    readonly cashRegister: (storeId: string) => string;
    readonly outbox: "outbox";
    readonly users: "users";
};
//# sourceMappingURL=index.d.ts.map