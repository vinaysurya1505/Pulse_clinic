# Architecture Decision Records Index (ADR)

This document records the complete Architecture Decision Records index for the Pharmacy AI Agent application in accordance with Pack 1.2 specifications and Prompt 1A corrections.

---

## Decision Log

### ADR-001: Separate Frontend and Backend Application Topology
- **Context:** Counter billing UI requires high responsiveness while enforcing strict security boundaries.
- **Decision:** Scaffold `apps/web` (Next.js) and `apps/api` (Node.js/Express) as separate projects in a pnpm monorepo, deployed to separate Vercel projects.
- **Reason:** Guarantees server secrets and calculation engines never enter client bundles.
- **Alternatives Rejected:** Monolithic Next.js API routes (risk of bundling server secrets).
- **Consequences:** Requires explicit CORS configuration over HTTPS.
- **Risks:** CORS misconfiguration in deployment.
- **Validation Method:** CI build inspection confirming zero server secret imports in `apps/web`.
- **Related Prompts:** Prompt 2, Prompt 28, Prompt 30.

### ADR-002: Firebase Authentication with Google Sign-In Exclusively for MVP
- **Context:** Secure, low-friction user authentication for pharmacy staff.
- **Decision:** Implement Google Sign-In through Firebase Authentication exclusively for the MVP. Email/password authentication is excluded from MVP but the architecture remains extensible.
- **Reason:** Eliminates password management vulnerabilities and credential storage risks.
- **Alternatives Rejected:** Email/Password in MVP; custom OAuth provider.
- **Consequences:** All staff members must log in with a Google account.
- **Risks:** Users without Google accounts cannot log in until invited.
- **Validation Method:** Automated E2E test verifying Google ID token verification middleware.
- **Related Prompts:** Prompt 4.

### ADR-003: Active Store Membership Verification & Tenant Isolation
- **Context:** Multi-tenant architecture requiring strict store-level data separation.
- **Decision:** Top-level tenant paths (`stores/{storeId}/...`). Authentication does NOT automatically grant access to store data. Middleware validates active membership (`stores/{storeId}/members/{uid}`) on every request.
- **Reason:** Prevents cross-store IDOR (Insecure Direct Object Reference) vulnerabilities.
- **Alternatives Rejected:** Trusting client-supplied store ID without database membership lookup.
- **Consequences:** Every API request executes an indexed membership check.
- **Risks:** Lookup latency impact.
- **Validation Method:** Security rules tests verifying cross-tenant access returns 403 Forbidden.
- **Related Prompts:** Prompt 5, Prompt 25.

### ADR-004: Cloud Firestore Standard Edition as Primary Database
- **Context:** Managed NoSQL database for document transactions and counter operations.
- **Decision:** Use Cloud Firestore Standard edition on the Blaze plan as the single primary application database.
- **Reason:** Provides document transactions, rich subcollections, offline emulator support, and point-in-time recovery.
- **Alternatives Rejected:** PostgreSQL/Neon/Supabase (explicitly forbidden by locked decisions); MongoDB; Realtime DB.
- **Consequences:** Queries must be composite-indexed; page sizes strictly limited.
- **Risks:** Unbounded query read costs if indexes are missing.
- **Validation Method:** Automated emulator test suite checking composite index JSON.
- **Related Prompts:** Prompt 1, Prompt 24, Prompt 30.

### ADR-005: Multi-Environment Topology (Emulator, Staging, Production)
- **Context:** Safe development and testing without polluting production data.
- **Decision:** Use Firebase Emulator Suite for local dev/testing. Separate Firebase Blaze projects for Staging (`pharmacy-staging`) and Production (`pharmacy-prod`).
- **Reason:** Zero cost for local dev; complete data isolation between preview environments and production.
- **Alternatives Rejected:** Shared staging/production database; using paid cloud resources for local dev.
- **Consequences:** Environment configs must be strictly isolated in Vercel settings.
- **Risks:** Accidental preview deployment pointing to production.
- **Validation Method:** Automated startup check asserting non-production project IDs in development mode.
- **Related Prompts:** Prompt 2, Prompt 28, Prompt 30.

### ADR-006: Firebase Storage for Binary Assets
- **Context:** Storage for CSV imports, invoice PDFs, and exported reports.
- **Decision:** Use Firebase Storage with store-scoped paths (`stores/{storeId}/...`) and restricted access served via short-lived signed URLs.
- **Reason:** Keeps binary files out of Firestore while maintaining tenant security.
- **Alternatives Rejected:** Public S3 bucket; base64 strings in Firestore.
- **Consequences:** Downloads require short-lived signed URL generation.
- **Risks:** Leaked permanent URLs if default ACLs are insecure.
- **Validation Method:** Storage rules tests verifying unauthenticated access is denied.
- **Related Prompts:** Prompt 8, Prompt 15, Prompt 21.

### ADR-007: Server-Authoritative Billing, Stock, and Permissions Logic
- **Context:** Preventing fraudulent pricing, negative stock sales, or privilege escalation.
- **Decision:** Zero trust in browser data. All prices, stock availability, GST rates, doctor commissions, discounts, and permissions are recalculated and validated server-side.
- **Reason:** Completely neutralizes client-side DOM tampering or request manipulation.
- **Alternatives Rejected:** Client-calculated totals submitted to backend.
- **Consequences:** API quote endpoint required before finalization.
- **Risks:** Minor increase in server CPU for recalculation.
- **Validation Method:** Integration test attempting forged subtotal manipulation; API must reject.
- **Related Prompts:** Prompt 11, Prompt 12, Prompt 13.

### ADR-008: Integer-Paise Money Representation & String Decimal Parsing
- **Context:** Binary floating-point arithmetic (`0.1 + 0.2 = 0.30000000000000004`) causes financial discrepancies.
- **Decision:** All monetary values stored as integer paise (`*Paise`). User decimal inputs (e.g. `40.00`) are converted using a validated string parser (`parseDecimalToPaise`), **never** `Math.round(val * 100)`.
- **Reason:** Exact mathematical precision down to the paise without IEEE 754 float errors.
- **Alternatives Rejected:** Floating-point numbers; `Math.round()` multiplication.
- **Consequences:** UI inputs convert decimal string to paise on submit; display formats paise to INR float.
- **Risks:** Forgetting paise suffix on a schema field.
- **Validation Method:** Unit test suite verifying `parseDecimalToPaise('10.50') === 1050`.
- **Related Prompts:** Prompt 11, Prompt 13, Prompt 14.

### ADR-009: Basis-Point Rate and Tax Scale Representation
- **Context:** GST and discount rates require high-precision percentage representation without floats.
- **Decision:** Represent rates in basis points (`gstRateBps`: `1200` = 12.00%, `1800` = 18.00%).
- **Reason:** Integer arithmetic for rate calculations (`taxablePaise * gstRateBps / 10000`).
- **Alternatives Rejected:** Floating point rates (`0.12`).
- **Consequences:** Domain calculations use integer division with explicit rounding rules.
- **Risks:** Off-by-one paise rounding error if unrounded.
- **Validation Method:** Domain test suite for rounding boundaries.
- **Related Prompts:** Prompt 11.

### ADR-010: Base Stock Unit Tracking & Pack Conversion Model
- **Context:** Pharmacies purchase medicines in strips/boxes but sell in strips or loose units (tablets/capsules).
- **Decision:** Stock tracked internally strictly in smallest base units (`stockUnits`). Master catalogue defines base unit (`tablets`, `capsules`, `ml`), pack size (`stripSize`), and `allowLooseSales` boolean.
- **Reason:** Single integer stock quantity per batch avoids dual-inventory drift.
- **Alternatives Rejected:** Maintaining separate pack and unit stock counters.
- **Consequences:** Billing API converts pack quantities to base units on sale.
- **Risks:** Loose unit selling when `allowLooseSales` is false.
- **Validation Method:** Unit tests asserting `packToUnits` and `unitsToPacks` conversion logic.
- **Related Prompts:** Prompt 6, Prompt 7.

### ADR-011: FEFO Inventory Selection Engine
- **Context:** Preventing medicine expiry waste and dispensing expired drugs.
- **Decision:** Server automatically selects inventory batches ordered by `expiryDate ASC` (First-Expiry-First-Out). Batches where `expiryDate <= invoiceDate` are strictly non-selectable.
- **Reason:** Automated clinical safety and inventory waste reduction.
- **Alternatives Rejected:** Manual cashier batch selection without FEFO sorting.
- **Consequences:** POS UI auto-suggests nearest valid expiring batch.
- **Risks:** Cashier override attempting to sell expired stock.
- **Validation Method:** Integration test verifying expired batch sale is blocked by API.
- **Related Prompts:** Prompt 7, Prompt 12.

### ADR-012: Immutable Append-Only Stock Movement Ledger
- **Context:** Inventory auditability and stock discrepancy tracking.
- **Decision:** Stock levels are never directly edited. Every inventory change creates an immutable append-only record in `stores/{storeId}/stockLedger`.
- **Reason:** Full historical audit trail for stock reconciliation.
- **Alternatives Rejected:** Mutating stock levels without ledger logging.
- **Consequences:** `sum(stockLedger.changeUnits) == currentStockUnits`.
- **Risks:** High write volume on busy billing terminals.
- **Validation Method:** Security rules preventing deletion or update of stock ledger documents.
- **Related Prompts:** Prompt 7, Prompt 18.

### ADR-013: Dynamic Write-Budget CSV Processing Engine
- **Context:** Bulk importing large CSV files without exceeding Firestore batch write limits (500 ops) or timing out.
- **Decision:** Dynamically calculate batch chunk size based on write operations per row (max 25 rows per batch chunk).
- **Reason:** Prevents transaction failures during bulk imports.
- **Alternatives Rejected:** Hardcoded chunk sizes (e.g. 250 rows).
- **Consequences:** Import process runs iteratively in chunks.
- **Risks:** Browser disconnect during long import jobs.
- **Validation Method:** Bulk import integration test importing 500 records.
- **Related Prompts:** Prompt 8.

### ADR-014: Sequential Store Invoice Number Allocation
- **Context:** Legal requirement for sequential invoice serial numbers per financial year.
- **Decision:** Allocate invoice numbers atomically in Firestore transaction on store counter document `stores/{storeId}/counters/invoices` (`INV-YYYYMM-XXXXXX`).
- **Reason:** Guarantees zero duplicate invoice numbers and zero gaps under concurrency.
- **Alternatives Rejected:** Client-generated invoice numbers; UUID invoice IDs.
- **Consequences:** Counter document is a high-contention lock point.
- **Risks:** Transaction retries under heavy concurrent billing.
- **Validation Method:** Concurrency test generating 100 simultaneous invoices without duplicate serial numbers.
- **Related Prompts:** Prompt 13.

### ADR-015: Transactional Approval Code Request & Verification
- **Context:** Preventing fraudulent bill cancellations and unauthorized refunds.
- **Decision:** Operator requests cancellation/refund -> Backend generates 8-character OTP -> HMAC-SHA256 hash stored in DB -> Plaintext OTP emailed to Super Admin via outbox -> Operator enters code in UI -> Backend verifies hash and executes atomic refund.
- **Reason:** Super Admin maintains authorization control while operator executes operational entry.
- **Alternatives Rejected:** Super Admin logging into cashier terminal; unverified cashier cancellations.
- **Consequences:** OTP code expires in 15 minutes; max 3 failed verification attempts.
- **Risks:** Email delivery delays.
- **Validation Method:** Integration test attempting wrong OTP code 3 times (must lock request).
- **Related Prompts:** Prompt 17, Prompt 18.

### ADR-016: AES-256-GCM Encrypted Email Outbox Queue
- **Context:** Secure outbox queue for sending transactional emails without leaking sensitive OTP codes in Firestore.
- **Decision:** Outbox worker stores email payloads encrypted with AES-256-GCM using `OUTBOX_ENCRYPTION_KEY`. Background worker decrypts payload in memory and sends email via Resend API.
- **Reason:** Plaintext OTP codes and PII are never stored in Firestore documents.
- **Alternatives Rejected:** Plaintext email payload documents in Firestore.
- **Consequences:** Worker requires encryption key to process outbox.
- **Risks:** Key mismatch between API and worker.
- **Validation Method:** Outbox encryption unit test verifying payload cannot be decrypted without key.
- **Related Prompts:** Prompt 17, Prompt 22.

### ADR-017: 80mm Browser-Print Layout & A4 Invoice Rendering
- **Context:** Thermal receipt printing at POS counter and formal A4 GST invoice downloading.
- **Decision:** Implement responsive 80mm HTML/CSS printable layout using `@media print` CSS stylesheets (`window.print()`). Direct ESC/POS hardware socket drivers are explicitly outside MVP.
- **Reason:** Browser print support works universally across standard desktop and tablet printers without native drivers.
- **Alternatives Rejected:** Native ESC/POS printer driver integration in MVP.
- **Consequences:** Print triggering uses browser print dialog.
- **Risks:** Browser print margin styling differences across OS platforms.
- **Validation Method:** Visual print layout test verifying 80mm roll width formatting.
- **Related Prompts:** Prompt 15, Prompt 26.

### ADR-018: Doctor Commission Governance (Configurable & Disabled by Default)
- **Context:** Legal and ethical restrictions on doctor commission fee-splitting in drug sales.
- **Decision:** Feature is configurable (`enableDoctorCommission: false` by default) backed by store settings. It is **not** hardcoded permanently to false. Production activation requires an attached legal compliance record.
- **Reason:** Ensures full regulatory safety by default while maintaining architectural extensibility.
- **Alternatives Rejected:** Hardcoding feature permanently to false; enabling feature without legal hold.
- **Consequences:** Commission calculation skipped when toggle is false.
- **Risks:** Accidental toggle activation without legal approval.
- **Validation Method:** Unit test asserting commission engine returns zero when flag is disabled.
- **Related Prompts:** Prompt 10, Prompt 11, Prompt 12, Prompt 25, Prompt 29.

### ADR-019: Employee PII Protection & Approved Last-Four Masking
- **Context:** Safeguarding employee personal data (Aadhaar, PAN) under DPDP privacy regulations.
- **Decision:** Default MVP behavior stores **strictly approved masked/last-four values** (`aadhaarLastFour`, `panLastFour`). Raw full identifiers are prohibited by default in MVP.
- **Reason:** Eliminates privacy risk and avoids unapproved raw PII collection.
- **Alternatives Rejected:** Storing full PAN/Aadhaar; "masking first five PAN characters" (violates last-four model).
- **Consequences:** Employee forms accept last-four digits only.
- **Risks:** Unintentional full PII input in custom text fields.
- **Validation Method:** API schema validation test rejecting full 12-digit Aadhaar inputs.
- **Related Prompts:** Prompt 10, Prompt 25, Prompt 29.

### ADR-020: Exclusion of Customer Credit Accounts from MVP
- **Context:** Defining core MVP scope boundary for store risk management.
- **Decision:** Customer credit sales, credit statements, and debt write-offs are **NOT part of the approved MVP** and are explicitly deferred to post-MVP evaluation.
- **Reason:** Simplifies financial risk and reduces initial application complexity.
- **Alternatives Rejected:** Including credit sales in MVP billing terminal.
- **Consequences:** All POS sales must be settled immediately via Cash, UPI, or Card.
- **Risks:** Customer requesting credit purchase at checkout.
- **Validation Method:** POS payment modal schema validation requiring full immediate payment.
- **Related Prompts:** Post-MVP Evaluation (`EXCLUDED FROM MVP`).
