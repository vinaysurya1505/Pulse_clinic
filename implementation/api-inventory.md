# API Endpoint Inventory (`/api/v1`)

This document provides the complete `/api/v1` REST API endpoint inventory in accordance with Pack 1.2 specifications and Prompt 1A corrections. Every business workflow action is mapped to a dedicated, authorized endpoint.

---

## 1. Authentication, User Session & Store Membership Endpoints

### 1.1 Auth Session Exchange
- **Method:** `POST`
- **Route:** `/api/v1/auth/session`
- **Permission:** Authenticated Firebase User
- **Request Schema:** `{ idToken: string }`
- **Response Schema:** `{ success: boolean, user: { uid, email, name }, memberships: Array<{ storeId, role, storeName }> }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 20 req/min
- **Audit Event:** `AUTH_SESSION_CREATED` | **Collections:** `users`, `stores/{storeId}/members`
- **Related Prompt:** Prompt 4

### 1.2 Get Current User Profile & Context
- **Method:** `GET`
- **Route:** `/api/v1/auth/me`
- **Permission:** Authenticated User
- **Request Schema:** None
- **Response Schema:** `{ success: boolean, user: { uid, email, displayName, photoURL }, activeStoreId?: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `users`
- **Related Prompt:** Prompt 4

### 1.3 Select Active Store Context
- **Method:** `POST`
- **Route:** `/api/v1/auth/select-store`
- **Permission:** Authenticated Store Member
- **Request Schema:** `{ storeId: string }`
- **Response Schema:** `{ success: boolean, activeStore: { storeId, storeName, role, permissions: string[] } }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 30 req/min
- **Audit Event:** `STORE_CONTEXT_SELECTED` | **Collections:** `stores/{storeId}/members`
- **Related Prompt:** Prompt 5

### 1.4 List Store Members & Staff Roster
- **Method:** `GET`
- **Route:** `/api/v1/stores/:storeId/members`
- **Permission:** `employee.read` (`OWNER`, `MANAGER`)
- **Request Schema:** Params: `{ storeId: string }`
- **Response Schema:** `{ success: boolean, members: Array<{ uid, email, displayName, role, status, joinedAt }> }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/members`
- **Related Prompt:** Prompt 5

### 1.5 Update Store Profile Settings
- **Method:** `PUT`
- **Route:** `/api/v1/stores/:storeId`
- **Permission:** `store.update` (`OWNER`)
- **Request Schema:** `{ storeName?: string, phone?: string, address?: object, gstin?: string, drugLicenseNumber?: string, invoicePrefix?: string }`
- **Response Schema:** `{ success: boolean, store: StoreProfile }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 10 req/min
- **Audit Event:** `STORE_SETTINGS_UPDATED` | **Collections:** `stores/{storeId}`
- **Related Prompt:** Prompt 5

---

## 2. POS Billing, Quote & Invoicing Endpoints

### 2.1 Calculate Billing Quote (POS Terminal Dry Run)
- **Method:** `POST`
- **Route:** `/api/v1/bills/quote`
- **Permission:** `bill.create` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Request Schema:** `{ items: Array<{ medicineId, batchId, quantityUnits }>, discountPercentBP?: number, customerStateCode?: string }`
- **Response Schema:** `{ success: boolean, quote: { grossTotalPaise, taxTotalPaise, cgstPaise, sgstPaise, igstPaise, discountPaise, grandTotalPaise, items: Array<{ medicineId, batchId, unitPricePaise, lineTotalPaise, lineTaxPaise }> } }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 100 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/medicines`, `stores/{storeId}/batches`
- **Related Prompt:** Prompt 12

### 2.2 Atomic Bill Finalization
- **Method:** `POST`
- **Route:** `/api/v1/bills`
- **Permission:** `bill.create` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Request Schema:** `{ items: Array<{ medicineId, batchId, quantityUnits }>, paymentModes: Array<{ mode: 'CASH'|'UPI'|'CARD', amountPaise: number }>, customer?: { name, phone, stateCode }, doctorId?: string, discountPercentBP?: number, idempotencyKey: string }`
- **Response Schema:** `{ success: boolean, invoice: { id, invoiceNumber, grandTotalPaise, status, createdAt } }`
- **Idempotency:** **Yes (Mandatory `Idempotency-Key` header)** | **Transaction:** **Yes (Atomic Firestore Transaction)** | **Rate Limit:** 60 req/min
- **Audit Event:** `INVOICE_CREATED` | **Collections:** `stores/{storeId}/invoices`, `batches`, `stockLedger`, `salesLedger`, `counters`
- **Related Prompt:** Prompt 13, Prompt 14

### 2.3 List Invoices (Register & History)
- **Method:** `GET`
- **Route:** `/api/v1/bills`
- **Permission:** `bill.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ limit?: number, cursor?: string, status?: string, startDate?: string, endDate?: string, search?: string }`
- **Response Schema:** `{ success: boolean, invoices: Array<InvoiceSummary>, nextCursor?: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/invoices`
- **Related Prompt:** Prompt 16

### 2.4 Get Invoice Detail by ID
- **Method:** `GET`
- **Route:** `/api/v1/bills/:id`
- **Permission:** `bill.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Request Schema:** Params: `{ id: string }`
- **Response Schema:** `{ success: boolean, invoice: InvoiceDetailFull }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 100 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/invoices`
- **Related Prompt:** Prompt 16

### 2.5 Generate A4 Invoice PDF Document
- **Method:** `GET`
- **Route:** `/api/v1/bills/:id/pdf`
- **Permission:** `bill.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Request Schema:** Params: `{ id: string }`
- **Response Schema:** Binary PDF stream / `{ success: boolean, pdfUrl: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 30 req/min
- **Audit Event:** `INVOICE_PDF_GENERATED` | **Collections:** `stores/{storeId}/invoices`
- **Related Prompt:** Prompt 15

---

## 3. Approval Requests, Cancellation & Refund Endpoints

### 3.1 Request Refund Approval Code (OTP Generator)
- **Method:** `POST`
- **Route:** `/api/v1/bills/:id/request-approval`
- **Permission:** `bill.refund` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Request Schema:** `{ reason: string }`
- **Response Schema:** `{ success: boolean, requestId: string, expiresAt: string, message: string }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 10 req/min
- **Audit Event:** `APPROVAL_CODE_REQUESTED` | **Collections:** `stores/{storeId}/approvalRequests`, `outbox`
- **Related Prompt:** Prompt 17

### 3.2 Resend Refund Approval Code Email
- **Method:** `POST`
- **Route:** `/api/v1/bills/:id/resend-approval`
- **Permission:** `bill.refund` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Request Schema:** `{ requestId: string }`
- **Response Schema:** `{ success: boolean, message: string }`
- **Idempotency:** Yes | **Transaction:** No | **Rate Limit:** 5 req/min
- **Audit Event:** `APPROVAL_CODE_RESENT` | **Collections:** `stores/{storeId}/approvalRequests`, `outbox`
- **Related Prompt:** Prompt 17

### 3.3 Execute Cancellation / Refund with Verification Code
- **Method:** `POST`
- **Route:** `/api/v1/bills/:id/refund`
- **Permission:** `bill.refund` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Request Schema:** `{ requestId: string, approvalCode: string, refundType: 'FULL'|'PARTIAL', lineItems?: Array<{ batchId, quantityUnits }>, refundModes: Array<{ mode, amountPaise }> }`
- **Response Schema:** `{ success: boolean, refundId: string, invoiceStatus: 'REFUNDED'|'PARTIALLY_REFUNDED', reversalLedgerId: string }`
- **Idempotency:** **Yes (Mandatory `Idempotency-Key` header)** | **Transaction:** **Yes (Atomic Firestore Transaction)** | **Rate Limit:** 10 req/min
- **Audit Event:** `INVOICE_REFUNDED` | **Collections:** `stores/{storeId}/invoices`, `refunds`, `batches`, `stockLedger`, `salesLedger`, `approvalRequests`
- **Related Prompt:** Prompt 18

---

## 4. Inventory, Catalogue & Batch Management Endpoints

### 4.1 Search & List Medicine Catalogue
- **Method:** `GET`
- **Route:** `/api/v1/inventory/medicines`
- **Permission:** `inventory.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ query?: string, category?: string, limit?: number, cursor?: string }`
- **Response Schema:** `{ success: boolean, medicines: Array<MedicineMaster>, nextCursor?: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 120 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/medicines`
- **Related Prompt:** Prompt 6

### 4.2 Get Medicine Master by ID
- **Method:** `GET`
- **Route:** `/api/v1/inventory/medicines/:id`
- **Permission:** `inventory.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Request Schema:** Params: `{ id: string }`
- **Response Schema:** `{ success: boolean, medicine: MedicineMaster }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 100 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/medicines`
- **Related Prompt:** Prompt 6

### 4.3 Create Medicine Master Entry
- **Method:** `POST`
- **Route:** `/api/v1/inventory/medicines`
- **Permission:** `inventory.write` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ brandName: string, genericName: string, category: string, hsnCode: string, gstSlabPercent: number, baseUnit: string, stripSize: number, allowLooseSales: boolean, schedule: string }`
- **Response Schema:** `{ success: boolean, medicineId: string }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 30 req/min
- **Audit Event:** `MEDICINE_CREATED` | **Collections:** `stores/{storeId}/medicines`
- **Related Prompt:** Prompt 6

### 4.4 Update Medicine Master Entry
- **Method:** `PUT`
- **Route:** `/api/v1/inventory/medicines/:id`
- **Permission:** `inventory.write` (`OWNER`, `MANAGER`)
- **Request Schema:** Partial `<MedicineMaster>` payload
- **Response Schema:** `{ success: boolean, medicine: MedicineMaster }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 30 req/min
- **Audit Event:** `MEDICINE_UPDATED` | **Collections:** `stores/{storeId}/medicines`
- **Related Prompt:** Prompt 6

### 4.5 List Batches (FEFO Sorted & Near-Expiry Alerts)
- **Method:** `GET`
- **Route:** `/api/v1/inventory/batches`
- **Permission:** `inventory.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ medicineId?: string, expiryStatus?: 'EXPIRED'|'NEAR_EXPIRY'|'VALID', limit?: number, cursor?: string }`
- **Response Schema:** `{ success: boolean, batches: Array<BatchInventory>, nextCursor?: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 100 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/batches`
- **Related Prompt:** Prompt 7

### 4.6 Manual Stock Adjustment & Audit Log
- **Method:** `POST`
- **Route:** `/api/v1/inventory/adjustments`
- **Permission:** `inventory.adjust` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ batchId: string, adjustmentUnits: number, reason: string }`
- **Response Schema:** `{ success: boolean, newStockUnits: number, movementId: string }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 20 req/min
- **Audit Event:** `STOCK_ADJUSTED` | **Collections:** `stores/{storeId}/batches`, `stockLedger`
- **Related Prompt:** Prompt 7

### 4.7 View Stock Movement History Ledger
- **Method:** `GET`
- **Route:** `/api/v1/inventory/movements`
- **Permission:** `inventory.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ medicineId?: string, batchId?: string, limit?: number, cursor?: string }`
- **Response Schema:** `{ success: boolean, movements: Array<StockMovementEntry>, nextCursor?: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/stockLedger`
- **Related Prompt:** Prompt 7

---

## 5. CSV Bulk Import Endpoints

### 5.1 Preview CSV Ingestion File
- **Method:** `POST`
- **Route:** `/api/v1/imports/csv/preview`
- **Permission:** `import.execute` (`OWNER`, `MANAGER`)
- **Request Schema:** Multipart Form: `{ file: File, importType: 'MEDICINES'|'EMPLOYEES'|'SUPPLIERS' }`
- **Response Schema:** `{ success: boolean, totalRows: number, validRowsCount: number, errorRowsCount: number, samplePreview: Array<object>, validationErrors: Array<object> }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 10 req/min
- **Audit Event:** None | **Collections:** N/A
- **Related Prompt:** Prompt 8

### 5.2 Commit CSV Import Job
- **Method:** `POST`
- **Route:** `/api/v1/imports/csv/commit`
- **Permission:** `import.execute` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ fileHash: string, importType: string }`
- **Response Schema:** `{ success: boolean, jobId: string, status: 'QUEUED', totalRows: number }`
- **Idempotency:** Yes (SHA-256 file hash checking) | **Transaction:** Yes (Dynamic write-budget chunks) | **Rate Limit:** 5 req/min
- **Audit Event:** `CSV_IMPORT_COMMITTED` | **Collections:** `stores/{storeId}/importJobs`
- **Related Prompt:** Prompt 8

### 5.3 Get CSV Import Job Status
- **Method:** `GET`
- **Route:** `/api/v1/imports/csv/:jobId`
- **Permission:** `import.execute` (`OWNER`, `MANAGER`)
- **Request Schema:** Params: `{ jobId: string }`
- **Response Schema:** `{ success: boolean, job: { jobId, status, totalRows, processedRows, errorCount, errorLogUrl } }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/importJobs`
- **Related Prompt:** Prompt 8

---

## 6. Procurement, Suppliers & Purchases Endpoints

### 6.1 List & Search Suppliers
- **Method:** `GET`
- **Route:** `/api/v1/suppliers`
- **Permission:** `supplier.read` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ search?: string, limit?: number, cursor?: string }`
- **Response Schema:** `{ success: boolean, suppliers: Array<SupplierProfile>, nextCursor?: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/suppliers`
- **Related Prompt:** Prompt 9

### 6.2 Create Supplier Profile
- **Method:** `POST`
- **Route:** `/api/v1/suppliers`
- **Permission:** `supplier.write` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ name: string, gstin: string, phone: string, email: string, address: object, paymentTermsDays: number }`
- **Response Schema:** `{ success: boolean, supplierId: string }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 20 req/min
- **Audit Event:** `SUPPLIER_CREATED` | **Collections:** `stores/{storeId}/suppliers`
- **Related Prompt:** Prompt 9

### 6.3 Create Purchase Order
- **Method:** `POST`
- **Route:** `/api/v1/purchases`
- **Permission:** `po.create` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ supplierId: string, lineItems: Array<{ medicineId: string, quantityPacks: number, unitCostPaise: number }> }`
- **Response Schema:** `{ success: boolean, poId: string, poNumber: string, status: 'DRAFT' }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 30 req/min
- **Audit Event:** `PURCHASE_ORDER_CREATED` | **Collections:** `stores/{storeId}/purchaseOrders`
- **Related Prompt:** Prompt 9

### 6.4 Receive GRN Stock Ingestion
- **Method:** `POST`
- **Route:** `/api/v1/purchases/:id/receive`
- **Permission:** `po.receive` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ supplierInvoiceNumber: string, supplierInvoiceDate: string, batches: Array<{ medicineId, batchNumber, mfgDate, expiryDate, quantityPacks, purchaseRatePaise, mrpPaise, sellingPricePaise }> }`
- **Response Schema:** `{ success: boolean, grnId: string, poStatus: 'RECEIVED', batchesCreated: number }`
- **Idempotency:** **Yes (Mandatory `Idempotency-Key` header)** | **Transaction:** **Yes (Atomic Firestore Transaction)** | **Rate Limit:** 20 req/min
- **Audit Event:** `GRN_STOCK_RECEIVED` | **Collections:** `stores/{storeId}/purchaseOrders`, `batches`, `stockLedger`, `supplierLedger`
- **Related Prompt:** Prompt 9

### 6.5 Get Supplier Statement & Ledger History
- **Method:** `GET`
- **Route:** `/api/v1/suppliers/:id/statement`
- **Permission:** `supplier.read` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Request Schema:** Params: `{ id: string }`, Query: `{ startDate?: string, endDate?: string }`
- **Response Schema:** `{ success: boolean, statement: { currentBalancePaise, entries: Array<SupplierLedgerEntry> } }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 30 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/supplierLedger`
- **Related Prompt:** Prompt 9

### 6.6 Record Supplier Payment Entry
- **Method:** `POST`
- **Route:** `/api/v1/suppliers/:id/payments`
- **Permission:** `supplier.write` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ amountPaise: number, paymentMode: 'BANK_TRANSFER'|'CHEQUE'|'CASH', referenceNumber: string }`
- **Response Schema:** `{ success: boolean, paymentId: string, newBalancePaise: number }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 20 req/min
- **Audit Event:** `SUPPLIER_PAYMENT_RECORDED` | **Collections:** `stores/{storeId}/suppliers`, `supplierLedger`
- **Related Prompt:** Prompt 9

---

## 7. Doctor & Employee Management Endpoints

### 7.1 List Doctors
- **Method:** `GET`
- **Route:** `/api/v1/doctors`
- **Permission:** `doctor.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ search?: string, limit?: number, cursor?: string }`
- **Response Schema:** `{ success: boolean, doctors: Array<DoctorProfile>, nextCursor?: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/doctors`
- **Related Prompt:** Prompt 10

### 7.2 Create Doctor Profile
- **Method:** `POST`
- **Route:** `/api/v1/doctors`
- **Permission:** `doctor.write` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ name: string, registrationNumber: string, specialization?: string, phone?: string }`
- **Response Schema:** `{ success: boolean, doctorId: string }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 30 req/min
- **Audit Event:** `DOCTOR_CREATED` | **Collections:** `stores/{storeId}/doctors`
- **Related Prompt:** Prompt 10

### 7.3 List Employees & Roster Status
- **Method:** `GET`
- **Route:** `/api/v1/employees`
- **Permission:** `employee.read` (`OWNER`, `MANAGER`)
- **Request Schema:** Query: `{ limit?: number, cursor?: string }`
- **Response Schema:** `{ success: boolean, employees: Array<EmployeeProfileMasked>, nextCursor?: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/employees`
- **Related Prompt:** Prompt 10

### 7.4 Create Employee Profile (With Masked PII)
- **Method:** `POST`
- **Route:** `/api/v1/employees`
- **Permission:** `employee.write` (`OWNER`)
- **Request Schema:** `{ fullName: string, email: string, phone: string, assignedRole: 'MANAGER'|'PHARMACIST'|'ACCOUNTANT', aadhaarLastFour: string, panLastFour: string }`
- **Response Schema:** `{ success: boolean, employeeId: string }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 20 req/min
- **Audit Event:** `EMPLOYEE_CREATED` | **Collections:** `stores/{storeId}/employees`
- **Related Prompt:** Prompt 10

### 7.5 Get Employee Ledger History
- **Method:** `GET`
- **Route:** `/api/v1/employees/:id/ledger`
- **Permission:** `employee.read` (`OWNER`, `MANAGER`)
- **Request Schema:** Params: `{ id: string }`
- **Response Schema:** `{ success: boolean, entries: Array<EmployeeLedgerEntry>, currentBalancePaise: number }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 30 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/employeeLedger`
- **Related Prompt:** Prompt 10, Prompt 19

### 7.6 Record Employee Salary Advance / Repayment
- **Method:** `POST`
- **Route:** `/api/v1/employees/:id/ledger`
- **Permission:** `employee.write` (`OWNER`)
- **Request Schema:** `{ type: 'ADVANCE'|'REPAYMENT'|'SALARY_PAYMENT', amountPaise: number, description: string }`
- **Response Schema:** `{ success: boolean, entryId: string, newBalancePaise: number }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 20 req/min
- **Audit Event:** `EMPLOYEE_LEDGER_POSTED` | **Collections:** `stores/{storeId}/employeeLedger`
- **Related Prompt:** Prompt 10, Prompt 19

---

## 8. Expenses, Cash Drawer & Dashboard Endpoints

### 8.1 List Store Expenses
- **Method:** `GET`
- **Route:** `/api/v1/expenses`
- **Permission:** `expense.read` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ category?: string, startDate?: string, endDate?: string }`
- **Response Schema:** `{ success: boolean, expenses: Array<ExpenseEntry> }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/expenses`
- **Related Prompt:** Prompt 19

### 8.2 Log Petty Cash Expense Entry
- **Method:** `POST`
- **Route:** `/api/v1/expenses`
- **Permission:** `expense.write` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ category: string, amountPaise: number, description: string }`
- **Response Schema:** `{ success: boolean, expenseId: string }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 30 req/min
- **Audit Event:** `EXPENSE_LOGGED` | **Collections:** `stores/{storeId}/expenses`
- **Related Prompt:** Prompt 19

### 8.3 Get Dashboard Real-Time KPI Metrics
- **Method:** `GET`
- **Route:** `/api/v1/dashboard`
- **Permission:** `store.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ date?: string }`
- **Response Schema:** `{ success: boolean, dashboard: { todaySalesPaise, transactionCount, lowStockCount, expiringCount, recentInvoices: Array<InvoiceSummary> } }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/dailySummaries`
- **Related Prompt:** Prompt 20

### 8.4 Execute Daily Register Closing
- **Method:** `POST`
- **Route:** `/api/v1/daily-closings`
- **Permission:** `store.update` (`OWNER`, `MANAGER`)
- **Request Schema:** `{ dateKey: string, physicalCashCountPaise: number, notes?: string }`
- **Response Schema:** `{ success: boolean, closingId: string, discrepancyPaise: number }`
- **Idempotency:** Yes | **Transaction:** Yes | **Rate Limit:** 10 req/min
- **Audit Event:** `DAILY_CLOSING_EXECUTED` | **Collections:** `stores/{storeId}/dailyClosings`
- **Related Prompt:** Prompt 20

---

## 9. Reports, Administration, Audit & Health Check Endpoints

### 9.1 Daily & Monthly Financial Reports
- **Method:** `GET`
- **Route:** `/api/v1/reports/financial`
- **Permission:** `report.financial` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ startDate: string, endDate: string, type: 'DAILY'|'MONTHLY' }`
- **Response Schema:** `{ success: boolean, summary: { totalGrossPaise, totalTaxPaise, totalDiscountPaise, netSalesPaise, paymentSplit: object } }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 30 req/min
- **Audit Event:** `FINANCIAL_REPORT_GENERATED` | **Collections:** `stores/{storeId}/dailySummaries`
- **Related Prompt:** Prompt 21

### 9.2 GSTR-1 & GSTR-3B Compliance Tax Report
- **Method:** `GET`
- **Route:** `/api/v1/reports/gst`
- **Permission:** `report.gst` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Request Schema:** Query: `{ monthYear: string, format: 'GSTR1'|'GSTR3B' }`
- **Response Schema:** `{ success: boolean, gstData: { taxableTotalPaise, cgstTotalPaise, sgstTotalPaise, igstTotalPaise, hsnSummary: Array<object> } }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 20 req/min
- **Audit Event:** `GST_REPORT_GENERATED` | **Collections:** `stores/{storeId}/invoices`
- **Related Prompt:** Prompt 21

### 9.3 Get Alert Notifications
- **Method:** `GET`
- **Route:** `/api/v1/notifications`
- **Permission:** `store.read` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Request Schema:** Query: `{ status?: 'UNREAD'|'READ' }`
- **Response Schema:** `{ success: boolean, notifications: Array<NotificationItem> }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 60 req/min
- **Audit Event:** None | **Collections:** `stores/{storeId}/notifications`
- **Related Prompt:** Prompt 22

### 9.4 List System Audit Logs
- **Method:** `GET`
- **Route:** `/api/v1/admin/audit-logs`
- **Permission:** `audit.read` (`OWNER`, `MANAGER`)
- **Request Schema:** Query: `{ eventName?: string, limit?: number, cursor?: string }`
- **Response Schema:** `{ success: boolean, auditLogs: Array<AuditLogEntry>, nextCursor?: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 30 req/min
- **Audit Event:** `AUDIT_LOGS_VIEWED` | **Collections:** `stores/{storeId}/auditLogs`
- **Related Prompt:** Prompt 23

### 9.5 System Health Check
- **Method:** `GET`
- **Route:** `/api/v1/admin/health`
- **Permission:** Public / Health Check
- **Request Schema:** None
- **Response Schema:** `{ status: 'OK', environment: string, timestamp: string }`
- **Idempotency:** No | **Transaction:** No | **Rate Limit:** 120 req/min
- **Audit Event:** None | **Collections:** N/A
- **Related Prompt:** Prompt 2

---

## 10. Excluded / Deferred Endpoints

### 10.1 Customer Credit Endpoints
- **Status:** **OPTIONAL FUTURE ENHANCEMENT — NOT PART OF MVP**.
- **Excluded Routes:** `/api/v1/customers/*`, `/api/v1/customers/:id/statement`, `/api/v1/customers/:id/payments`.
- **Reason:** Customer credit sales and debt write-offs are explicitly excluded from the MVP scope.
