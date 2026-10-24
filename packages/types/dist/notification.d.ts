export type NotificationType = 'LOW_STOCK' | 'NEAR_EXPIRY' | 'SYSTEM' | 'APPROVAL_REQUEST';
export interface StoreNotification {
    id: string;
    storeId: string;
    type: NotificationType;
    title: string;
    message: string;
    referenceId?: string;
    isRead: boolean;
    createdAt: string;
}
//# sourceMappingURL=notification.d.ts.map