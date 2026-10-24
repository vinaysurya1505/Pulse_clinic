export interface Gstr1HsnSummaryItem {
  hsnCode: string;
  description: string;
  uqc: string;
  totalQuantity: number;
  totalValuePaise: number;
  taxableValuePaise: number;
  igstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  cessPaise: number;
}

export interface Gstr1ReportResponse {
  storeId: string;
  gstin: string;
  startDate: string;
  endDate: string;
  totalInvoicesCount: number;
  totalTaxableValuePaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  hsnSummary: Gstr1HsnSummaryItem[];
}

export interface FinancialReportResponse {
  storeId: string;
  startDate: string;
  endDate: string;
  grossSalesPaise: number;
  totalDiscountsPaise: number;
  taxableSalesPaise: number;
  totalTaxPaise: number;
  netSalesPaise: number;
  totalRefundsPaise: number;
  totalExpensesPaise: number;
  netProfitPaise: number;
  invoiceCount: number;
  refundCount: number;
  paymentModeBreakdown: {
    cashPaise: number;
    upiPaise: number;
    cardPaise: number;
  };
  taxSlabBreakdown: Array<{
    gstRateBps: number;
    taxablePaise: number;
    taxPaise: number;
  }>;
}
