export declare const PurchaseOrderStatuses: {
    readonly DRAFT: "DRAFT";
    readonly ISSUED: "ISSUED";
    readonly RECEIVED: "RECEIVED";
    readonly CANCELLED: "CANCELLED";
};
export type PurchaseOrderStatus = (typeof PurchaseOrderStatuses)[keyof typeof PurchaseOrderStatuses];
export interface POLineItem {
    medicineId: string;
    medicineBrandName: string;
    medicineGenericName: string;
    strength?: string;
    dosageForm?: string;
    stripSize: number;
    quantityPacks: number;
    unitCostPaise: number;
    totalCostPaise: number;
}
export interface PurchaseOrder {
    id: string;
    storeId: string;
    poNumber: string;
    supplierId: string;
    supplierName: string;
    status: PurchaseOrderStatus;
    lineItems: POLineItem[];
    totalAmountPaise: number;
    supplierInvoiceNumber?: string;
    supplierInvoiceDate?: string;
    notes?: string;
    issuedAt?: string;
    receivedAt?: string;
    createdBy: string;
    createdByName?: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreatePOInput {
    supplierId: string;
    lineItems: Array<{
        medicineId: string;
        quantityPacks: number;
        unitCostPaise: number;
    }>;
    notes?: string;
}
export interface GRNBatchReceiptItem {
    medicineId: string;
    batchNumber: string;
    expiryDate: string;
    quantityPacks: number;
    stripSize: number;
    purchaseRatePaise: number;
    mrpPaise: number;
    rackLocation?: string;
}
export interface ReceiveGRNInput {
    poId: string;
    supplierInvoiceNumber: string;
    supplierInvoiceDate: string;
    batches: GRNBatchReceiptItem[];
    notes?: string;
}
//# sourceMappingURL=purchase.d.ts.map