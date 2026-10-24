# Role-Based Access Control (RBAC) & Permission Matrix

This document details the permission matrix using named fine-grained permissions across all system roles in accordance with Pack 1.2 specifications, Prompt 1A corrections, and the authoritative 30-prompt milestone map.

---

## 1. System Roles Overview

| Role Code | Role Name | System Scope | Summary Description |
| --------- | --------- | ------------ | ------------------- |
| `SUPER_ADMIN` | Platform Super Admin | Platform-wide | System administration, tenant store provisioning, receiving approval codes via email. **Cannot alter completed store invoices or bypass reversal ledgers.** |
| `OWNER` | Store Owner / Admin | Store-wide | Full administrative control within assigned store tenant, employee management, financial reports, configuration. |
| `MANAGER` | Store Manager | Store-wide | Operational management within assigned store tenant, purchase orders, inventory adjustments, employee roster. |
| `PHARMACIST` | Pharmacist / Operator | Store-wide | POS billing, medicine lookup, inventory lookup, entering approval codes for refunds/cancellations. |
| `ACCOUNTANT` | Accountant / Viewer | Store-wide | **Strictly read-only access** to financial ledgers, GST reports, daily summaries, invoice history, and audit logs. |

---

## 2. Explicit Security Confirmations

The architecture enforces the following non-negotiable security guarantees:

1. **Super Admin Invariant A:** Super Admin **cannot alter completed invoices**. Direct mutation of completed invoice documents is blocked by Firestore Security Rules for all roles including Super Admin.
2. **Super Admin Invariant B:** Super Admin **cannot bypass reversal ledgers**. Reversals require an explicit ledger entry generated server-side.
3. **Approval Code Workflow Confirmation:**
   - **Operator (Pharmacist/Manager/Owner)** requests cancellation/refund in the application screen.
   - **Backend Service** generates the 8-character OTP code and HMAC hash.
   - **Super Admin** receives the code at the verified Super Admin email address via outbox worker.
   - **Operator** enters the code into the cancellation modal.
   - **Backend Service** verifies the HMAC hash, checks expiry (15 mins) and attempt counter (max 3), and executes the atomic reversal.
4. **Accountant Read-Only Confirmation:** The `ACCOUNTANT` role is **strictly read-only** across all endpoints and Firestore paths. All `POST`, `PUT`, `PATCH`, `DELETE` operations are rejected.

---

## 3. Named Permission Matrix

| Named Permission | Category | Allowed Roles | API Enforcement Point | Firestore / Storage Security Rule | Audit Required | Additional Approval Required | Related Test Suite & Prompt |
| ---------------- | -------- | ------------- | --------------------- | --------------------------------- | -------------- | ---------------------------- | --------------------------- |
| `store.read` | Store | `OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT` | `GET /api/v1/stores/:storeId` | `allow read: if isStoreMember(storeId)` | No | No | `auth-tenant.test.ts` (Prompt 5) |
| `store.update` | Store | `OWNER` | `PUT /api/v1/stores/:storeId` | `allow update: if isStoreOwner(storeId)` | Yes | No | `store-admin.test.ts` (Prompt 5) |
| `bill.create` | Billing | `OWNER`, `MANAGER`, `PHARMACIST` | `POST /api/v1/bills` | `allow create: if isStoreStaff(storeId)` | Yes | No | `billing-engine.test.ts` (Prompt 13) |
| `bill.read` | Billing | `OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT` | `GET /api/v1/bills` | `allow read: if isStoreMember(storeId)` | No | No | `billing-history.test.ts` (Prompt 16) |
| `bill.cancel` | Billing | `OWNER`, `MANAGER`, `PHARMACIST` | `POST /api/v1/bills/:id/refund` | `allow update: if false;` *(Backend Only via Admin SDK)* | Yes | **Yes (Backend OTP Code)** | `refund-approval.test.ts` (Prompt 17, 18) |
| `bill.refund` | Billing | `OWNER`, `MANAGER`, `PHARMACIST` | `POST /api/v1/bills/:id/refund` | `allow update: if false;` *(Backend Only via Admin SDK)* | Yes | **Yes (Backend OTP Code)** | `refund-approval.test.ts` (Prompt 17, 18) |
| `inventory.read` | Inventory | `OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT` | `GET /api/v1/inventory/medicines` | `allow read: if isStoreMember(storeId)` | No | No | `inventory.test.ts` (Prompt 6, 7) |
| `inventory.write` | Inventory | `OWNER`, `MANAGER` | `POST /api/v1/inventory/medicines` | `allow create, update: if isStoreManager(storeId)` | Yes | No | `inventory-crud.test.ts` (Prompt 6) |
| `inventory.adjust` | Inventory | `OWNER`, `MANAGER` | `POST /api/v1/inventory/adjustments` | `allow update: if false;` *(Backend Only)* | Yes | No | `inventory-adjust.test.ts` (Prompt 7) |
| `import.execute` | Data Import | `OWNER`, `MANAGER` | `POST /api/v1/imports/csv/commit` | `allow create: if isStoreManager(storeId)` | Yes | No | `csv-import.test.ts` (Prompt 8) |
| `po.create` | Purchasing | `OWNER`, `MANAGER` | `POST /api/v1/purchases` | `allow create: if isStoreManager(storeId)` | Yes | No | `purchase-order.test.ts` (Prompt 9) |
| `po.receive` | Purchasing | `OWNER`, `MANAGER` | `POST /api/v1/purchases/:id/receive` | `allow update: if false;` *(Backend Only)* | Yes | No | `grn-receipt.test.ts` (Prompt 9) |
| `doctor.read` | Doctors | `OWNER`, `MANAGER`, `PHARMACIST`, `ACCOUNTANT` | `GET /api/v1/doctors` | `allow read: if isStoreMember(storeId)` | No | No | `doctor.test.ts` (Prompt 10) |
| `doctor.write` | Doctors | `OWNER`, `MANAGER` | `POST /api/v1/doctors` | `allow create, update: if isStoreManager(storeId)` | Yes | No | `doctor.test.ts` (Prompt 10) |
| `employee.read` | Employees | `OWNER`, `MANAGER` | `GET /api/v1/employees` | `allow read: if isStoreManager(storeId)` | No | No | `employee-rbac.test.ts` (Prompt 10) |
| `employee.write` | Employees | `OWNER` | `POST /api/v1/employees` | `allow create, update: if isStoreOwner(storeId)` | Yes | No | `employee-rbac.test.ts` (Prompt 10) |
| `expense.read` | Expenses | `OWNER`, `MANAGER`, `ACCOUNTANT` | `GET /api/v1/expenses` | `allow read: if isStoreMember(storeId)` | No | No | `expenses.test.ts` (Prompt 19) |
| `expense.write` | Expenses | `OWNER`, `MANAGER` | `POST /api/v1/expenses` | `allow create: if isStoreManager(storeId)` | Yes | No | `expenses.test.ts` (Prompt 19) |
| `report.financial` | Reports | `OWNER`, `MANAGER`, `ACCOUNTANT` | `GET /api/v1/reports/financial` | `allow read: if isStoreMember(storeId)` | Yes | No | `financial-reports.test.ts` (Prompt 21) |
| `report.gst` | Reports | `OWNER`, `MANAGER`, `ACCOUNTANT` | `GET /api/v1/reports/gst` | `allow read: if isStoreMember(storeId)` | Yes | No | `gst-engine.test.ts` (Prompt 21) |
| `audit.read` | Audit Logs | `OWNER`, `MANAGER` | `GET /api/v1/admin/audit-logs` | `allow read: if isStoreOwner(storeId)` | Yes | No | `audit-logs.test.ts` (Prompt 23) |

---

## 4. Middleware Permission Enforcement Logic

```typescript
// Enforces named permission check in Express API middleware
export const requirePermission = (permission: NamedPermission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { userRole } = req.authContext;
    const allowedRoles = PERMISSION_ROLE_MAP[permission];

    if (!allowedRoles || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `Role ${userRole} is not granted permission ${permission}.`,
        },
      });
    }

    return next();
  };
};
```
