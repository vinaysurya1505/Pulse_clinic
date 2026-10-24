import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { GSTReportService } from '../services/GSTReportService';
import { ReportGeneratorService } from '../services/ReportGeneratorService';

export const reportRouter = Router({ mergeParams: true });

reportRouter.use(authMiddleware);
reportRouter.use(tenantMiddleware);

// 1. GSTR-1 HSN Summary
reportRouter.get('/gst/gstr1', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { startDate, endDate } = req.query;

  try {
    const report = await GSTReportService.compileGstr1Report(
      storeId,
      startDate as string,
      endDate as string
    );
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GSTR-1 CSV Download
reportRouter.get('/gst/gstr1/csv', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { startDate, endDate } = req.query;

  try {
    const report = await GSTReportService.compileGstr1Report(
      storeId,
      startDate as string,
      endDate as string
    );
    const csvData = GSTReportService.generateGstr1Csv(report);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="GSTR1_HSN_${report.startDate}_to_${report.endDate}.csv"`
    );
    res.send(csvData);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Financial Performance Report
reportRouter.get('/financial', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { startDate, endDate } = req.query;

  try {
    const report = await ReportGeneratorService.compileFinancialReport(
      storeId,
      startDate as string,
      endDate as string
    );
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Inventory Stock Movement Report
reportRouter.get('/inventory/movement', requirePermission('inventory.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { startDate, endDate } = req.query;

  try {
    const report = await ReportGeneratorService.compileInventoryMovement(
      storeId,
      startDate as string,
      endDate as string
    );
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
