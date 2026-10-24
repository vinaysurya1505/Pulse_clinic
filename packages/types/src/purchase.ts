export const PurchaseOrderStatuses = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type PurchaseOrderStatus = (typeof PurchaseOrderStatuses)[keyof typeof PurchaseOrderStatuses];

export interface POLineItem {
  medicineId: string;
  medicineBrandName: string;
  medicineGenericName: string;
  strength?: string;
  dosageForm?: string;
  stripSize: number;
  quantityPacks: number;
  unitCostPaise: number; // Cost per pack in integer paise
  totalCostPaise: number; // quantityPacks * unitCostPaise
}

export interface PurchaseOrder {
  id: string;
  storeId: string;
  poNumber: string; // e.g. PO-202610-0001
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
  expiryDate: string; // YYYY-MM-DD
  quantityPacks: number;
  stripSize: number;
  purchaseRatePaise: number; // Cost per pack
  mrpPaise: number; // MRP per pack
  rackLocation?: string;
}

export interface ReceiveGRNInput {
  poId: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  batches: GRNBatchReceiptItem[];
  notes?: string;
}
