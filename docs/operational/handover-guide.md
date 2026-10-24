# PulseClinic Pharmacy Management System — Operational Handover Guide

## 1. System Overview & Architecture
PulseClinic is an enterprise multi-tenant Pharmacy Management and POS System built with:
- **Frontend:** Next.js 14, React 18, pure high-contrast light theme (`#ffffff`, `#f8fafc`, `#e2e8f0`, `#0f172a`), WCAG 2.1 AA accessibility.
- **Backend:** Node.js, Express, TypeScript, Firebase Admin SDK.
- **Database:** Google Cloud Firestore (Multi-tenant subcollections under `stores/{storeId}`).
- **Security:** OWASP Helmet headers, DPDP PII encryption & masking, rate limiting, HMAC-SHA256 refund OTP verification.
- **Monetary Calculation:** 100% integer arithmetic in paise (`*Paise`) and basis points (`*Bps`) — zero floating-point drift.

---

## 2. Default Store & Super Admin Access
- **Primary Store Tenant:** `pulseclinic-main`
- **Store Name:** PulseClinic Pharmacy
- **Store GSTIN:** `29AABCU9603R1ZM` (Karnataka, State Code: 29)
- **Role Hierarchy:**
  - `OWNER` / `SUPER_ADMIN`: Full administrative control, refund OTP approval, audit log explorer, daily closing override.
  - `MANAGER`: Stock adjustments, purchase order verification, reports compiler.
  - `CASHIER` / `BILLER`: POS billing, item search, split payment collection, customer receipt printing.

---

## 3. Cashier POS Terminal Quick Reference (`/billing/new`)

| Key Shortcut | Action | Description |
| :--- | :--- | :--- |
| **`F2`** or **`/`** | Focus Search | Jump directly to medicine brand / generic name barcode input. |
| **`ArrowDown` / `ArrowUp`** | Select Result | Navigate autocomplete list without touching mouse. |
| **`Enter`** | Add to Cart | Select batch (ordered First-Expiry-First-Out) and insert into line items. |
| **`F4`** | Open Payment | Jump directly to Split Payment modal with exact paise calculation. |
| **`F10`** or **`Ctrl+Enter`** | Finalize Bill | Commit sequential monotonic invoice generation and decrement stock. |
| **`Escape`** | Close | Dismiss payment modal, search dropdown, or receipt view. |

---

## 4. Refund & Cancellation Protocol
1. Cashier locates bill in **Bill History** (`/billing/history`).
2. Clicks **Request Refund** and inputs return reason.
3. System generates an 8-character uppercase OTP (`[A-Z0-9]{8}`) and delivers an encrypted notification to the Store Owner's email.
4. Store Owner provides OTP after inspecting returned sealed goods.
5. Cashier enters OTP in verification modal.
6. System verifies HMAC-SHA256 signature, restores batch inventory stock, writes `SALE_RETURN` movement to `stockLedger`, and logs `INVOICE_REFUNDED` in immutable audit logs.

---

## 5. End-of-Day Register Reconciliation & Closing
1. Navigate to **Expenses & Cash Drawer** (`/expenses`).
2. Verify Opening Cash Float + Net Cash Sales - Petty Expenses = **Expected Drawer Cash**.
3. Input physical cash count.
4. Execute **Reconcile & Close Register** to lock register for the business date.
5. Navigate to **Dashboard** (`/dashboard`) to view today's Net Revenue, Gross Sales, and low-stock summaries.

---

## 6. Month-End GSTR-1 Tax Return Filing
1. Navigate to **GST Reports** (`/reports/gst`).
2. Select monthly date range (e.g. `2026-10-01` to `2026-10-31`).
3. Click **Generate GSTR-1**.
4. Inspect Table 12 HSN outward supplies summary by HSN Code and GST rate (5%, 12%, 18%).
5. Click **Download GST Portal CSV** to export government portal-ready CSV format.
