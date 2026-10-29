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
  html?: string;
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
            from: `"New Sanjivani Clinic" <${process.env.SMTP_USER}>`,
            to: payload.to,
            subject: payload.subject,
            text: payload.body,
            html: payload.html || this.generateDefaultHtml(payload),
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

  /**
   * Fallback clean HTML renderer for generic outbox emails
   */
  static generateDefaultHtml(payload: OutboxEmailPayload): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${payload.subject}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 20px 24px; text-align: center;">
      <h2 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 700;">New Sanjivani Multispeciality Clinic</h2>
      <p style="margin: 4px 0 0 0; color: #93c5fd; font-size: 12px;">Security & Administration Notification</p>
    </div>
    <div style="padding: 24px;">
      <div style="font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap; background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
${payload.body}
      </div>
    </div>
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b;">
      <div><strong>New Sanjivani Multispeciality Clinic</strong></div>
      <div>Padrauna Road, Naurangia, Kushinagar 274305 • Ph: 8114000119 / 8004807785</div>
    </div>
  </div>
</body>
</html>`;
  }
}
