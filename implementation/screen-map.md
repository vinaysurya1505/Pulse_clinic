# UI Screen Map and Interface Specifications

This document details every screen, view, modal, and major UI state in the Pharmacy AI Agent web application in accordance with Pack 1.2 specifications, Prompt 1A corrections, and the authoritative 30-prompt milestone map.

---

## 1. Authentication & Onboarding Screens

### 1.1 Sign-In Screen
- **Route:** `/auth/signin`
- **Permitted Roles:** Unauthenticated Public
- **Main Actions:** Click "Sign in with Google", View System Health Badge.
- **Main Data:** App branding, Google Auth button, system health badge.
- **Filters:** None.
- **Empty State:** N/A.
- **Loading State:** Google Auth popup pending state; button disabled with spinner.
- **Error State:** "Authentication Failed", "Domain Not Allowed", or "Account Disabled" alert banner.
- **Mobile / Tablet Consideration:** Centered single-column layout, touch-friendly Google Sign-In button (min height 48px).
- **Keyboard Workflow:** `Tab` focus on Sign In button -> `Enter` / `Space` triggers OAuth flow.
- **Related Prompt:** Prompt 4.

### 1.2 Store Onboarding & Switcher Modal
- **Route:** `/onboarding/store-select`
- **Permitted Roles:** Authenticated User without active store selection
- **Main Actions:** Select Store from assigned store list, Click "Create New Store" (Super Admin / Owner).
- **Main Data:** User profile summary, list of assigned store memberships (Store Name, Role, Location).
- **Filters:** Search stores by name or store ID.
- **Empty State:** "No active store memberships found. Contact your administrator or create a new store."
- **Loading State:** Skeleton card loaders while fetching member stores.
- **Error State:** "Failed to load store list. Retry button provided."
- **Mobile / Tablet Consideration:** Full-screen card list with touch selection.
- **Keyboard Workflow:** `Tab` through store cards -> `Enter` to select store and set active context.
- **Related Prompt:** Prompt 5.

---

## 2. Dashboard & Overview

### 2.1 Executive Store Dashboard
- **Route:** `/dashboard`
- **Permitted Roles:** `Owner`, `Manager`, `Pharmacist`, `Accountant` (role-masked view)
- **Main Actions:** Quick Link to New Bill, View Daily Sales Summary, Check Expiry Alerts, View Shortage Warnings.
- **Main Data:** Today's Total Sales (Paise -> ₹), Net Revenue, Transaction Count, Low Stock Counter, Expiry Warning Counter, Recent Invoices table.
- **Filters:** Date range picker (Today, Yesterday, Last 7 Days, This Month).
- **Empty State:** "No sales recorded today yet. Click 'New Bill' to start billing."
- **Loading State:** Skeleton metrics grid and table row placeholders.
- **Error State:** "Unable to fetch dashboard metrics. Refresh button available."
- **Mobile / Tablet Consideration:** Responsive grid collapses to 1-column on mobile, 2-column on tablet.
- **Keyboard Workflow:** `Alt+N` opens New Bill modal immediately; `Tab` cycles KPI cards.
- **Related Prompt:** Prompt 3, Prompt 20.

---

## 3. POS Billing & Invoicing Screens

### 3.1 Cashier Billing Terminal (POS)
- **Route:** `/billing/new`
- **Permitted Roles:** `Owner`, `Manager`, `Pharmacist`
- **Main Actions:** Search medicine, FEFO batch auto-selection, enter quantity (pack/strip/unit), apply discount, select prescribing doctor, select payment mode (Cash, UPI, Card), Click "Finalize & Print".
- **Main Data:** Cart item table (Name, Batch, Expiry, MRP, Price, Qty, Tax, Line Total), Subtotal, CGST, SGST, IGST, Discount, Net Payable (Paise), Customer Name/Phone (optional), Prescribing Doctor.
- **Filters:** Medicine search input (auto-complete by brand name, generic name, barcode, composition).
- **Empty State:** "Cart is empty. Type medicine name or scan barcode to add items."
- **Loading State:** Medicine search spinner; Bill finalization overlay spinner.
- **Error State:** "Insufficient Stock", "Batch Expired", "Price Mis-match" toast alert banner.
- **Mobile / Tablet Consideration:** Optimized for Tablet POS screens (10-inch split layout: search left, cart right). Touch-friendly quantity increment buttons.
- **Keyboard Workflow:**
  - `F2` or `/`: Focus Medicine Search
  - `ArrowDown` / `ArrowUp`: Navigate search results -> `Enter`: Add to cart
  - `F4`: Select Payment Mode
  - `F8`: Enter Discount
  - `F10` or `Ctrl+Enter`: Finalize Bill & Trigger Print
  - `Esc`: Clear cart / cancel modal
- **Related Prompt:** Prompt 11, Prompt 12, Prompt 13, Prompt 14.

### 3.2 Invoices & Bills Register
- **Route:** `/billing/history`
- **Permitted Roles:** `Owner`, `Manager`, `Pharmacist`, `Accountant`
- **Main Actions:** Search invoices, View Invoice Detail Drawer, Download A4 Invoice PDF, Open Browser Print for 80mm Receipt, Click "Request Refund / Cancellation".
- **Main Data:** Invoice Number, Date, Customer Name, Payment Status (Finalized, Refunded, Cancelled), Payment Mode Split, Grand Total.
- **Filters:** Invoice Number search, Date range filter, Payment Status filter.
- **Empty State:** "No invoices found matching the selected filters."
- **Loading State:** Shimmer table rows.
- **Error State:** "Error loading invoice history."
- **Mobile / Tablet Consideration:** Horizontal scrollable table with sticky Invoice ID column.
- **Keyboard Workflow:** `Tab` through invoice list -> `Enter` opens Invoice Detail drawer.
- **Related Prompt:** Prompt 15, Prompt 16.

---

## 4. Inventory & Stock Management Screens

### 4.1 Medicine Master Catalog
- **Route:** `/inventory/medicines`
- **Permitted Roles:** `Owner`, `Manager`, `Pharmacist`
- **Main Actions:** Add New Medicine, Edit Medicine Details, View Stock Batches, Toggle Loose Sales Allowed, View Schedule H/H1/X flag.
- **Main Data:** Brand Name, Generic Composition, Category, Rack/Shelf Location, HSN Code, GST Slab %, Base Unit, Pack Size (`stripSize`), Total Available Stock Units, Schedule flag.
- **Filters:** Category filter, Search by Brand/Generic, Stock Availability filter (In Stock, Low Stock, Out of Stock).
- **Empty State:** "No medicines registered in catalog. Click 'Add Medicine' or 'Import CSV'."
- **Loading State:** Skeleton table rows.
- **Error State:** "Failed to load medicine master list."
- **Mobile / Tablet Consideration:** Compact card view for mobile; table view for desktop.
- **Keyboard Workflow:** `Alt+A` triggers Add Medicine modal; `Tab` navigates input fields.
- **Related Prompt:** Prompt 6.

### 4.2 FEFO Batch & Expiry Tracker
- **Route:** `/inventory/batches`
- **Permitted Roles:** `Owner`, `Manager`, `Pharmacist`
- **Main Actions:** View Batch List, Execute Manual Stock Adjustment (requires reason & authorization), View Expiry Status.
- **Main Data:** Medicine Name, Batch Number, Manufacturing Date, Expiry Date, Purchase Rate (Paise), MRP (Paise), Selling Price (Paise), Pack Stock, Base Unit Stock, Status (Active, Expiring Soon, Expired).
- **Filters:** Expiry Window filter (Expired, < 30 Days, < 60 Days, < 90 Days), Search by Batch Number or Medicine.
- **Empty State:** "No inventory batches matching selected criteria."
- **Loading State:** Shimmer table rows.
- **Error State:** "Error loading batch inventory."
- **Mobile / Tablet Consideration:** Color-coded status badges (Red = Expired, Amber = Near Expiry, Green = Valid).
- **Keyboard Workflow:** `Tab` cycles batch rows; `Enter` opens Batch Detail modal.
- **Related Prompt:** Prompt 7.

### 4.3 Bulk Inventory CSV Imports
- **Route:** `/imports/csv`
- **Permitted Roles:** `Owner`, `Manager`
- **Main Actions:** Select Import Type (Medicines, Employees, Suppliers), Download Template CSV, Drag-and-Drop CSV file, Preview CSV Data Grid, Click "Start Import", Download Error Log CSV.
- **Main Data:** Active Import Jobs, File Name, Status (Queued, Processing, Completed, Failed), Rows Processed / Total Rows, Success Count, Error Count, Real-Time Progress Bar.
- **Filters:** Job status filter.
- **Empty State:** "No past import jobs found."
- **Loading State:** Real-time animated progress bar showing chunk ingestion progress (`X of Y rows processed`).
- **Error State:** "File Validation Error: Invalid header columns" or itemized table of rejected rows.
- **Mobile / Tablet Consideration:** Full file dropzone view with clear file picker button.
- **Keyboard Workflow:** `Tab` to file picker button -> `Space` opens file explorer.
- **Related Prompt:** Prompt 8.

---

## 5. Procurement & Purchasing Screens

### 5.1 Purchase Orders & GRN Receiving
- **Route:** `/purchases`
- **Permitted Roles:** `Owner`, `Manager`
- **Main Actions:** Create Purchase Order, Select Supplier, Add PO Line Items (Medicine, Qty, Cost), Mark PO as Issued, Receive GRN Stock (Enter Batch No, Expiry Date, Invoice No, Selling Price), Cancel PO.
- **Main Data:** PO Number, Supplier Name, Date Issued, Total Value (Paise), Status (Draft, Issued, Received, Cancelled), Goods Received Note (GRN) details.
- **Filters:** Status filter, Supplier filter, Date range.
- **Empty State:** "No purchase orders found."
- **Loading State:** Skeleton table rows.
- **Error State:** "Failed to load purchase orders."
- **Mobile / Tablet Consideration:** Split view: PO Header top, Line Items bottom modal.
- **Keyboard Workflow:** `Alt+P` creates new PO; `Tab` cycles line item grid.
- **Related Prompt:** Prompt 9.

### 5.2 Supplier Directory & Accounts
- **Route:** `/suppliers`
- **Permitted Roles:** `Owner`, `Manager`, `Accountant`
- **Main Actions:** Add Supplier, Edit Contact Details, View Supplier Ledger Statement, Record Supplier Payment.
- **Main Data:** Supplier Name, GSTIN, Contact Person, Phone, Email, Address, Payment Terms (Days), Current Ledger Balance (Paise).
- **Filters:** Search supplier by name or GSTIN; Balance filter (All, Outstanding Only).
- **Empty State:** "No suppliers registered."
- **Loading State:** Skeleton list cards.
- **Error State:** "Error loading supplier directory."
- **Mobile / Tablet Consideration:** Compact card layout with direct "Call / Email" actions.
- **Keyboard Workflow:** `Tab` through supplier list; `Enter` opens Supplier Payment modal.
- **Related Prompt:** Prompt 9.

---

## 6. Doctor, Employee & Expense Screens

### 6.1 Doctor Registry
- **Route:** `/doctors`
- **Permitted Roles:** `Owner`, `Manager`, `Pharmacist`
- **Main Actions:** Add Doctor, Edit Details, View Associated Invoices, Check Commission Status (Configurable & disabled by default).
- **Main Data:** Doctor Name, Medical Registration Number, Specialization, Contact Phone, Prescriptions Linked, Commission Status (`DISABLED_BY_DEFAULT`).
- **Filters:** Search by Doctor Name or Reg Number.
- **Empty State:** "No doctors registered."
- **Loading State:** Skeleton rows.
- **Error State:** "Error loading doctor registry."
- **Mobile / Tablet Consideration:** Mobile card list view.
- **Keyboard Workflow:** `Tab` cycles doctor entries; `Alt+D` adds new doctor.
- **Related Prompt:** Prompt 10.

### 6.2 Employee Management & Roles
- **Route:** `/employees`
- **Permitted Roles:** `Owner`, `Manager`
- **Main Actions:** Add Employee, Assign Role (`Manager`, `Pharmacist`, `Accountant`), Deactivate Access, View Approved Masked PII (`aadhaarLastFour`, `panLastFour`), Post Salary Advance / Repayment.
- **Main Data:** Employee Name, Email, Phone, Assigned Role, Status (Active, Suspended), Masked Aadhaar (`XXXX-XXXX-1234`), Masked PAN (`XXXXX1234X`), Salary Advance Balance (Paise).
- **Filters:** Role filter, Status filter (Active, Suspended).
- **Empty State:** "No employees found."
- **Loading State:** Skeleton card rows.
- **Error State:** "Error loading employee roster."
- **Mobile / Tablet Consideration:** Touch-friendly role selector dropdown.
- **Keyboard Workflow:** `Tab` navigates employee cards -> `Enter` opens Role Edit drawer.
- **Related Prompt:** Prompt 10, Prompt 19.

### 6.3 Store Expenses & Cash Register
- **Route:** `/expenses`
- **Permitted Roles:** `Owner`, `Manager`, `Accountant`
- **Main Actions:** Log Petty Expense, Select Category (Rent, Utilities, Maintenance), Open Daily Cash Drawer, Close Daily Cash Drawer (Enter Physical Cash Count).
- **Main Data:** Expense Date, Category, Amount (Paise), Description, Cash Drawer Opening Balance, Total Cash Sales, Total Cash Expenses, Physical Closing Cash, Discrepancy Amount.
- **Filters:** Category filter, Date range.
- **Empty State:** "No expenses logged for this date range."
- **Loading State:** Skeleton list.
- **Error State:** "Error fetching expense records."
- **Mobile / Tablet Consideration:** Touch keypad modal for cash drawer count entry.
- **Keyboard Workflow:** `Alt+E` opens New Expense modal; `Enter` submits cash count.
- **Related Prompt:** Prompt 19.

---

## 7. Financial Reports & Compliance Screens

### 7.1 Financial Reports Dashboard
- **Route:** `/reports/financial`
- **Permitted Roles:** `Owner`, `Manager`, `Accountant`
- **Main Actions:** Generate Daily Sales Report, Monthly Summary, Tax Breakdown, Download CSV Export, Download PDF Report.
- **Main Data:** Gross Revenue, Discount Total, Net Taxable Value, CGST Total, SGST Total, IGST Total, Net Revenue, Payment Mode Split (Cash, UPI, Card).
- **Filters:** Date range picker (Custom Date Range, Month, Quarter).
- **Empty State:** "Select date range and click 'Generate Report'."
- **Loading State:** Animated report generation chart and summary skeleton.
- **Error State:** "Report Generation Error: Date range exceeds maximum limit of 365 days."
- **Mobile / Tablet Consideration:** Stacked summary cards with full-width export buttons.
- **Keyboard Workflow:** `Tab` through date inputs -> `Enter` triggers report compilation.
- **Related Prompt:** Prompt 21.

### 7.2 GST Compliance & Return Filing (GSTR-1 / GSTR-3B)
- **Route:** `/reports/gst`
- **Permitted Roles:** `Owner`, `Manager`, `Accountant`
- **Main Actions:** View Monthly GST Tax Liability, Compile HSN Summary Table, Export GSTR-1 CSV.
- **Main Data:** B2C Invoices Summary, B2B Invoices Summary, HSN Code, Description, Total Quantity, Taxable Value, CGST Rate %, SGST Rate %, IGST Rate %, Total Tax.
- **Filters:** Tax Month Selection (e.g. September 2026).
- **Empty State:** "No tax records found for selected month."
- **Loading State:** Spinner overlay during HSN aggregate calculations.
- **Error State:** "GST Compilation Error: Unassigned HSN code detected."
- **Mobile / Tablet Consideration:** Desktop-optimized layout; warning banner on mobile screens.
- **Keyboard Workflow:** `Tab` through export options -> `Enter` downloads file.
- **Related Prompt:** Prompt 21.

---

## 8. Approvals & System Administration Screens

### 8.1 Cancellation & Refund Approval Code Modal
- **Route:** Overlay Modal on `/billing/history`
- **Permitted Roles:** `Owner`, `Manager`, `Pharmacist` (Operator enters code; Super Admin receives code via email)
- **Main Actions:** Click "Request Approval Code", Enter 8-Character Approval Code received from Super Admin, Click "Confirm Reversal & Refund".
- **Main Data:** Original Invoice Summary (ID, Amount, Customer), Refund Type (Full / Partial), Refund Reason, OTP Input Box (8 characters, formatted `XXXX-XXXX`), Expiry Countdown Timer (15:00 minutes).
- **Filters:** N/A.
- **Empty State:** N/A.
- **Loading State:** "Sending Approval Code to Super Admin Email..." spinner; "Verifying Approval Code..." overlay.
- **Error State:** "Invalid or Expired Approval Code (Attempt 1 of 3)", "Max Attempts Exceeded - Request New Code".
- **Mobile / Tablet Consideration:** High-contrast OTP touch keyboard layout.
- **Keyboard Workflow:** Auto-focus on OTP input; `Enter` submits code; `Esc` dismisses modal.
- **Related Prompt:** Prompt 17, Prompt 18.

### 8.2 System Audit Log Explorer
- **Route:** `/admin/audit-logs`
- **Permitted Roles:** `Owner`, `Manager`
- **Main Actions:** Search Audit Logs, View Event Details JSON Payload, Export Audit Log CSV.
- **Main Data:** Timestamp, Actor UID, Actor Role, Event Name (`BILL_CANCELLED`, `STOCK_ADJUSTED`, `ROLE_UPDATED`), IP Address, Affected Entity Path, Change Summary.
- **Filters:** Event Type filter, Actor filter, Date range.
- **Empty State:** "No audit events logged matching the selected filters."
- **Loading State:** Skeleton table rows.
- **Error State:** "Error loading system audit logs."
- **Mobile / Tablet Consideration:** Responsive JSON viewer modal for event payload inspection.
- **Keyboard Workflow:** `Tab` cycles audit log rows; `Enter` expands detailed JSON payload.
- **Related Prompt:** Prompt 23.
