import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { AuditExplorerService } from '../services/AuditExplorerService';
import { AuditActionType } from '@pulseclinic/types';

export const auditLogRouter = Router({ mergeParams: true });

auditLogRouter.use(authMiddleware);
auditLogRouter.use(tenantMiddleware);

// 1. List Audit Logs
auditLogRouter.get('/', requirePermission('audit.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { action, actorUid, startDate, endDate, limit } = req.query;

  try {
    const logs = await AuditExplorerService.list(storeId, {
      action: action as AuditActionType,
      actorUid: actorUid as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });

    res.json({
      success: true,
      logs,
      totalCount: logs.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
