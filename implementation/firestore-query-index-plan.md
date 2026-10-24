# Firestore Query & Composite Index Plan

This document details every query executed across the Pharmacy AI Agent application, defining tenant scope, filters, sort orders, cursor pagination boundaries, result limits, required composite index specs, authorization, expected read behavior, and cost/contention mitigation strategies in accordance with Pack 1.2 specifications and Prompt 1A audit instructions.

---

## 1. Complete Query Pattern Inventory (22 Query Patterns)

### Q-01: Medicine Catalogue Search by Category & Brand
- **Tenant Scope:** Store-scoped (`stores/{storeId}/medicines`)
- **Filters:** `isArchived == false`, `category == {cat}`
- **Sorting:** `brandName ASC`
- **Cursor Boundary:** `(brandName, __name__)`
- **Max Page Size:** 50 items
- **Required Composite Index:** `isArchived ASC`, `category ASC`, `brandName ASC`
- **Authorization:** `inventory.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Expected Read Behavior:** Indexed lookup; 0 full collection scans.
- **Cost / Contention Risk:** Low cost; high query frequency on POS terminal.

### Q-02: Medicine Barcode Direct Lookup
- **Tenant Scope:** Store-scoped (`stores/{storeId}/medicines`)
- **Filters:** `barcode == {code}`, `isArchived == false`
- **Sorting:** Single document match / `createdAt DESC`
- **Cursor Boundary:** N/A (Direct match)
- **Max Page Size:** 1 item
- **Required Composite Index:** Single field index on `barcode`
- **Authorization:** `inventory.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Expected Read Behavior:** Point or single-doc query.
- **Cost / Contention Risk:** Minimal cost.

### Q-03: Sellable Batches FEFO Order Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/batches`)
- **Filters:** `medicineId == {id}`, `status == 'ACTIVE'`, `expiryDate > {todayIso}`
- **Sorting:** `expiryDate ASC`
- **Cursor Boundary:** `(expiryDate, __name__)`
- **Max Page Size:** 20 batches
- **Required Composite Index:** `medicineId ASC`, `status ASC`, `expiryDate ASC`
- **Authorization:** `bill.create` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Expected Read Behavior:** Executed inside billing quote & finalization transactions.
- **Cost / Contention Risk:** High transactional concurrency; optimistic lock retry limits enforced.

### Q-04: Low-Stock Inventory Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/batches`)
- **Filters:** `stockUnits <= {reorderLevel}`, `status == 'ACTIVE'`
- **Sorting:** `stockUnits ASC`
- **Cursor Boundary:** `(stockUnits, __name__)`
- **Max Page Size:** 50 items
- **Required Composite Index:** `status ASC`, `stockUnits ASC`
- **Authorization:** `inventory.read` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Expected Read Behavior:** Dashboard notification polling.
- **Cost / Contention Risk:** Low read cost.

### Q-05: Near-Expiry and Expired Batches Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/batches`)
- **Filters:** `expiryDate >= {startDate}`, `expiryDate <= {endDate}`
- **Sorting:** `expiryDate ASC`
- **Cursor Boundary:** `(expiryDate, __name__)`
- **Max Page Size:** 100 items
- **Required Composite Index:** Single field range on `expiryDate ASC`
- **Authorization:** `inventory.read` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Expected Read Behavior:** Daily expiry tracker page.
- **Cost / Contention Risk:** Low cost; bounded limit per page.

### Q-06: Stock Movement History Ledger Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/stockLedger`)
- **Filters:** `medicineId == {id}`, `createdAt >= {startDate}`
- **Sorting:** `createdAt DESC`
- **Cursor Boundary:** `(createdAt DESC, __name__ DESC)`
- **Max Page Size:** 50 records
- **Required Composite Index:** `medicineId ASC`, `createdAt DESC`
- **Authorization:** `inventory.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Expected Read Behavior:** Audit review of inventory movements.
- **Cost / Contention Risk:** Low read cost.

### Q-07: Supplier Directory List
- **Tenant Scope:** Store-scoped (`stores/{storeId}/suppliers`)
- **Filters:** `isArchived == false`
- **Sorting:** `name ASC`
- **Cursor Boundary:** `(name, __name__)`
- **Max Page Size:** 50 suppliers
- **Required Composite Index:** `isArchived ASC`, `name ASC`
- **Authorization:** `supplier.read` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Expected Read Behavior:** Supplier directory list view.
- **Cost / Contention Risk:** Minimal cost.

### Q-08: Supplier Account Ledger Statement
- **Tenant Scope:** Store-scoped (`stores/{storeId}/supplierLedger`)
- **Filters:** `supplierId == {id}`, `createdAt >= {startDate}`
- **Sorting:** `createdAt DESC`
- **Cursor Boundary:** `(createdAt DESC, __name__ DESC)`
- **Max Page Size:** 50 records
- **Required Composite Index:** `supplierId ASC`, `createdAt DESC`
- **Authorization:** `supplier.read` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Expected Read Behavior:** Account statement statement calculation.
- **Cost / Contention Risk:** Low read cost.

### Q-09: Purchase Orders Status Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/purchaseOrders`)
- **Filters:** `status == {status}`, `supplierId == {supId}`
- **Sorting:** `issuedAt DESC`
- **Cursor Boundary:** `(issuedAt DESC, __name__ DESC)`
- **Max Page Size:** 25 orders
- **Required Composite Index:** `supplierId ASC`, `status ASC`, `issuedAt DESC`
- **Authorization:** `po.create` (`OWNER`, `MANAGER`)
- **Expected Read Behavior:** Purchasing register list view.
- **Cost / Contention Risk:** Low read cost.

### Q-10: Doctor Registry Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/doctors`)
- **Filters:** `isActive == true`
- **Sorting:** `name ASC`
- **Cursor Boundary:** `(name, __name__)`
- **Max Page Size:** 50 doctors
- **Required Composite Index:** `isActive ASC`, `name ASC`
- **Authorization:** `doctor.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Expected Read Behavior:** POS doctor dropdown picker.
- **Cost / Contention Risk:** Minimal cost.

### Q-11: Employee Roster Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/employees`)
- **Filters:** `status == 'ACTIVE'`
- **Sorting:** `fullName ASC`
- **Cursor Boundary:** `(fullName, __name__)`
- **Max Page Size:** 50 employees
- **Required Composite Index:** `status ASC`, `fullName ASC`
- **Authorization:** `employee.read` (`OWNER`, `MANAGER`)
- **Expected Read Behavior:** Employee management page.
- **Cost / Contention Risk:** Minimal cost.

### Q-12: Employee Ledger Transactions Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/employeeLedger`)
- **Filters:** `employeeId == {id}`
- **Sorting:** `createdAt DESC`
- **Cursor Boundary:** `(createdAt DESC, __name__ DESC)`
- **Max Page Size:** 50 records
- **Required Composite Index:** `employeeId ASC`, `createdAt DESC`
- **Authorization:** `employee.read` (`OWNER`, `MANAGER`)
- **Expected Read Behavior:** Salary advance statement history.
- **Cost / Contention Risk:** Low read cost.

### Q-13: Store Expense Register Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/expenses`)
- **Filters:** `category == {cat}`, `expenseDate >= {startDate}`
- **Sorting:** `expenseDate DESC`
- **Cursor Boundary:** `(expenseDate DESC, __name__ DESC)`
- **Max Page Size:** 50 expenses
- **Required Composite Index:** `category ASC`, `expenseDate DESC`
- **Authorization:** `expense.read` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Expected Read Behavior:** Expense report filter view.
- **Cost / Contention Risk:** Low read cost.

### Q-14: Bill History Register Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/invoices`)
- **Filters:** `status == {status}`, `createdAt >= {startDate}`, `createdAt <= {endDate}`
- **Sorting:** `createdAt DESC`
- **Cursor Boundary:** `(createdAt DESC, __name__ DESC)`
- **Max Page Size:** 50 invoices
- **Required Composite Index:** `status ASC`, `createdAt DESC`
- **Authorization:** `bill.read` (`OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT`)
- **Expected Read Behavior:** Billing history register page.
- **Cost / Contention Risk:** Medium read cost; indexed filter prevents table scans.

### Q-15: Pending Approval Requests Queue Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/approvalRequests`)
- **Filters:** `status == 'PENDING'`, `expiresAt > {now}`
- **Sorting:** `createdAt DESC`
- **Cursor Boundary:** `(createdAt DESC, __name__ DESC)`
- **Max Page Size:** 20 requests
- **Required Composite Index:** `status ASC`, `expiresAt ASC`
- **Authorization:** `bill.refund` (`OWNER`, `MANAGER`, `PHARMACIST`)
- **Expected Read Behavior:** OTP request status validation.
- **Cost / Contention Risk:** Low read cost.

### Q-16: Refund History Register Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/refunds`)
- **Filters:** `createdAt >= {startDate}`, `createdAt <= {endDate}`
- **Sorting:** `createdAt DESC`
- **Cursor Boundary:** `(createdAt DESC, __name__ DESC)`
- **Max Page Size:** 50 records
- **Required Composite Index:** Single field range on `createdAt DESC`
- **Authorization:** `bill.read` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Expected Read Behavior:** Refund audit log review.
- **Cost / Contention Risk:** Low cost.

### Q-17: Daily Aggregate Summaries Range Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/dailySummaries`)
- **Filters:** `dateKey >= {startDateKey}`, `dateKey <= {endDateKey}`
- **Sorting:** `dateKey ASC`
- **Cursor Boundary:** `(dateKey ASC)`
- **Max Page Size:** 31 records (1 month)
- **Required Composite Index:** Single field range on `dateKey`
- **Authorization:** `report.financial` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Expected Read Behavior:** Executive dashboard & report compilation.
- **Cost / Contention Risk:** Extremely low read cost (max 31 documents).

### Q-18: Daily Closings Register Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/dailyClosings`)
- **Filters:** `dateKey >= {startDateKey}`
- **Sorting:** `dateKey DESC`
- **Cursor Boundary:** `(dateKey DESC)`
- **Max Page Size:** 30 records
- **Required Composite Index:** Single field range on `dateKey DESC`
- **Authorization:** `store.update` (`OWNER`, `MANAGER`)
- **Expected Read Behavior:** Register closing history view.
- **Cost / Contention Risk:** Minimal cost.

### Q-19: Report Export Jobs Status Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/reportJobs`)
- **Filters:** `createdBy == {uid}`
- **Sorting:** `createdAt DESC`
- **Cursor Boundary:** `(createdAt DESC, __name__ DESC)`
- **Max Page Size:** 10 jobs
- **Required Composite Index:** `createdBy ASC`, `createdAt DESC`
- **Authorization:** `report.financial` (`OWNER`, `MANAGER`, `ACCOUNTANT`)
- **Expected Read Behavior:** Asynchronous report export progress monitor.
- **Cost / Contention Risk:** Minimal cost.

### Q-20: CSV Import Jobs Status Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/importJobs`)
- **Filters:** `status == {status}`
- **Sorting:** `createdAt DESC`
- **Cursor Boundary:** `(createdAt DESC, __name__ DESC)`
- **Max Page Size:** 10 jobs
- **Required Composite Index:** `status ASC`, `createdAt DESC`
- **Authorization:** `import.execute` (`OWNER`, `MANAGER`)
- **Expected Read Behavior:** Bulk import status check.
- **Cost / Contention Risk:** Minimal cost.

### Q-21: Audit Log Viewer Filtering Query
- **Tenant Scope:** Store-scoped (`stores/{storeId}/auditLogs`)
- **Filters:** `eventName == {event}`, `timestamp >= {startTime}`
- **Sorting:** `timestamp DESC`
- **Cursor Boundary:** `(timestamp DESC, __name__ DESC)`
- **Max Page Size:** 100 entries
- **Required Composite Index:** `eventName ASC`, `timestamp DESC`
- **Authorization:** `audit.read` (`OWNER`, `MANAGER`)
- **Expected Read Behavior:** Admin audit trail viewer.
- **Cost / Contention Risk:** Low read cost.

### Q-22: Email Outbox Worker Queue Query
- **Tenant Scope:** Root level / Worker Scope (`outbox`)
- **Filters:** `status == 'PENDING'`, `attempts < 3`
- **Sorting:** `createdAt ASC`
- **Cursor Boundary:** `(createdAt ASC, __name__)`
- **Max Page Size:** 25 items
- **Required Composite Index:** `status ASC`, `attempts ASC`, `createdAt ASC`
- **Authorization:** Backend Outbox Worker (Admin SDK)
- **Expected Read Behavior:** Executed by background email delivery worker.
- **Cost / Contention Risk:** Low cost; worker process handles retries with backoff.

---

## 2. Production `firestore.indexes.json` (7 Composite Indexes)

```json
{
  "indexes": [
    {
      "collectionGroup": "medicines",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isArchived", "order": "ASCENDING" },
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "brandName", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "batches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "medicineId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "expiryDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "purchaseOrders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "supplierId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "issuedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "stockLedger",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "medicineId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "eventName", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "outbox",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "attempts", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```
