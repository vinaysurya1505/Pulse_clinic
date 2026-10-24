export interface SupplierProfile {
  id: string;
  storeId: string;
  name: string;
  gstin?: string;
  phone: string;
  email?: string;
  contactPerson?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  paymentTermsDays: number; // e.g. 30 days
  currentBalancePaise: number; // Total outstanding debt owed to supplier in integer paise
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  name: string;
  gstin?: string;
  phone: string;
  email?: string;
  contactPerson?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  paymentTermsDays?: number;
}

export const SupplierLedgerEntryTypes = {
  INVOICE_PURCHASE: 'INVOICE_PURCHASE',
  PAYMENT_MADE: 'PAYMENT_MADE',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
} as const;

export type SupplierLedgerEntryType = (typeof SupplierLedgerEntryTypes)[keyof typeof SupplierLedgerEntryTypes];

export interface SupplierLedgerEntry {
  id: string;
  storeId: string;
  supplierId: string;
  supplierName: string;
  entryType: SupplierLedgerEntryType;
  amountPaise: number; // Positive for purchases (increases debt), negative for payments (reduces debt)
  balanceAfterPaise: number;
  referenceType: 'PO' | 'PAYMENT' | 'GRN';
  referenceId: string;
  referenceNumber: string; // e.g. PO-202610-001 or CHQ-99120
  paymentMode?: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'UPI';
  notes?: string;
  performedBy: string;
  performedByName?: string;
  createdAt: string;
}

export interface RecordSupplierPaymentInput {
  supplierId: string;
  amountPaise: number;
  paymentMode: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'UPI';
  referenceNumber: string;
  notes?: string;
}
