import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { NotificationService } from '../services/NotificationService';

export const notificationRouter = Router({ mergeParams: true });

notificationRouter.use(authMiddleware);
notificationRouter.use(tenantMiddleware);

// 1. List Notifications
notificationRouter.get('/', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;

  try {
    const notifications = await NotificationService.list(storeId, limit);
    res.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Mark Notification as Read
notificationRouter.put('/:id/read', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    await NotificationService.markAsRead(storeId, id);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
