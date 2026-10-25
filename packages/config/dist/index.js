"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTIONS = exports.APP_CONFIG = void 0;
exports.APP_CONFIG = {
    apiVersion: 'v1',
    pagination: {
        defaultLimit: 25,
        maxLimit: 50,
    },
    approvalCode: {
        length: 8,
        expiryMinutes: 15,
        maxAttempts: 3,
    },
    csvImport: {
        maxRowsPerChunk: 25,
    },
    gstSlabs: [0, 500, 1200, 1800, 2800],
};
exports.COLLECTIONS = {
    stores: 'stores',
    members: (storeId) => `stores/${storeId}/members`,
    medicines: (storeId) => `stores/${storeId}/medicines`,
    batches: (storeId) => `stores/${storeId}/batches`,
    invoices: (storeId) => `stores/${storeId}/invoices`,
    stockLedger: (storeId) => `stores/${storeId}/stockLedger`,
    salesLedger: (storeId) => `stores/${storeId}/salesLedger`,
    suppliers: (storeId) => `stores/${storeId}/suppliers`,
    supplierLedger: (storeId) => `stores/${storeId}/supplierLedger`,
    purchaseOrders: (storeId) => `stores/${storeId}/purchaseOrders`,
    doctors: (storeId) => `stores/${storeId}/doctors`,
    doctorCommissions: (storeId) => `stores/${storeId}/doctorCommissions`,
    employees: (storeId) => `stores/${storeId}/employees`,
    employeeLedger: (storeId) => `stores/${storeId}/employeeLedger`,
    expenses: (storeId) => `stores/${storeId}/expenses`,
    dailySummaries: (storeId) => `stores/${storeId}/dailySummaries`,
    monthlySummaries: (storeId) => `stores/${storeId}/monthlySummaries`,
    dailyClosings: (storeId) => `stores/${storeId}/dailyClosings`,
    approvalRequests: (storeId) => `stores/${storeId}/approvalRequests`,
    refunds: (storeId) => `stores/${storeId}/refunds`,
    auditLogs: (storeId) => `stores/${storeId}/auditLogs`,
    notifications: (storeId) => `stores/${storeId}/notifications`,
    importJobs: (storeId) => `stores/${storeId}/importJobs`,
    reportJobs: (storeId) => `stores/${storeId}/reportJobs`,
    counters: (storeId) => `stores/${storeId}/counters`,
    cashRegister: (storeId) => `stores/${storeId}/cashRegister`,
    outbox: 'outbox',
    users: 'users',
};
//# sourceMappingURL=index.js.map