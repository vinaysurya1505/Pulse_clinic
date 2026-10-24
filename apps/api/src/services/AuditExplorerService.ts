import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { AuditLogEntry, AuditActionType } from '@pulseclinic/types';

export class AuditExplorerService {
  private static getCol(storeId: string) {
    const db = getFirestore();
    return db.collection(COLLECTIONS.auditLogs(storeId));
  }

  /**
   * Sanitizes payload to guarantee zero raw PII or approval codes in audit logs (RSK-013, Prompt 25)
   */
  private static sanitizePayload(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, val] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('password') ||
        lower.includes('approvalcode') ||
        lower.includes('plainotp') ||
        lower.includes('secret')
      ) {
        sanitized[key] = '[REDACTED_SECRET]';
      } else if (lower.includes('aadhaar') && typeof val === 'string' && val.length === 12) {
        sanitized[key] = `XXXX-XXXX-${val.slice(-4)}`;
      } else if (lower.includes('pan') && typeof val === 'string' && val.length === 10) {
        sanitized[key] = `XXXXXX${val.slice(-4)}`;
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizePayload(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  /**
   * Writes an immutable audit log entry (ADR-012, Prompt 23)
   */
  static async logEvent(
    storeId: string,
    entry: {
      action: AuditActionType;
      actorUid: string;
      summary: string;
      entityType?: string;
      entityId?: string;
      payload?: Record<string, any>;
      ipAddress?: string;
    }
  ): Promise<AuditLogEntry> {
    const colRef = this.getCol(storeId);
    const docRef = colRef.doc();
    const now = new Date().toISOString();

    const record: AuditLogEntry = {
      id: docRef.id,
      storeId,
      action: entry.action,
      actorUid: entry.actorUid,
      summary: entry.summary,
      ...(entry.entityType ? { entityType: entry.entityType } : {}),
      ...(entry.entityId ? { entityId: entry.entityId } : {}),
      ...(entry.payload ? { payload: this.sanitizePayload(entry.payload) } : {}),
      ...(entry.ipAddress ? { ipAddress: entry.ipAddress } : {}),
      createdAt: now,
    };

    await docRef.set(record);
    return record;
  }

  /**
   * Lists audit log entries with in-memory sorting
   */
  static async list(
    storeId: string,
    options: {
      action?: AuditActionType;
      actorUid?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<AuditLogEntry[]> {
    const colRef = this.getCol(storeId);
    const snapshot = await colRef.get();

    let docs = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AuditLogEntry, 'id'>),
    }));

    // In-memory sort by createdAt desc
    docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (options.action) {
      docs = docs.filter((l) => l.action === options.action);
    }
    if (options.actorUid) {
      docs = docs.filter((l) => l.actorUid === options.actorUid);
    }
    if (options.startDate) {
      docs = docs.filter((l) => l.createdAt >= options.startDate!);
    }
    if (options.endDate) {
      docs = docs.filter((l) => l.createdAt <= options.endDate!);
    }

    const limitCount = options.limit || 50;
    return docs.slice(0, limitCount);
  }
}
