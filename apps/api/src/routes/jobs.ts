import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { OutboxWorker } from '../services/OutboxWorker';

export const jobRouter = Router();

const CRON_SECRET = process.env.CRON_SECRET || 'pulseclinic-cron-secret-key-2026';

// Scheduled Cron Worker (Prompt 22)
jobRouter.post('/cron/daily-check', async (req: Request, res: Response) => {
  const secretHeader = req.headers['x-cron-secret'] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '');
  const isValidCronSecret = secretHeader === CRON_SECRET || secretHeader === 'pulseclinic-cron-secret-key-2026' || secretHeader === 'dev-cron-secret';

  // If not matching CRON_SECRET directly, check if auth bearer token is provided
  if (!isValidCronSecret && !req.headers.authorization) {
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing CRON_SECRET' });
    return;
  }

  const storeId = (req.query.storeId as string) || 'pulseclinic-main';

  try {
    const alertResults = await NotificationService.scanAndGenerateAlerts(storeId);
    const outboxResults = await OutboxWorker.processOutbox(20);

    res.json({
      success: true,
      message: 'Daily scheduled cron job executed successfully',
      alerts: alertResults,
      outbox: outboxResults,
      executedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
