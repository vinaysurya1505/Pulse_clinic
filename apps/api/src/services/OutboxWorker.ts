import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';

// 32-byte key for AES-256-GCM
const ENCRYPTION_KEY = Buffer.from(
  (process.env.OUTBOX_ENCRYPTION_KEY || 'pulseclinic_secret_key_32bytes!').padEnd(32, '0').slice(0, 32),
  'utf8'
);

export interface OutboxEmailPayload {
  to: string;
  subject: string;
  body: string;
  metadata?: Record<string, any>;
}

export interface EncryptedOutboxDoc {
  id: string;
  encryptedData: string; // Hex
  iv: string; // Hex (12 bytes for GCM)
  authTag: string; // Hex (16 bytes)
  status: 'QUEUED' | 'SENT' | 'FAILED';
  attempts: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class OutboxWorker {
  /**
   * Encrypts plaintext payload using AES-256-GCM (ADR-016)
   */
  static encryptPayload(payload: OutboxEmailPayload): { encryptedData: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

    const json = JSON.stringify(payload);
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  /**
   * Decrypts encrypted payload using AES-256-GCM (ADR-016)
   */
  static decryptPayload(encryptedData: string, ivHex: string, authTagHex: string): OutboxEmailPayload {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Enqueues an encrypted message to the outbox collection
   */
  static async enqueueEmail(payload: OutboxEmailPayload): Promise<string> {
    const db = getFirestore();
    const outboxCol = db.collection(COLLECTIONS.outbox);
    const docRef = outboxCol.doc();

    const { encryptedData, iv, authTag } = this.encryptPayload(payload);
    const now = new Date().toISOString();

    const doc: EncryptedOutboxDoc = {
      id: docRef.id,
      encryptedData,
      iv,
      authTag,
      status: 'QUEUED',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(doc);
    return docRef.id;
  }

  /**
   * Processes queued outbox items (simulates or executes sending)
   */
  static async processOutbox(limitCount: number = 10): Promise<{ processed: number; sent: number; failed: number }> {
    const db = getFirestore();
    const outboxCol = db.collection(COLLECTIONS.outbox);

    const snapshot = await outboxCol.where('status', '==', 'QUEUED').limit(limitCount).get();
    let sent = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as EncryptedOutboxDoc;
      try {
        const payload = this.decryptPayload(data.encryptedData, data.iv, data.authTag);

        // Check if SMTP credentials are provided (Gmail SMTP)
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '465', 10),
            secure: process.env.SMTP_SECURE !== 'false',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          await transporter.sendMail({
            from: `"PulseClinic Pharmacy" <${process.env.SMTP_USER}>`,
            to: payload.to,
            subject: payload.subject,
            text: payload.body,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                  <h2 style="color: #2563eb; margin: 0; font-size: 20px;">PulseClinic Security & Approvals</h2>
                </div>
                <div style="font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap; background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
${payload.body}
                </div>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="font-size: 11px; color: #64748b; margin: 0;">
                  This is an automated administrative notification sent from PulseClinic Pharmacy Management System.
                </p>
              </div>
            `,
          });
          console.log(`[SMTP_SUCCESS] Live email delivered to ${payload.to} via Gmail SMTP.`);
        } else {
          console.log(`[OUTBOX_DELIVERY] Delivered email to ${payload.to}: ${payload.subject}`);
          console.log(`[OUTBOX_CONTENT] ${payload.body}`);
        }

        await doc.ref.update({
          status: 'SENT',
          updatedAt: new Date().toISOString(),
        });
        sent++;
      } catch (err: any) {
        console.error(`[OUTBOX_FAILED] Failed to process doc ${doc.id}:`, err.message);
        await doc.ref.update({
          status: 'FAILED',
          attempts: (data.attempts || 0) + 1,
          error: err.message,
          updatedAt: new Date().toISOString(),
        });
        failed++;
      }
    }

    return { processed: snapshot.docs.length, sent, failed };
  }
}
