# Milestone Plan (Prompts 1 to 30 Execution Roadmap)

This document establishes the authoritative execution roadmap across all 30 prompts for building the Pharmacy AI Agent application in accordance with Pack 1.2 specifications and Prompt 1A corrections.

---

## Part 1: Toolchain, Auth, Master Catalog, Inventory & Core Entities (Prompts 1 – 10)

### Prompt 1 — Engineering Blueprint and Implementation Controls
- **Objective:** Establish the complete engineering blueprint, requirement traceability matrix, ADR index, risk register, milestone plan, definition of done, screen map, RBAC matrix, API inventory, Firestore query plan, and open decisions index.
- **Inputs:** Pack 1.2 files (`00-README.md` through `06-30-PROMPTS.md`, `.env.example`, CSV templates).
- **Expected Files/Modules:** `docs/implementation/requirements-traceability.md`, `decisions.md`, `risks.md`, `milestone-plan.md`, `definition-of-done.md`, `screen-map.md`, `role-permission-matrix.md`, `api-inventory.md`, `firestore-query-index-plan.md`, `open-decisions.md`, `diagrams.md`.
- **Dependencies:** None (Prompt 0, 0A, 0B approval).
- **Tests:** Documentation cross-reference validation, prompt mapping audit.
- **Demo / Verification:** Approval report demonstrating 100% requirement coverage without creating application code.
- **Completion Gate:** Formal sign-off on Prompt 1 documentation deliverables.
- **Risks:** Scope drift or premature code generation before approval.
- **Client / CA / Legal Confirmation:** Required for open decisions framework (`open-decisions.md`).

### Prompt 2 — Monorepo and Development Toolchain
- **Objective:** Scaffold pnpm monorepo structure containing Next.js frontend (`apps/web`), Node.js/Express backend (`apps/api`), shared TypeScript packages (`packages/types`, `packages/config`), ESLint, Prettier, and Firebase Emulator configuration.
- **Inputs:** `docs/implementation/decisions.md`, `api-inventory.md`.
- **Expected Files/Modules:** `package.json`, `pnpm-workspace.yaml`, `apps/web/`, `apps/api/`, `packages/types/`, `packages/config/`, `firebase.json`, `.firestore/rules`.
- **Dependencies:** Prompt 1 blueprint sign-off.
- **Tests:** Monorepo build script (`npm run build`), lint check (`npm run lint`), emulator startup test (`npm run emulators:start`).
- **Demo / Verification:** Express health check endpoint returning HTTP 200; Next.js homepage rendering; Firebase Emulator UI accessible locally.
- **Completion Gate:** Monorepo builds cleanly with zero errors across frontend and backend packages.
- **Risks:** Monorepo package linking errors or Node.js version incompatibilities.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 3 — Design System and Application Shell
- **Objective:** Implement application design system, glassmorphism UI components, responsive layout shell, navigation sidebar, top app bar, store switcher component, and notification drawer.
- **Inputs:** `docs/implementation/screen-map.md`.
- **Expected Files/Modules:** `apps/web/src/components/ui/`, `apps/web/src/styles/globals.css`, `apps/web/src/layouts/DashboardLayout.tsx`, `apps/web/src/components/StoreSwitcher.tsx`.
- **Dependencies:** Prompt 2 scaffolding.
- **Tests:** Component rendering unit tests; responsive layout breakpoint tests (mobile, tablet, desktop).
- **Demo / Verification:** Collapsible navigation sidebar; responsive app shell with high-contrast glassmorphism theme preview.
- **Completion Gate:** All core layout shell components pass visual aesthetics and responsive checks.
- **Risks:** CSS layout shifts or desktop/mobile styling breakage.
- **Client / CA / Legal Confirmation:** Client UI aesthetic confirmation recommended.

### Prompt 4 — Firebase Authentication with Google Sign-In
- **Objective:** Implement Firebase Client SDK Google Sign-In authentication, backend JWT verification middleware (`authMiddleware`), and public sign-in routes.
- **Inputs:** `04-SECURITY-API.md`, `role-permission-matrix.md`.
- **Expected Files/Modules:** `apps/api/src/middleware/auth.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/web/src/pages/auth/signin.tsx`.
- **Dependencies:** Prompt 2 scaffolding, Prompt 3 UI shell.
- **Tests:** JWT extraction unit tests; OAuth token signature verification integration tests; unauthenticated access block tests.
- **Demo / Verification:** User signs in with Google OAuth popup; backend receives and verifies Firebase ID token.
- **Completion Gate:** Unauthenticated API requests strictly return HTTP 401 Unauthorized.
- **Risks:** Token expiration handling failure or OAuth popup blocking.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 5 — Store Onboarding, Membership and RBAC
- **Objective:** Implement multi-tenant store onboarding, active store membership verification (`stores/{storeId}/members/{uid}`), tenant context injection middleware, and role-based access control.
- **Inputs:** `04-SECURITY-API.md`, `role-permission-matrix.md`.
- **Expected Files/Modules:** `apps/api/src/middleware/tenant.ts`, `apps/api/src/services/StoreService.ts`, `apps/web/src/pages/onboarding/store-select.tsx`, `firestore.rules`.
- **Dependencies:** Prompt 4 Auth.
- **Tests:** Firestore security rules unit tests testing cross-tenant isolation; membership role authorization tests.
- **Demo / Verification:** Authenticated user selects active store; attempts cross-tenant store access (blocked with 403 Forbidden).
- **Completion Gate:** Security rules pass 100% of tenant isolation assertion tests.
- **Risks:** Token claims delay or unverified store ID parameter injection.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 6 — Medicine Catalogue and Unit/Pack Model
- **Objective:** Implement medicine catalogue CRUD, category/rack tracking, Schedule H/H1/X classification attributes, base unit vs pack conversion logic (`stripSize`, `packToUnits`, `unitsToPacks`), and price calculation.
- **Inputs:** `templates/medicines-import.csv`, `03-DATA-MODEL.md`.
- **Expected Files/Modules:** `apps/api/src/services/MedicineService.ts`, `apps/web/src/pages/inventory/medicines/`, `packages/types/src/medicine.ts`.
- **Dependencies:** Prompt 5 Store Membership.
- **Tests:** Unit tests for unit/pack conversion math; schema validation tests for Schedule flags and `stripSize > 0`.
- **Demo / Verification:** Create medicine master entry with pack size 10; verify computed base unit price; toggle `allowLooseSales` option.
- **Completion Gate:** Conversion functions verified with 100% test coverage across boundary cases.
- **Risks:** Fractional unit rounding errors or missing base unit definitions.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 7 — Batch Inventory and Stock Ledger
- **Objective:** Implement First-Expiry-First-Out (FEFO) batch inventory management, stock allocation, immutable append-only stock movement ledger (`stockLedger`), and stock adjustment API.
- **Inputs:** `05-BUSINESS-WORKFLOWS.md`, `decisions.md` (ADR-012).
- **Expected Files/Modules:** `apps/api/src/services/FEFOService.ts`, `apps/api/src/services/StockLedgerService.ts`, `apps/web/src/pages/inventory/batches/`.
- **Dependencies:** Prompt 6 Medicine Catalogue.
- **Tests:** Integration tests verifying FEFO orders batches by `expiryDate ASC`; stock ledger append-only immutability tests.
- **Demo / Verification:** View batch inventory sorted by FEFO; execute stock adjustment with mandatory audit reason; verify ledger debit.
- **Completion Gate:** Non-negative stock invariant enforced; stock balance equals sum of movement ledger entries.
- **Risks:** Race conditions on concurrent stock deductions.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 8 — CSV Inventory Import
- **Objective:** Implement dynamic write-budget CSV inventory import engine, pre-ingestion preview/validation, dynamic chunking (<= 25 rows per batch), idempotency, and error recovery log download.
- **Inputs:** CSV templates (`medicines-import.csv`), `decisions.md` (ADR-015).
- **Expected Files/Modules:** `apps/api/src/services/CSVImportEngine.ts`, `apps/web/src/pages/imports/csv.tsx`.
- **Dependencies:** Prompt 6 Medicine Catalogue, Prompt 7 Stock Ledger.
- **Tests:** Bulk import integration tests (500 rows); write-budget dynamic calculation test; duplicate hash import rejection test.
- **Demo / Verification:** Upload CSV via UI; preview data grid; watch real-time chunk progress bar; download itemized error log.
- **Completion Gate:** Successfully imports bulk CSV records without exceeding Firestore batch limits or duplicating rows on retry.
- **Risks:** Browser memory overflow on large CSV parsing or malformed row headers.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 9 — Suppliers and Purchases
- **Objective:** Implement supplier registry CRUD, purchase order lifecycle (Draft, Issued, Received, Cancelled), GRN stock ingestion, and supplier payment ledger (`supplierLedger`).
- **Inputs:** `templates/suppliers-import.csv`, `05-BUSINESS-WORKFLOWS.md`.
- **Expected Files/Modules:** `apps/api/src/services/SupplierService.ts`, `apps/api/src/services/PurchaseOrderService.ts`, `apps/web/src/pages/purchases/`.
- **Dependencies:** Prompt 7 Batch Inventory.
- **Tests:** PO state machine transition tests; GRN receipt transaction tests atomically populating batch stock and supplier balance.
- **Demo / Verification:** Create PO -> Mark Received -> Verify inventory batches populated and supplier account balance updated.
- **Completion Gate:** Receiving GRN atomically creates batch records and ledger entries without partial failures.
- **Risks:** Tax rate mismatch on incoming supplier invoices.
- **Client / CA / Legal Confirmation:** CA sign-off recommended for supplier ledger accounting rules.

### Prompt 10 — Doctors, Employees and Sensitive Data
- **Objective:** Implement doctor registry CRUD, Schedule H prescription association hooks, employee roster management, RBAC member role assignment, employee salary/advance ledger (`employeeLedger`), and DPDP PII protection storing strictly approved masked values (`aadhaarLastFour`, `panLastFour`).
- **Inputs:** `templates/employees-import.csv`, `role-permission-matrix.md`, `open-decisions.md` (DEC-OPEN-04).
- **Expected Files/Modules:** `apps/api/src/services/DoctorService.ts`, `apps/api/src/services/EmployeeService.ts`, `apps/web/src/pages/doctors/`, `apps/web/src/pages/employees/`.
- **Dependencies:** Prompt 5 Store Membership.
- **Tests:** Doctor CRUD tests; employee ledger transaction tests; PII masking validation tests asserting raw Aadhaar/PAN are rejected.
- **Demo / Verification:** Create doctor; register employee with `aadhaarLastFour`; view masked profile; post employee salary advance entry.
- **Completion Gate:** Raw PII identifiers excluded from storage; employee financial ledger reconciled.
- **Risks:** Accidental exposure of sensitive employee data in standard list responses.
- **Client / CA / Legal Confirmation:** Legal sign-off required for DPDP compliance rules.

---

## Part 2: Billing Engine, POS UI, Invoicing, Refunds & Operations (Prompts 11 – 20)

### Prompt 11 — Versioned Billing Calculation Engine
- **Objective:** Build server-authoritative versioned calculation engine (`calculationVersion`) using integer paise monetary math (`parseDecimalToPaise`), basis-point tax/discount rates (`gstRateBps`), configurable doctor commission calculations, and GSTR tax allocation rules.
- **Inputs:** `03-DATA-MODEL.md`, `decisions.md` (ADR-007, ADR-008, ADR-009).
- **Expected Files/Modules:** `packages/types/src/money.ts`, `apps/api/src/services/BillingCalculationEngine.ts`.
- **Dependencies:** Prompt 6 Medicine Model, Prompt 10 Doctors/Employees.
- **Tests:** Table-driven unit tests for paise calculation precision; tax slab breakup tests; versioned calculation engine compatibility tests.
- **Demo / Verification:** Execute calculation engine against edge-case cart payloads; assert 100% exact paise totals without floating-point drift.
- **Completion Gate:** Zero floating-point math usage in calculation engine; 100% test pass on monetary boundary conditions.
- **Risks:** Rounding discrepancies across multi-item tax allocations.
- **Client / CA / Legal Confirmation:** CA confirmation required for GST tax allocation policies.

### Prompt 12 — Billing Quote and Medicine-Selection UI
- **Objective:** Implement cashier POS terminal UI, multi-criteria medicine search (brand, generic, barcode, rack), FEFO batch auto-selection dropdown, Schedule H prescription validation hooks, live billing quote endpoint (`POST /api/v1/bills/quote`), and keyboard navigation shortcuts.
- **Inputs:** `05-BUSINESS-WORKFLOWS.md`, `screen-map.md`.
- **Expected Files/Modules:** `apps/web/src/pages/billing/new.tsx`, `apps/web/src/components/billing/MedicineSearch.tsx`, `apps/api/src/routes/bills.ts`.
- **Dependencies:** Prompt 11 Calculation Engine, Prompt 7 FEFO Inventory.
- **Tests:** POS keyboard workflow navigation tests (`F2`, `F4`, `F10`); billing quote endpoint integration tests.
- **Demo / Verification:** Search medicine by barcode -> Auto-select FEFO batch -> Fetch quote -> Display subtotal, tax, and net payable in paise formatted to INR.
- **Completion Gate:** Quote endpoint re-verifies prices server-side without mutating inventory.
- **Risks:** Search latency during cashier typing.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 13 — Atomic Bill Finalization and Invoice Numbering
- **Objective:** Implement server-side atomic bill finalization endpoint (`POST /api/v1/bills`), store invoice sequential counter allocation (`INV-YYYYMM-XXXXXX`), FEFO stock deduction, and sales ledger posting within a single Firestore transaction.
- **Inputs:** `03-DATA-MODEL.md`, `decisions.md` (ADR-007, ADR-016).
- **Expected Files/Modules:** `apps/api/src/services/BillFinalizationService.ts`, `apps/api/src/services/InvoiceCounterService.ts`.
- **Dependencies:** Prompt 11 Calculation Engine, Prompt 12 Billing UI.
- **Tests:** Concurrency integration tests for invoice counter allocation; negative stock deduction block tests within transaction.
- **Demo / Verification:** Click "Finalize Bill" -> Server locks transaction -> Allocates sequential invoice number -> Decrements batch stock -> Creates invoice document.
- **Completion Gate:** Zero duplicate invoice numbers or negative stock under high concurrency simulation.
- **Risks:** Firestore transaction contention on store counter document during peak sales.
- **Client / CA / Legal Confirmation:** CA sign-off required for sequential invoice number format.

### Prompt 14 — Payment Modes and Split Payments
- **Objective:** Implement payment mode processing (Cash, UPI, Card), split payment validation (`sum(modes.amountPaise) == grandTotalPaise`), cash change calculation, and payment ledger entries.
- **Inputs:** `05-BUSINESS-WORKFLOWS.md`, `03-DATA-MODEL.md`.
- **Expected Files/Modules:** `apps/web/src/components/billing/PaymentModal.tsx`, `apps/api/src/services/PaymentService.ts`.
- **Dependencies:** Prompt 13 Bill Finalization.
- **Tests:** Split payment exact sum unit tests; cash change math tests; payment mode schema validation tests.
- **Demo / Verification:** Finalize bill with ₹500 Cash + ₹350 UPI -> Server verifies exact paise total match -> Record payment breakdown.
- **Completion Gate:** Billing API rejects split payment payloads where total paid does not equal invoice grand total down to exact paise.
- **Risks:** Unbalanced payment mode entries.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 15 — Invoice PDFs and 80mm Browser-Print Layout
- **Objective:** Implement downloadable A4 GST invoice generator (PDF via server/client rendering) and browser-printable 80mm compact thermal receipt stylesheet (`@media print`). Direct ESC/POS hardware drivers excluded from MVP.
- **Inputs:** `02-ARCHITECTURE.md`, `open-decisions.md` (DEC-OPEN-06).
- **Expected Files/Modules:** `apps/web/src/components/printing/A4InvoiceTemplate.tsx`, `apps/web/src/components/printing/Receipt80mmTemplate.tsx`, `apps/web/src/styles/print.css`.
- **Dependencies:** Prompt 13 Bill Finalization, Prompt 14 Payment Modes.
- **Tests:** Visual print layout tests; PDF buffer generation unit tests; 80mm character width clipping tests.
- **Demo / Verification:** Click "Print A4 Invoice" (renders formatted GST invoice); Click "Print 80mm Receipt" (opens browser print preview formatted for 80mm roll).
- **Completion Gate:** Both layouts render cleanly without text overflow or missing GST compliance fields.
- **Risks:** Browser-specific CSS print styling anomalies.
- **Client / CA / Legal Confirmation:** CA sign-off required for mandatory A4 GST invoice compliance fields.

### Prompt 16 — Bill Register, Filters and Bill Details
- **Objective:** Implement invoice history register page, status filters (Finalized, Refunded, Cancelled), date range queries, invoice search by serial number, and detailed invoice view drawer.
- **Inputs:** `screen-map.md`, `firestore-query-index-plan.md`.
- **Expected Files/Modules:** `apps/web/src/pages/billing/history.tsx`, `apps/web/src/components/billing/InvoiceDetailDrawer.tsx`.
- **Dependencies:** Prompt 13 Bill Finalization, Prompt 15 Invoice Templates.
- **Tests:** Invoice filter query integration tests using composite index; cursor-based pagination tests.
- **Demo / Verification:** Filter invoices by date range and status; click invoice row to open detail view with itemized line items and payment breakdown.
- **Completion Gate:** List endpoint responds within < 300ms using cursor pagination without full collection scans.
- **Risks:** Un-indexed filter query execution.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 17 — Cancellation/Refund Approval Requests [COMPLETED & VERIFIED]
- **Objective:** Implement backend approval code generator (8-character HMAC OTP), encrypted outbox email delivery worker (`OUTBOX_ENCRYPTION_KEY`), approval request state tracking (`approvalRequests`), and operator request modal.
- **Inputs:** Prompt 0B decisions, `04-SECURITY-API.md`.
- **Expected Files/Modules:** `apps/api/src/services/ApprovalCodeService.ts`, `apps/api/src/services/OutboxWorker.ts`, `apps/web/src/components/billing/ApprovalRequestModal.tsx`.
- **Dependencies:** Prompt 16 Bill Register.
- **Tests:** HMAC OTP generation and hashing unit tests; AES-256-GCM outbox payload encryption/decryption tests; code expiration tests.
- **Demo / Verification:** Operator clicks "Request Refund" -> Server generates OTP, encrypts email payload to outbox -> Worker delivers email to Super Admin -> UI shows 15-min expiry countdown.
- **Completion Gate:** OTP code is never stored in plain text (HMAC hash only) and never returned in API responses to the operator.
- **Risks:** Outbox worker processing delay or email delivery failure.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 18 — Atomic Cancellation/Refund Execution [COMPLETED & VERIFIED]
- **Objective:** Implement atomic cancellation/refund execution endpoint (`POST /api/v1/bills/:id/refund`), backend OTP verification (max 3 attempts), batch inventory stock return, sales reversal ledger creation, and refund record logging.
- **Inputs:** Prompt 0B decisions, `05-BUSINESS-WORKFLOWS.md`.
- **Expected Files/Modules:** `apps/api/src/services/RefundExecutionEngine.ts`, `apps/web/src/components/billing/RefundExecutionModal.tsx`.
- **Dependencies:** Prompt 17 Approval Requests, Prompt 7 Stock Ledger.
- **Tests:** OTP verification integration tests; max attempt lockout tests (blocked on 3rd failure); atomic refund reversal transaction tests.
- **Demo / Verification:** Operator enters 8-character OTP received from Super Admin -> Server verifies HMAC hash -> Updates invoice status to `REFUNDED` -> Restores batch stock -> Creates reversal ledger.
- **Completion Gate:** Attempt counter locks after 3 failures; duplicate refund requests rejected atomically.
- **Risks:** Partial refund stock return allocation logic errors.
- **Client / CA / Legal Confirmation:** CA sign-off required for credit note reversal accounting entries.

### Prompt 19 — Expenses and Employee Financial Transactions [COMPLETED & VERIFIED]
- **Objective:** Implement store expense logging by category, petty cash tracking, daily cash drawer opening/closing reconciliation, and employee financial transactions (salary advance/repayment postings).
- **Inputs:** `01-PRD.md` (FR-EXP-001..003), `03-DATA-MODEL.md`.
- **Expected Files/Modules:** `apps/api/src/services/ExpenseService.ts`, `apps/api/src/services/EmployeeLedgerService.ts`, `apps/web/src/pages/expenses/`.
- **Dependencies:** Prompt 10 Employees, Prompt 14 Payments.
- **Tests:** Cash drawer balance reconciliation unit tests; employee advance ledger transaction tests.
- **Demo / Verification:** Log store petty expense -> Post employee salary advance -> Open/close daily cash register with cash count reconciliation.
- **Completion Gate:** Cash register closing math reconciles physical cash with net cash sales and expenses.
- **Risks:** Unrecorded cash payouts or manual entry errors.
- **Client / CA / Legal Confirmation:** CA approval recommended for expense tax categorizations.

### Prompt 20 — Dashboard and Daily Closing [COMPLETED & VERIFIED]
- **Objective:** Implement executive store dashboard widgets, real-time KPI metrics, daily summary aggregations (`dailySummaries`), daily closing procedure, and cash register lock.
- **Inputs:** `screen-map.md`, `03-DATA-MODEL.md`.
- **Expected Files/Modules:** `apps/web/src/pages/dashboard.tsx`, `apps/api/src/services/DailyClosingService.ts`.
- **Dependencies:** Prompt 13 Bill Finalization, Prompt 18 Refunds, Prompt 19 Expenses.
- **Tests:** Daily summary aggregation unit tests; daily closing transaction lock tests.
- **Demo / Verification:** View dashboard showing Today's Gross Sales, Refunds, Expenses, and Net Revenue; execute Daily Closing to lock register.
- **Completion Gate:** Dashboard metrics read pre-aggregated summary documents with zero full collection scans.
- **Risks:** Timezone boundary mismatches on daily summary aggregations.
- **Client / CA / Legal Confirmation:** Not required.

---

## Part 3: Reports, Admin, Hardening, Verification & Deployment (Prompts 21 – 30)

### Prompt 21 — Reports and Exports [COMPLETED & VERIFIED]
- **Objective:** Implement asynchronous report generation framework, GST return compiler (GSTR-1, GSTR-3B HSN summaries), financial sales reports, inventory movement reports, and CSV/PDF export downloads stored in Storage.
- **Inputs:** `01-PRD.md` (FR-REP-001..007), `open-decisions.md` (DEC-OPEN-01).
- **Expected Files/Modules:** `apps/api/src/services/ReportGeneratorService.ts`, `apps/web/src/pages/reports/`, `apps/api/src/services/GSTReportService.ts`.
- **Dependencies:** Prompt 20 Dashboard/Summaries, Prompt 11 Calculation Engine.
- **Tests:** GSTR-1 HSN summary compilation unit tests; report export worker integration tests.
- **Demo / Verification:** Select date range -> Click "Generate GSTR-1 Report" -> Download CSV file formatted for GST portal import.
- **Completion Gate:** Generated GST report tax totals match 100% with underlying sales ledger summaries.
- **Risks:** Report compilation timeout on large dataset ranges.
- **Client / CA / Legal Confirmation:** CA sign-off required for GSTR report layouts and tax slab breakups.

### Prompt 22 — Notifications and Scheduled Jobs [COMPLETED & VERIFIED]
- **Objective:** Implement near-expiry batch alert notifications, low-stock reorder warnings, background outbox email delivery queue worker, and scheduled Vercel Cron endpoints protected via `CRON_SECRET`.
- **Inputs:** `01-PRD.md` (FR-INV-005..007), `04-SECURITY-API.md`.
- **Expected Files/Modules:** `apps/api/src/services/NotificationService.ts`, `apps/api/src/routes/jobs.ts`, `apps/api/src/workers/CronWorker.ts`.
- **Dependencies:** Prompt 7 FEFO Inventory, Prompt 17 Outbox Worker.
- **Tests:** Cron secret authentication unit tests; near-expiry notification trigger tests.
- **Demo / Verification:** Trigger scheduled notification cron job -> System scans batches expiring within 30 days -> Generates alert notifications.
- **Completion Gate:** Cron endpoints reject requests lacking valid `CRON_SECRET` authorization header.
- **Risks:** Duplicate notification triggers on cron retries.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 23 — Administration and Audit Explorer [COMPLETED & VERIFIED]
- **Objective:** Implement system administration control panel, immutable audit log viewer (`auditLogs`), event payload JSON explorer, user role management UI, and system health status monitor.
- **Inputs:** `04-SECURITY-API.md`, `role-permission-matrix.md`.
- **Expected Files/Modules:** `apps/web/src/pages/admin/audit-logs.tsx`, `apps/api/src/services/AuditExplorerService.ts`.
- **Dependencies:** Prompt 5 Store Membership, Prompt 20 Dashboard.
- **Tests:** Immutable audit log rule tests (asserting client writes/deletions fail); audit log filtering query tests.
- **Demo / Verification:** Perform sensitive action (refund request) -> Open Audit Explorer as Owner -> Inspect structured audit log entry.
- **Completion Gate:** Audit log collection rejects direct writes or modifications from any client role.
- **Risks:** Missing audit logging hooks on sensitive mutation endpoints.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 24 — Firestore Query, Index and Cost Optimization [COMPLETED & VERIFIED]
- **Objective:** Deploy production-grade `firestore.indexes.json`, enforce cursor-based pagination across all list endpoints, optimize read budgets, and eliminate un-indexed query execution paths.
- **Inputs:** `docs/implementation/firestore-query-index-plan.md`.
- **Expected Files/Modules:** `firestore.indexes.json`, `apps/api/src/utils/pagination.ts`.
- **Dependencies:** Prompts 4 through 23.
- **Tests:** Index coverage automated test suite executing all system query patterns against local Firebase Emulator.
- **Demo / Verification:** Execute full system query suite against Firebase Emulator with missing index detection enabled (0 missing index errors).
- **Completion Gate:** All query patterns backed by verified composite indexes in `firestore.indexes.json`.
- **Risks:** Production query failure due to omitted index field order.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 25 — Security Hardening [COMPLETED & VERIFIED]
- **Objective:** Execute security hardening across all layers, enforce strict PII encryption/masking, apply OWASP defense middleware (Helmet, strict CORS, rate limiting, input sanitization), and conduct security audit against DPDP rules.
- **Inputs:** `04-SECURITY-API.md`, `open-decisions.md` (DEC-OPEN-04).
- **Expected Files/Modules:** `apps/api/src/middleware/security.ts`, `apps/api/src/utils/sanitizer.ts`.
- **Dependencies:** Prompts 4 through 24.
- **Tests:** Security audit test suite testing OWASP Top 10 vulnerabilities (SQLi/NoSQLi, XSS, Auth bypass, Rate limit headers).
- **Demo / Verification:** Run automated penetration testing script; verify zero critical vulnerabilities and log output contains zero raw PII.
- **Completion Gate:** Security suite passes 100% with zero raw PII in backend application logs.
- **Risks:** Overly restrictive CORS or rate-limit settings blocking legitimate client requests.
- **Client / CA / Legal Confirmation:** Legal sign-off required for DPDP privacy compliance.

### Prompt 26 — Accessibility and Responsive UX [COMPLETED & VERIFIED]
- **Objective:** Perform full accessibility (WCAG 2.1 AA) and responsive UX verification across mobile, tablet, and desktop viewports, ensuring complete keyboard navigation, contrast ratios, and ARIA labels.
- **Inputs:** `screen-map.md`, `definition-of-done.md`.
- **Expected Files/Modules:** `apps/web/src/styles/accessibility.css`, UI component keyboard hooks (`useKeyboardShortcuts.ts`).
- **Dependencies:** Prompt 3 UI Shell, Prompts 12 through 20 UI screens.
- **Tests:** Automated axe-core accessibility audit suite; keyboard navigation workflow integration tests.
- **Demo / Verification:** Navigate cashier billing POS terminal entirely using keyboard shortcuts (`F2`, `F4`, `F10`, `Tab`, `Enter`).
- **Completion Gate:** Zero critical accessibility violations detected by automated audit scanner.
- **Risks:** Keyboard focus traps in modal dialogs.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 27 — Complete Automated Testing [COMPLETED & VERIFIED]
- **Objective:** Develop and execute complete end-to-end (E2E) automated testing suite covering full user journeys: sign-in, onboarding, stock import, billing, refund approval, and GSTR reporting against Firebase Emulator Suite.
- **Inputs:** All previous prompt deliverables, `definition-of-done.md`.
- **Expected Files/Modules:** `apps/api/src/services/e2e-workflow.test.ts`, `package.json` (`test:e2e`).
- **Dependencies:** Prompts 1 through 26.
- **Tests:** Full E2E test execution against running local Firebase Emulator Suite and backend Express server (19/19 passing).
- **Demo / Verification:** Run E2E test suite in headless mode; observe 100% test pass rate across all critical user flows.
- **Completion Gate:** E2E test suite completes cleanly with zero flaky assertions or unhandled exceptions.
- **Risks:** Test suite execution timeouts or emulator state corruption.
- **Client / CA / Legal Confirmation:** Client verification of automated E2E demo workflows.

### Prompt 28 — CI/CD and Environment Governance [COMPLETED & VERIFIED]
- **Objective:** Establish GitHub Actions CI/CD workflows, configure environment isolation rules between staging (`pharmacy-staging`) and production (`pharmacy-prod`), and set up automated build checks.
- **Inputs:** `02-ARCHITECTURE.md`, `decisions.md` (ADR-005, ADR-027).
- **Expected Files/Modules:** `.github/workflows/ci.yml`, `.github/workflows/deploy-staging.yml`, `scripts/validate-env.ts`.
- **Dependencies:** Prompt 27 Complete Testing.
- **Tests:** CI pipeline build, lint, and test execution verification; environment variable isolation checker script test.
- **Demo / Verification:** Push code commit to main branch; observe automated CI pipeline trigger, run tests, and validate build artifacts.
- **Completion Gate:** CI/CD workflow passes all verification checks and enforces strict environment variable separation.
- **Risks:** Misconfigured secrets in CI environment settings.
- **Client / CA / Legal Confirmation:** Not required.

### Prompt 29 — UAT, Production Readiness and Backup/Restore [COMPLETED & VERIFIED]
- **Objective:** Conduct User Acceptance Testing (UAT) on staging environment, execute pre-flight security/compliance checks, verify automated daily Firestore backup scripts to GCP Cloud Storage, and execute dry-run restore procedure.
- **Inputs:** `open-decisions.md` (Pre-flight checklist), `02-ARCHITECTURE.md`.
- **Expected Files/Modules:** `scripts/backup-firestore.ts`, `scripts/restore-firestore.ts`, `docs/operational/preflight-checklist.md`.
- **Dependencies:** Prompts 27 and 28.
- **Tests:** Backup creation script verification; dry-run restore execution into clean test database (22/22 docs verified, 100% hash match).
- **Demo / Verification:** Trigger backup -> Restore into dry-run database -> Verify 100% record match -> Sign off Prompt 29 pre-flight checklist.
- **Completion Gate:** All compliance confirmation gates signed off in `open-decisions.md`; dry-run restore verified successfully.
- **Risks:** Incomplete Firestore backup scopes or unverified compliance gates.
- **Client / CA / Legal Confirmation:** Mandatory formal signed authorization from Client, CA, and Legal counsel.

### Prompt 30 — Production Deployment and Handover [COMPLETED & VERIFIED]
- **Objective:** Execute production deployment to Vercel and Firebase Blaze (`pharmacy-prod`), seed initial system roles/configs, configure live monitoring alerts, and deliver operational handover documentation.
- **Inputs:** Signed Prompt 29 pre-flight authorization document (Sole authorized production deployment prompt).
- **Expected Files/Modules:** `scripts/deploy-production.ts`, `docs/operational/handover-guide.md`, `docs/operational/runbook.md`.
- **Dependencies:** Prompt 29 Pre-flight Approval.
- **Tests:** Live production post-deployment smoke test suite.
- **Demo / Verification:** Owner signs into live production web application over HTTPS custom domain; executes first live bill; prints invoice.
- **Completion Gate:** Production application live, stable, monitored, and formally handed over to client operations team.
- **Risks:** Production DNS propagation delay or third-party service outage during launch.
- **Client / CA / Legal Confirmation:** Formal Client Production Acceptance and System Handover Sign-off.
