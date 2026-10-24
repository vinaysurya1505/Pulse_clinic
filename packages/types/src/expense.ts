export type ExpenseCategory =
  | 'RENT'
  | 'UTILITIES'
  | 'SALARY'
  | 'MAINTENANCE'
  | 'PACKAGING'
  | 'PETTY_CASH'
  | 'MARKETING'
  | 'MISCELLANEOUS';

export type ExpensePaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD';

export interface ExpenseRecord {
  id: string;
  storeId: string;
  category: ExpenseCategory;
  amountPaise: number;
  paymentMode: ExpensePaymentMode;
  description: string;
  vendorName?: string;
  billInvoiceNumber?: string;
  paidByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseInput {
  category: ExpenseCategory;
  amountPaise: number;
  paymentMode: ExpensePaymentMode;
  description: string;
  vendorName?: string;
  billInvoiceNumber?: string;
}

export interface CashRegisterSession {
  id: string;
  storeId: string;
  sessionDate: string; // YYYY-MM-DD
  status: 'OPEN' | 'CLOSED';
  openingCashPaise: number;
  openingNotes?: string;
  openedBy: string;
  openedAt: string;
  closingCashCountPaise?: number;
  expectedCashPaise?: number;
  discrepancyPaise?: number;
  closingNotes?: string;
  closedBy?: string;
  closedAt?: string;
  totalCashSalesPaise?: number;
  totalCashExpensesPaise?: number;
  totalCashRefundsPaise?: number;
  updatedAt: string;
}

export interface OpenCashRegisterInput {
  openingCashPaise: number;
  notes?: string;
}

export interface CloseCashRegisterInput {
  actualCashCountPaise: number;
  notes?: string;
}
