# Definition of Done (DoD) Framework

This document specifies the strict Definition of Done (DoD) criteria for the Pharmacy AI Agent application across global, domain, technical, security, testing, operational, and handover layers in accordance with Pack 1.2 specifications and Prompt 1A audit instructions. Every prompt deliverable must satisfy these standards before being marked complete.

---

## 1. Global Definition of Done

A task, feature, or prompt deliverable is considered **DONE** if and only if all the following conditions are met:

1. **Clean Build:** Monorepo builds cleanly without warnings or errors (`npm run build`).
2. **Zero Lint Errors:** ESLint and Prettier rules pass without warnings (`npm run lint`).
3. **100% Strict Type Checking:** TypeScript compiler passes with zero errors under strict mode (`tsc --noEmit`).
4. **Automated Test Pass:** Unit, integration, security rules, and E2E tests pass 100% (`npm run test`).
5. **No Secrets in Source/Logs:** Code, configs, and logs are free of API keys, tokens, or encryption secrets.
6. **Documentation Updated:** Architecture blueprints, API specs, and inline code comments reflect all changes.
7. **Traceability Verified:** Implementation maps to an approved Requirement ID in `requirements-traceability.md`.
8. **Manual Verification Plan:** Concrete step-by-step instructions provided for visual/manual validation.
9. **Rollback Safety:** Rollback considerations documented and non-breaking migration strategy verified.

---

## 2. Layer-Specific Definitions of Done

### 2.1 Documentation Definition of Done
- Written in clear, standard GitHub-Flavored Markdown without broken links.
- Free of conflicting statements; aligned 100% with latest Pack 1.2 decisions and Prompt 1A prompt map.
- All code references use exact absolute or workspace relative links (`file://`).
- Includes diagrams (Mermaid) where visual workflow or architecture clarification is required.
- Formally reviewed against `open-decisions.md` gates.

### 2.2 Frontend Definition of Done (`apps/web`)
- Implemented using Next.js, React, and TypeScript following component architecture.
- Styled using Vanilla CSS / CSS Modules with defined design system tokens (no ad-hoc inline styles).
- Visual layout wows the user with glassmorphism, responsive grids, and subtle micro-animations.
- Fully responsive across desktop (1920x1080), laptop (1366x768), tablet (768x1024), and mobile (375x812).
- Complete state coverage: Default, Loading, Empty, Error, and Keyboard Focus states.
- Optimized bundle size with zero un-treeshaken dependencies.

### 2.3 Backend Definition of Done (`apps/api`)
- Express controllers delegate business logic strictly to isolated service modules.
- Monetary calculations executed strictly using integer paise derived via `parseDecimalToPaise`.
- Input validation performed on all endpoints using Zod schemas prior to controller entry.
- Idempotency key checked for all sensitive mutation endpoints (`POST /api/v1/bills`, `POST /api/v1/bills/:id/refund`).
- Error responses follow standardized JSON format `{ success: false, error: { code, message } }`.
- Structured logging implemented with PII values masked automatically.

### 2.4 Firestore & Storage Definition of Done
- Multi-tenant data structures store tenant data under store-scoped paths (`stores/{storeId}/...`).
- Sensitive mutations (stock deduction, billing, refunds) execute strictly within Firestore transactions.
- Firestore Security Rules enforce tenant isolation and role permissions (`request.auth.token.storeId == storeId`).
- All queries covered by composite indexes in `firestore.indexes.json` without full scans.
- Dynamic write-budget chunking implemented for batch imports (<= 25 items per chunk).
- Firebase Storage bucket rules enforce store-isolated file access.

### 2.5 Security & Privacy Definition of Done
- Authentication verified on all protected API routes using Firebase Admin Auth JWT decoder.
- Authorization enforced using named permissions mapped to active store member role (`stores/{storeId}/members/{uid}`).
- Default MVP behavior stores strictly approved masked/last-four employee PII values (`aadhaarLastFour`, `panLastFour`). Raw PII prohibited without signed consent.
- Approval codes generated via cryptographic backend PRNG, hashed with HMAC-SHA256, and verified backend-only.
- Email outbox payloads encrypted with AES-256-GCM using `OUTBOX_ENCRYPTION_KEY`.
- OWASP security headers configured (Helmet, strict CORS, CSP).

### 2.6 Accessibility Definition of Done
- All interactive elements possess unique, descriptive `id` attributes.
- Keyboard navigation supported across all screens (full tab order, `Escape` to close modals, shortcut keys `F2`/`F4`/`F10` for cashier POS cart).
- Color contrast ratios satisfy WCAG 2.1 AA standards (minimum 4.5:1 for normal text).
- Form inputs have associated `<label>` elements and visible focus rings (`:focus-visible`).
- Screen reader ARIA attributes (`aria-expanded`, `aria-modal`, `aria-live`) implemented on dynamic state changes.

### 2.7 Testing Definition of Done
- **Unit Tests:** 100% coverage on core business math (`money.ts`, `packToUnits`, `BillingCalculationEngine`).
- **Integration Tests:** API endpoints tested against running Firebase Emulator Suite with synthetic data.
- **Rules Tests:** 100% path coverage on `firestore.rules` and `storage.rules` testing cross-tenant block scenarios.
- **E2E Tests:** Complete critical user workflows pass cleanly in headless browser automation.
- **Reconciliation Verification:**
  - **Stock Reconciliation:** `sum(batches.stockUnits) == stockLedger.balanceUnits`.
  - **Ledger Reconciliation:** `sum(salesLedger.debits) - sum(salesLedger.credits) == dailySummary.netSalesPaise`.
  - **Payment Reconciliation:** `sum(paymentModes.amountPaise) == invoice.grandTotalPaise`.
  - **Refund Exactly-Once:** Verification test asserting a second refund attempt on the same invoice returns HTTP 409 Conflict.

### 2.8 Reporting & Printing Definition of Done
- Aggregate documents (`dailySummaries`, `monthlySummaries`) recalculated atomically during bill finalization and refunds.
- Reports show monetary values formatted correctly to 2 decimal places from underlying integer paise.
- GSTR-1 and GSTR-3B export generation tested against official GST tax slab rules.
- Printable layouts satisfy dual output requirements: downloadable A4 GST invoice PDF and browser-printable 80mm compact thermal receipt layout (`@media print`).

### 2.9 Deployment Definition of Done
- Separate Vercel projects configured for staging (`web-staging`, `api-staging`) and production (`web-prod`, `api-prod`).
- Separate Firebase Blaze projects provisioned (`pharmacy-staging`, `pharmacy-prod`).
- Deployments automated via CI/CD scripts (`scripts/deploy-staging.sh`, `scripts/deploy-production.sh`).
- Zero build step warnings; build artifacts sanitized against internal secret leakage.
- Production deployment executed strictly under Prompt 30 following signed pre-flight authorization.

### 2.10 Operational Handover Definition of Done
- Comprehensive runbooks provided for store onboarding, user creation, data backup, and emergency restore.
- Disaster recovery backup script verified with successful dry-run restore into clean environment.
- Cloud monitoring dashboards configured for API latency, memory usage, and Firestore read/write quotas.
- Operational handover document signed off by lead engineer, product manager, and client representative.

---

## 3. Checklist for Prompt Gate Sign-Off

Before any prompt is marked complete and work moves to the next prompt, the lead engineer must verify this DoD checklist:

```markdown
- [ ] Monorepo passes `npm run build` cleanly.
- [ ] Code passes `npm run lint` and `tsc --noEmit`.
- [ ] Unit & Integration tests pass 100% against Firebase Emulator Suite.
- [ ] Security rules verify tenant isolation (0 cross-tenant leaks).
- [ ] Money calculations verified in integer paise (0 floating point math).
- [ ] Screen map & keyboard navigation verified for UI components.
- [ ] Requirement traceability matrix updated for prompt ID.
- [ ] Manual testing instructions documented and executed.
- [ ] No secrets logged or committed to Git repository.
- [ ] Compliance & Legal confirmation gates checked in `open-decisions.md`.
```
