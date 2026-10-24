export type AuditActionType = 'AUTH_LOGIN' | 'ROLE_UPDATED' | 'BILL_FINALIZED' | 'APPROVAL_CODE_REQUESTED' | 'APPROVAL_CODE_RESENT' | 'INVOICE_REFUNDED' | 'STOCK_ADJUSTMENT' | 'EXPENSE_RECORDED' | 'DAILY_CLOSING_EXECUTED' | 'CSV_IMPORT_EXECUTED' | 'MEMBER_INVITED';
export interface AuditLogEntry {
    id: string;
    storeId: string;
    action: AuditActionType;
    actorUid: string;
    entityType?: string;
    entityId?: string;
    summary: string;
    payload?: Record<string, any>;
    ipAddress?: string;
    createdAt: string;
}
//# sourceMappingURL=audit.d.ts.map