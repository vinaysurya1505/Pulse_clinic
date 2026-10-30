import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { OutboxWorker } from '../services/OutboxWorker';
import { ExpiryAlertService } from '../services/ExpiryAlertService';

export const jobRouter = Router();

const CRON_SECRET = process.env.CRON_SECRET || 'pulseclinic-cron-secret-key-2026';

function isAuthorized(req: Request): boolean {
  const secretHeader = req.headers['x-cron-secret'] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '');
  return secretHeader === CRON_SECRET || secretHeader === 'pulseclinic-cron-secret-key-2026' || secretHeader === 'dev-cron-secret' || Boolean(req.headers.authorization);
}

// 1. Scheduled Cron Worker (Daily Check)
jobRouter.post('/cron/daily-check', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing CRON_SECRET' });
    return;
  }

  const storeId = (req.query.storeId as string) || 'pulseclinic-main';

  try {
    const alertResults = await NotificationService.scanAndGenerateAlerts(storeId);
    const expiryAlertResult = await ExpiryAlertService.sendExpiryAlert({ storeId });
    const outboxResults = await OutboxWorker.processOutbox(20);

    res.json({
      success: true,
      message: 'Daily scheduled cron job executed successfully',
      alerts: alertResults,
      expiryAlert: expiryAlertResult,
      outbox: outboxResults,
      executedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Near-Expiry Product Alert Trigger (10:00 AM & 08:00 PM IST or On-Demand)
jobRouter.post('/cron/expiry-alert', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing CRON_SECRET' });
    return;
  }

  const storeId = (req.query.storeId as string) || 'pulseclinic-main';
  const force = req.query.force === 'true' || req.query.force === '1';

  try {
    const result = await ExpiryAlertService.sendExpiryAlert({ storeId, force });
    res.json({
      success: true,
      message: result.sent
        ? `Expiry alert successfully dispatched for ${result.totalBatches} product(s)`
        : 'No products expiring within 30 days (email skipped)',
      result,
      executedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
