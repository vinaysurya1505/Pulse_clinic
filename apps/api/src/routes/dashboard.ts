import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { DailyClosingService } from '../services/DailyClosingService';

export const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.use(authMiddleware);
dashboardRouter.use(tenantMiddleware);

// 1. Get Live Executive Store Dashboard KPIs
dashboardRouter.get('/', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  try {
    const metrics = await DailyClosingService.getDashboardMetrics(storeId);
    res.json({
      success: true,
      metrics,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const closingSchema = z.object({
  notes: z.string().optional(),
});

// 2. Execute Daily Closing
dashboardRouter.post('/daily-closing', requirePermission('store.update'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const closedByUid = req.authContext?.uid || 'manager';

  const parsed = closingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors.map((e) => e.message).join(', ') });
    return;
  }

  try {
    const summary = await DailyClosingService.executeDailyClosing(storeId, closedByUid, parsed.data.notes);
    res.json({
      success: true,
      summary,
      message: `Daily register closed and locked for ${summary.summaryDate}.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
