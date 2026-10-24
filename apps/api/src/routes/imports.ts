import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { CSVImportEngine } from '../services/CSVImportEngine';
import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { ImportJob } from '@pulseclinic/types';

export const importRouter = Router({ mergeParams: true });

importRouter.use(authMiddleware);
importRouter.use(tenantMiddleware);

const previewSchema = z.object({
  csvContent: z.string().min(5, 'CSV content is required'),
});

const commitSchema = z.object({
  csvContent: z.string().min(5, 'CSV content is required'),
});

// 1. Preview CSV & Validate
importRouter.post('/csv/preview', requirePermission('import.execute'), async (req: Request, res: Response) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_PAYLOAD', message: parsed.error.errors.map((e) => e.message).join(', ') },
    });
    return;
  }

  try {
    const preview = CSVImportEngine.preview(parsed.data.csvContent);
    res.json({ success: true, preview });
  } catch (err: unknown) {
    console.error('Error previewing CSV:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CSV_PREVIEW_FAILED', message: err instanceof Error ? err.message : 'Failed to preview CSV' },
    });
  }
});

// 2. Commit CSV Import Job (with Dynamic Write-Budget Chunking & Idempotency)
importRouter.post('/csv/commit', requirePermission('import.execute'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const userId = req.authContext!.uid;
  const userName = req.authContext!.name;

  const parsed = commitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_PAYLOAD', message: parsed.error.errors.map((e) => e.message).join(', ') },
    });
    return;
  }

  try {
    const job = await CSVImportEngine.commit(storeId, parsed.data.csvContent, userId, userName);
    res.status(201).json({ success: true, job });
  } catch (err: unknown) {
    console.error('Error committing CSV import:', err);
    const msg = err instanceof Error ? err.message : 'Failed to commit CSV import';
    const isDup = msg.includes('DUPLICATE_IMPORT');
    res.status(isDup ? 409 : 500).json({
      success: false,
      error: { code: isDup ? 'DUPLICATE_IMPORT' : 'COMMIT_IMPORT_FAILED', message: msg },
    });
  }
});

// 3. Get CSV Import Job Status
importRouter.get('/csv/:jobId', requirePermission('import.execute'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;

  try {
    const db = getFirestore();
    const docSnap = await db.collection(COLLECTIONS.importJobs(storeId)).doc(jobId).get();
    if (!docSnap.exists) {
      res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Import job not found' },
      });
      return;
    }

    const job = docSnap.data() as ImportJob;
    res.json({ success: true, job: { ...job, id: docSnap.id } });
  } catch (err: unknown) {
    console.error('Error getting import job:', err);
    res.status(500).json({
      success: false,
      error: { code: 'GET_JOB_FAILED', message: 'Failed to retrieve import job status' },
    });
  }
});
