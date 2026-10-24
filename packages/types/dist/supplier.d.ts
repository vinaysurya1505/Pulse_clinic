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
    paymentTermsDays: number;
    currentBalancePaise: number;
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
export declare const SupplierLedgerEntryTypes: {
    readonly INVOICE_PURCHASE: "INVOICE_PURCHASE";
    readonly PAYMENT_MADE: "PAYMENT_MADE";
    readonly PURCHASE_RETURN: "PURCHASE_RETURN";
};
export type SupplierLedgerEntryType = (typeof SupplierLedgerEntryTypes)[keyof typeof SupplierLedgerEntryTypes];
export interface SupplierLedgerEntry {
    id: string;
    storeId: string;
    supplierId: string;
    supplierName: string;
    entryType: SupplierLedgerEntryType;
    amountPaise: number;
    balanceAfterPaise: number;
    referenceType: 'PO' | 'PAYMENT' | 'GRN';
    referenceId: string;
    referenceNumber: string;
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
//# sourceMappingURL=supplier.d.ts.map