# System Architecture & Workflow Mermaid Diagrams

This document collects all 6 required compact Mermaid visual workflow and architectural diagrams for the Pharmacy AI Agent system in accordance with Pack 1.2 specifications and Prompt 1A corrections.

---

## 1. Runtime Architecture Topology

```mermaid
graph TD
    Client["Client Browser (Next.js SPA)"] -->|HTTPS / REST API| VercelAPI["Vercel Backend API (Node.js/Express)"]
    Client -->|Google Sign-In| FirebaseAuth["Firebase Authentication"]
    
    subgraph Vercel ["Vercel Infrastructure"]
        VercelAPI --> AuthMiddleware["Auth & Tenant Middleware (Prompts 4 & 5)"]
        AuthMiddleware --> BillingEngine["Billing Engine (Prompts 11 & 13)"]
        AuthMiddleware --> FEFOService["FEFO & Stock Engine (Prompt 7)"]
        AuthMiddleware --> ApprovalService["Approval Code Engine (Prompts 17 & 18)"]
    end

    subgraph Firebase ["Firebase & GCP Infrastructure"]
        VercelAPI -->|Firebase Admin SDK| Firestore["Cloud Firestore Standard (Blaze)"]
        VercelAPI -->|Signed URLs| Storage["Firebase Storage"]
    end

    subgraph External ["External Services"]
        ApprovalService -->|AES-256 Encrypted Outbox| ResendWorker["Resend Email Provider"]
        ResendWorker -->|Approval Code Email| SuperAdminEmail["Super Admin Inbox"]
    end
```

---

## 2. Authentication & Store Membership Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Cashier / Staff
    participant Auth as Firebase Auth (Google OAuth)
    participant Client as Next.js Web App
    participant Backend as Express API Server
    participant DB as Cloud Firestore

    User->>Client: Click "Sign in with Google" (Prompt 4)
    Client->>Auth: Trigger Google Sign-In Popup
    Auth-->>Client: Return Firebase ID Token (JWT)
    Client->>Backend: POST /api/v1/auth/session { idToken }
    Backend->>Auth: Verify ID Token signature & claims
    Backend->>DB: Query stores/{storeId}/members/{uid} (Prompt 5)
    alt Active Store Membership Exists
        DB-->>Backend: Return Member Role & Permissions
        Backend-->>Client: HTTP 200 OK (Session & Store Context)
        Client-->>User: Render Store Dashboard UI
    else No Store Membership
        DB-->>Backend: Member Document Not Found / Suspended
        Backend-->>Client: HTTP 403 Forbidden (Membership Required)
        Client-->>User: Render "Access Denied / Select Store" Screen
    end
```

---

## 3. Bill-Finalization Transaction Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Cashier as Pharmacist / Cashier
    participant POS as POS Web Interface (Prompt 12)
    participant API as Express Billing API (Prompt 13)
    participant DB as Cloud Firestore Transaction

    Cashier->>POS: Scan items & Click "Finalize Bill (F10)"
    POS->>API: POST /api/v1/bills (with Idempotency-Key)
    
    rect rgb(230, 245, 255)
        note right of API: Atomic Firestore Transaction Block (Prompt 13)
        API->>DB: Read & Lock batch stock documents (FEFO order - Prompt 7)
        API->>DB: Read & Lock counter document (stores/{storeId}/counters/invoices)
        
        alt Stock Available & Batches Valid
            API->>DB: Increment counter -> Reserve Invoice No (e.g. INV-202609-000142)
            API->>DB: Decrement batch stockUnits (e.g. Batch B-102 -10 units)
            API->>DB: Write immutable stockLedger debit entries
            API->>DB: Write invoice document (status: 'FINALIZED')
            API->>DB: Write salesLedger credit entries & update dailySummary
            DB-->>API: Commit Transaction Success
            API-->>POS: HTTP 201 Created (Invoice Detail)
            POS-->>Cashier: Trigger Browser Print (A4 PDF / 80mm Thermal - Prompt 15)
        else Stock Depleted / Batch Expired
            DB-->>API: Abort Transaction
            API-->>POS: HTTP 409 Conflict / 400 Bad Request
            POS-->>Cashier: Alert "Insufficient Batch Stock"
        end
    end
```

---

## 4. Cancellation / Refund Approval & Reversal Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Pharmacist / Operator
    participant UI as POS Modal Interface
    participant API as Express API Server
    participant DB as Cloud Firestore
    actor Admin as Super Admin Email
    
    Operator->>UI: Click "Request Refund" on Invoice INV-001 (Prompt 17)
    UI->>API: POST /api/v1/bills/INV-001/request-approval
    API->>API: Generate 8-char OTP & HMAC-SHA256 hash
    API->>DB: Store approvalRequest (hashed OTP, status: PENDING, expires: 15m)
    API->>DB: Write encrypted email payload to outbox collection
    API-->>UI: Return requestId & countdown timer
    
    note over API,Admin: Outbox worker decrypts & sends email via Resend (Prompt 17)
    API->>Admin: Email Notification with Plaintext 8-char OTP Code
    Admin-->>Operator: Communicates Approval Code via Store Policy
    
    Operator->>UI: Enter 8-char Code into Modal & Click "Confirm Refund" (Prompt 18)
    UI->>API: POST /api/v1/bills/INV-001/refund { requestId, approvalCode }
    
    rect rgb(255, 240, 240)
        note right of API: Atomic Reversal Transaction (Prompt 18)
        API->>DB: Verify HMAC hash match, expiry time, and attempts < 3
        API->>DB: Update invoice status to 'REFUNDED'
        API->>DB: Return restored units to batch stockUnits
        API->>DB: Write reversal stockLedger credit & salesLedger debit entries
        API->>DB: Update approvalRequest status to 'CONSUMED'
        DB-->>API: Transaction Committed
        API-->>UI: HTTP 200 OK (Refund Completed & Reversal Ledger Logged)
    end
```

---

## 5. Dynamic CSV Batch Import State Machine

```mermaid
stateDiagram-v2
    [*] --> QUEUED: File Uploaded & SHA-256 Hash Validated (Prompt 8)
    
    QUEUED --> PROCESSING: Worker Picks Import Job
    
    state PROCESSING {
        [*] --> READING_CHUNK: Parse Max 25 CSV Rows
        READING_CHUNK --> VALIDATING_SCHEMA: Validate Row Types & Constraints
        
        VALIDATING_SCHEMA --> WRITING_BATCH: Schema Check Passed
        VALIDATING_SCHEMA --> RECORDING_ERROR: Validation Error Found
        
        WRITING_BATCH --> CHECKING_REMAINING: Firestore Batch Transaction Committed
        RECORDING_ERROR --> CHECKING_REMAINING: Error Logged to Job Summary
        
        CHECKING_REMAINING --> READING_CHUNK: More Rows Remaining
        CHECKING_REMAINING --> FINALIZE: All Rows Ingested
    }
    
    PROCESSING --> COMPLETED: 100% Rows Imported Without Errors
    PROCESSING --> COMPLETED_WITH_ERRORS: Partial Success (Error Log Generated)
    PROCESSING --> FAILED: Fatal Ingestion Error / Hash Collision
    
    COMPLETED --> [*]
    COMPLETED_WITH_ERRORS --> [*]
    FAILED --> [*]
```

---

## 6. Bill Status Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Cashier Adds Items to Cart (Prompt 12)
    
    DRAFT --> FINALIZED: Finalize & Pay (Atomic Transaction & Counter Allocated - Prompt 13)
    DRAFT --> CANCELLED_DRAFT: Cashier Clears / Abandons Cart
    
    FINALIZED --> REFUNDED: OTP Verified & Full Refund Executed (Prompt 18)
    FINALIZED --> PARTIALLY_REFUNDED: OTP Verified & Partial Line Item Refund Executed (Prompt 18)
    
    CANCELLED_DRAFT --> [*]
    REFUNDED --> [*]
    PARTIALLY_REFUNDED --> [*]
```
