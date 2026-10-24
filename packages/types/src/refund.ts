import { PaymentEntry } from './billing';

export type ApprovalRequestStatus = 'PENDING' | 'CONSUMED' | 'EXPIRED' | 'EXPIRED_MAX_ATTEMPTS';

export interface ApprovalRequest {
  id: string;
  storeId: string;
  invoiceId: string;
  invoiceNumber: string;
  requesterUid: string;
  reason: string;
  otpHash: string; // HMAC-SHA256 hash of the 8-character OTP (ADR-015, RSK-013)
  attempts: number;
  maxAttempts: number; // 3
  status: ApprovalRequestStatus;
  expiresAt: string; // ISO string 15 min from creation
  createdAt: string;
  updatedAt: string;
  consumedAt?: string;
}

export type RefundType = 'FULL' | 'PARTIAL';

export interface RefundLineItem {
  medicineId: string;
  medicineName?: string;
  batchId: string;
  batchNumber?: string;
  quantityUnits: number;
  lineTotalPaise: number;
}

export interface RefundRecord {
  id: string;
  storeId: string;
  invoiceId: string;
  invoiceNumber: string;
  approvalRequestId: string;
  refundType: RefundType;
  items: RefundLineItem[];
  netRefundPaise: number;
  refundModes: PaymentEntry[];
  reason: string;
  processedBy: string;
  createdAt: string;
}

export interface RequestApprovalInput {
  reason: string;
}

export interface ExecuteRefundInput {
  requestId: string;
  approvalCode: string;
  reason?: string;
  refundType?: RefundType;
  lineItems?: Array<{
    batchId: string;
    quantityUnits: number;
  }>;
  refundModes?: PaymentEntry[];
}
