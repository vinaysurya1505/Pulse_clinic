import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { BatchService } from '../services/batch.service';
import { StockLedgerService } from '../services/stock-ledger.service';

export const batchRouter = Router({ mergeParams: true });

batchRouter.use(authMiddleware);
batchRouter.use(tenantMiddleware);

const createBatchSchema = z.object({
  medicineId: z.string().min(1, 'Medicine ID is required'),
  batchNumber: z.string().min(1, 'Batch number is required').trim(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format'),
  mrpPaise: z.number().int().positive('MRP must be positive integer paise'),
  costPricePaise: z.number().int().min(0, 'Cost price must be non-negative integer paise'),
  initialStockUnits: z.number().int().min(0, 'Initial stock units must be non-negative'),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  rackLocation: z.string().optional(),
});

const stockAdjustmentSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required'),
  adjustmentUnits: z.number().int().refine((val) => val !== 0, 'Adjustment units cannot be zero'),
  reason: z.string().min(3, 'A clear reason (min 3 characters) is required for audit trail').trim(),
  movementType: z.enum(['ADJUSTMENT_ADD', 'ADJUSTMENT_SUBTRACT', 'DAMAGE', 'EXPIRED']).optional(),
});

// 1. List / Search Batches
batchRouter.get('/', requirePermission('inventory.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { medicineId, expiryStatus, search, limit, cursor } = req.query;

  try {
    const result = await BatchService.list(storeId, {
      medicineId: typeof medicineId === 'string' ? medicineId : undefined,
      expiryStatus:
        expiryStatus === 'EXPIRED' || expiryStatus === 'NEAR_EXPIRY' || expiryStatus === 'VALID'
          ? expiryStatus
          : 'ALL',
      search: typeof search === 'string' ? search : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });

    res.json({ success: true, batches: result.batches, nextCursor: result.nextCursor });
  } catch (err: unknown) {
    console.error('Error listing batches:', err);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_BATCHES_FAILED', message: 'Failed to retrieve batches.' },
    });
  }
});

// 2. Get FEFO sellable batches for a medicine
batchRouter.get('/fefo', requirePermission('inventory.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { medicineId } = req.query;

  if (!medicineId || typeof medicineId !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_MEDICINE_ID', message: 'medicineId query parameter is required.' },
    });
    return;
  }

  try {
    const batches = await BatchService.getSellableBatchesFEFO(storeId, medicineId);
    res.json({ success: true, batches });
  } catch (err: unknown) {
    console.error('Error getting FEFO batches:', err);
    res.status(500).json({
      success: false,
      error: { code: 'FEFO_LOOKUP_FAILED', message: 'Failed to retrieve FEFO batches.' },
    });
  }
});

// 3. Get Stock Ledger Movement Audit Log
batchRouter.get('/ledger', requirePermission('inventory.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { batchId, medicineId, movementType, limit, cursor } = req.query;

  try {
    const result = await StockLedgerService.list(storeId, {
      batchId: typeof batchId === 'string' ? batchId : undefined,
      medicineId: typeof medicineId === 'string' ? medicineId : undefined,
      movementType: typeof movementType === 'string' ? movementType : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });

    res.json({ success: true, entries: result.entries, nextCursor: result.nextCursor });
  } catch (err: unknown) {
    console.error('Error retrieving stock ledger:', err);
    res.status(500).json({
      success: false,
      error: { code: 'STOCK_LEDGER_FAILED', message: 'Failed to retrieve stock ledger history.' },
    });
  }
});

// 4. Get single batch by ID
batchRouter.get('/:id', requirePermission('inventory.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const batch = await BatchService.getById(storeId, id);
    if (!batch) {
      res.status(404).json({
        success: false,
        error: { code: 'BATCH_NOT_FOUND', message: 'Batch not found.' },
      });
      return;
    }

    res.json({ success: true, batch });
  } catch (err: unknown) {
    console.error('Error getting batch:', err);
    res.status(500).json({
      success: false,
      error: { code: 'GET_BATCH_FAILED', message: 'Failed to fetch batch.' },
    });
  }
});

// 5. Create new batch
batchRouter.post('/', requirePermission('inventory.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const userId = req.authContext!.uid;
  const userName = req.authContext!.name;

  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors.map((e) => e.message).join(', '),
      },
    });
    return;
  }

  try {
    const created = await BatchService.createBatch(storeId, parsed.data, userId, userName);
    res.status(201).json({ success: true, batch: created });
  } catch (err: unknown) {
    console.error('Error creating batch:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_BATCH_FAILED', message: 'Failed to create inventory batch.' },
    });
  }
});

// 6. Adjust Stock (Audit-Logged & Non-Negative Invariant)
batchRouter.post('/adjust', requirePermission('inventory.adjust'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const userId = req.authContext!.uid;
  const userName = req.authContext!.name;

  const parsed = stockAdjustmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors.map((e) => e.message).join(', '),
      },
    });
    return;
  }

  try {
    const result = await BatchService.adjustStock(storeId, parsed.data, userId, userName);
    res.json({
      success: true,
      batch: result.batch,
      ledgerEntry: result.ledgerEntry,
    });
  } catch (err: unknown) {
    console.error('Error adjusting stock:', err);
    const msg = err instanceof Error ? err.message : 'Stock adjustment failed.';
    const isBadReq = msg.includes('INSUFFICIENT_STOCK') || msg.includes('BATCH_NOT_FOUND');
    res.status(isBadReq ? 400 : 500).json({
      success: false,
      error: { code: isBadReq ? 'ADJUSTMENT_REJECTED' : 'ADJUST_STOCK_FAILED', message: msg },
    });
  }
});
