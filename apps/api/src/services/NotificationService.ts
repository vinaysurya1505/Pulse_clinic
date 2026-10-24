import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { BatchInventory, StoreNotification } from '@pulseclinic/types';

export class NotificationService {
  private static getCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.notifications(storeId));
  }

  static async list(storeId: string, limitCount: number = 30): Promise<StoreNotification[]> {
    const colRef = this.getCol(storeId);
    const snapshot = await colRef.get();

    const notifications = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<StoreNotification, 'id'>),
    }));

    notifications.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return notifications.slice(0, limitCount);
  }

  static async markAsRead(storeId: string, id: string): Promise<boolean> {
    const colRef = this.getCol(storeId);
    await colRef.doc(id).update({ isRead: true });
    return true;
  }

  static async scanAndGenerateAlerts(storeId: string): Promise<{ lowStockCreated: number; nearExpiryCreated: number }> {
    const db = getFirestore();
    const batchesCol = db.collection(COLLECTIONS.batches(storeId));
    const notifCol = this.getCol(storeId);

    const snapshot = await batchesCol.get();
    const todayStr = new Date().toISOString().split('T')[0];

    const ninetyDays = new Date();
    ninetyDays.setDate(ninetyDays.getDate() + 90);
    const ninetyDaysStr = ninetyDays.toISOString().split('T')[0];

    let lowStockCreated = 0;
    let nearExpiryCreated = 0;

    for (const doc of snapshot.docs) {
      const b = doc.data() as BatchInventory;
      if (b.status === 'RECALLED') continue;

      const medName = b.medicineBrandName || 'Medicine';

      // 1. Low stock check
      if (b.stockUnits <= 20) {
        const notifId = `low_stock_${b.id}_${todayStr}`;
        const existing = await notifCol.doc(notifId).get();
        if (!existing.exists) {
          const item: StoreNotification = {
            id: notifId,
            storeId,
            type: 'LOW_STOCK',
            title: `Low Stock Alert: ${medName}`,
            message: `Batch ${b.batchNumber} has only ${b.stockUnits} units remaining. Place purchase order to restock.`,
            referenceId: b.id,
            isRead: false,
            createdAt: new Date().toISOString(),
          };
          await notifCol.doc(notifId).set(item);
          lowStockCreated++;
        }
      }

      // 2. Near expiry check
      if (b.expiryDate && b.expiryDate <= ninetyDaysStr) {
        const notifId = `near_expiry_${b.id}_${todayStr}`;
        const existing = await notifCol.doc(notifId).get();
        if (!existing.exists) {
          const item: StoreNotification = {
            id: notifId,
            storeId,
            type: 'NEAR_EXPIRY',
            title: `Near-Expiry Alert: ${medName}`,
            message: `Batch ${b.batchNumber} expires on ${b.expiryDate} (within 90 days). Prioritize FEFO dispensing.`,
            referenceId: b.id,
            isRead: false,
            createdAt: new Date().toISOString(),
          };
          await notifCol.doc(notifId).set(item);
          nearExpiryCreated++;
        }
      }
    }

    return { lowStockCreated, nearExpiryCreated };
  }
}
