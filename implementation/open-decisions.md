# Open Decisions & Compliance Confirmation Gates

This document registers all unresolved business, legal, regulatory, and accounting decisions required prior to production deployment in accordance with Pack 1.2 specifications, Prompt 0/0A/0B decisions, and Prompt 1A corrections.

---

## 1. Open Decisions Index

| Decision ID | Classification | Title / Subject | Reason | Affected Module & Prompts | Safe Temporary Development Policy | Decision Owner | Latest Acceptable Resolution Point |
| ----------- | -------------- | --------------- | ------ | ------------------------- | --------------------------------- | -------------- | ---------------------------------- |
| **DEC-OPEN-01** | Required before production | GST & Accounting Rounding/Allocation Rules | Final CA-approved accounting configuration required for GST tax calculations, line-item vs invoice rounding, and tax allocation on discounts. | Prompt 11 (Calc Engine), Prompts 12 & 13 (Billing UI & Finalization), Prompt 29 (Pre-flight) | Documented temporary calculation policy in dev fixtures only; no assumed legal/accounting approval. | Client Lead / Chartered Accountant | Prior to Prompt 29 (Production Pre-flight) |
| **DEC-OPEN-02** | Required before production | Doctor Commission Governance & Compliance Activation | Feature must be configurable and disabled by default due to medical ethics regulations. Requires formal legal compliance record for production activation. | Prompt 10 (Doctors), Prompt 11 (Calc Engine), Prompt 12 (Billing), Prompts 25 & 29 (Security & Pre-flight) | Configurable flag (`enableDoctorCommission: false` by default); feature is not hardcoded permanently to false. | Client Legal Counsel | Prior to Prompt 29 (Production Pre-flight) |
| **DEC-OPEN-03** | Required before production | Schedule H/H1/X & Prescription Retention Policy | Retention duration and mandatory patient/doctor prescription requirements remain unresolved until confirmed by a qualified pharmacy/legal professional. | Prompt 6 (Catalogue), Prompt 12 (Billing Hooks), Prompt 29 (Pre-flight) | Configurable retention settings with no unapproved production default; validation hooks do not imply legal compliance. | Pharmacist-in-Charge / Legal | Prior to Prompt 29 (Production Pre-flight) |
| **DEC-OPEN-04** | Required before production | Employee PAN/Aadhaar DPDP Compliance & PII Handling | Default MVP behavior stores strictly approved masked/last-four values (`aadhaarLastFour`, `panLastFour`). Storing raw identifiers requires approved purpose, consent, encryption, and retention. | Prompt 10 (Employees), Prompt 25 (Security), Prompt 29 (Pre-flight) | Store only last-four masked strings by default (`aadhaarLastFour`, `panLastFour`). Raw PII prohibited without signed consent protocol. | Security Lead / Legal | Prior to Prompt 29 (Production Pre-flight) |
| **DEC-OPEN-05** | Optional Future Enhancement | Customer Credit Accounts & Debt Write-off | Customer credit sales and debt write-offs are **NOT part of the approved MVP**. Explicitly deferred to post-MVP phase. | `OPTIONAL FUTURE ENHANCEMENT — NOT PART OF MVP` | Excluded from MVP scope; credit sales rejected at POS terminal. | Product Owner | Post-MVP Evaluation |
| **DEC-OPEN-06** | Required before production | Thermal 80mm Browser-Print Layout & Printer Acceptance | MVP output is restricted to an 80mm browser-printable HTML/CSS layout (`window.print()`). Direct ESC/POS hardware drivers are outside MVP. | Prompt 15 (Print Engine), Prompt 26 (Responsive/A11y), Prompt 29 (Pre-flight) | Standard 80mm browser HTML/CSS responsive print stylesheet; no hardware driver dependencies. | Frontend Lead / Client | Prior to Prompt 29 (Production Pre-flight) |

---

## 2. Detailed Decision Specifications & Governance Rules

### DEC-OPEN-01: GST and Accounting Configuration
- **Scope & Timeline:** Primary calculation engine implemented in **Prompt 11**. Billing usage begins in **Prompts 12 and 13**. Final CA-approved configuration required before production in **Prompt 29**.
- **Rules:**
  - Do not assume any tax rounding or discount tax-allocation rule has legal or accounting approval.
  - A documented temporary calculation policy (e.g. half-up paise rounding on net taxable amount) may be used strictly in development fixtures and unit test mocks.
  - The calculation engine must support versioned calculation rules (`calculationVersion`) so changes approved by the CA can be applied without altering historic finalized invoices.

### DEC-OPEN-02: Doctor Commission Governance
- **Scope & Timeline:** Doctor registry handling begins in **Prompt 10**. Commission calculation engine implemented in **Prompt 11**. Billing UI integration occurs in **Prompt 12**. Security and compliance reviewed in **Prompts 25 and 29**.
- **Rules:**
  - The feature must be configurable and disabled by default (`enableDoctorCommission: false`).
  - Do **not** hardcode the feature permanently to false; architect a configurable toggle backed by store settings.
  - Production activation requires an attached, approved legal compliance record.

### DEC-OPEN-03: Schedule H / H1 / X & Prescription Retention
- **Scope & Timeline:** Medicine classification attributes defined in **Prompt 6**. Billing validation hooks added in **Prompt 12**. Production compliance reviewed in **Prompt 29**.
- **Rules:**
  - Do **not** invent or hardcode a 5-year retention period. Retention duration and mandatory patient/doctor metadata requirements remain unresolved until formally confirmed by a qualified pharmacy/legal professional.
  - Use configurable retention settings with no unapproved production default.
  - Do **not** claim the application is legally compliant merely because validation hooks or prescription upload fields exist.

### DEC-OPEN-04: Employee PAN / Aadhaar & DPDP Compliance
- **Scope & Timeline:** Employee handling begins in **Prompt 10**. Security review occurs in **Prompt 25**. Production retention approval required in **Prompt 29**.
- **Rules:**
  - Default MVP behavior stores **strictly approved masked/last-four values** (`aadhaarLastFour`, `panLastFour`).
  - Do **not** store complete PAN or Aadhaar numbers by default in MVP.
  - Do **not** use "mask the first five PAN characters" as a substitute for the agreed last-four-only model.
  - Storage of raw identifiers requires a separately approved business purpose, consent/notice process, retention policy, AES-256 encryption, and restricted role access.

### DEC-OPEN-05: Customer Credit (Excluded from MVP)
- **Status:** **OPTIONAL FUTURE ENHANCEMENT — NOT PART OF MVP**.
- **Rules:**
  - Customer credit sales, credit balance tracking, and debt write-offs are completely removed from the MVP scope.
  - Prompt 17 is dedicated exclusively to **Cancellation/Refund Approval Requests**, not customer credit.

### DEC-OPEN-06: Thermal Printing Scope
- **Scope & Timeline:** Printable layouts implemented in **Prompt 15**. Accessibility and responsive print verification in **Prompt 26**. Production acceptance in **Prompt 29**.
- **Rules:**
  - MVP includes an 80mm browser-printable HTML/CSS layout utilizing standard browser print stylesheets (`@media print`).
  - Direct ESC/POS socket commands, physical printer drivers, and hardware serial communication are explicitly outside MVP.
  - All references describing the MVP output as an ESC/POS template or direct printer integration are strictly removed.

---

## 3. Mandatory Pre-Flight Sign-Off Block (Prompt 29 Execution)

```markdown
### Production Gate Sign-Off Checklist (Prompt 29 Pre-Flight)

- [ ] DEC-OPEN-01: CA Sign-off on GST Tax Math & Accounting Config (Signed by: ____________ Date: __________)
- [ ] DEC-OPEN-02: Legal Sign-off on Doctor Commission Compliance Record (Signed by: ____________ Date: __________)
- [ ] DEC-OPEN-03: Pharmacist Sign-off on Schedule H/H1/X Retention & Validation (Signed by: ____________ Date: __________)
- [ ] DEC-OPEN-04: Legal/Security Sign-off on Employee PII DPDP Compliance (Signed by: ____________ Date: __________)
- [ ] DEC-OPEN-06: Client Sign-off on 80mm Browser-Print Layout & A4 Invoice (Signed by: ____________ Date: __________)
```
