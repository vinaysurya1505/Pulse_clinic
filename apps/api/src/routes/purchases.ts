import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { PurchaseOrderService } from '../services/purchase-order.service';

export const purchaseRouter = Router({ mergeParams: true });

purchaseRouter.use(authMiddleware);
purchaseRouter.use(tenantMiddleware);

const createPOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  lineItems: z
    .array(
      z.object({
        medicineId: z.string().min(1, 'Medicine ID is required'),
        quantityPacks: z.number().int().positive('Quantity must be at least 1 pack'),
        unitCostPaise: z.number().int().min(0, 'Unit cost must be non-negative integer paise'),
      })
    )
    .min(1, 'At least one medicine item is required in the PO'),
  notes: z.string().optional(),
});

const receiveGRNSchema = z.object({
  supplierInvoiceNumber: z.string().min(1, 'Supplier invoice number is required').trim(),
  supplierInvoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invoice date must be YYYY-MM-DD'),
  batches: z
    .array(
      z.object({
        medicineId: z.string().min(1, 'Medicine ID is required'),
        batchNumber: z.string().min(1, 'Batch number is required').trim(),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD'),
        quantityPacks: z.number().int().positive('Quantity packs must be positive'),
        stripSize: z.number().int().positive('Strip size must be positive'),
        purchaseRatePaise: z.number().int().min(0, 'Purchase rate must be non-negative integer paise'),
        mrpPaise: z.number().int().positive('MRP must be positive integer paise'),
        rackLocation: z.string().optional(),
      })
    )
    .min(1, 'At least one delivered drug batch is required for GRN receiving'),
  notes: z.string().optional(),
});

// 1. List / Filter Purchase Orders
purchaseRouter.get('/', requirePermission('supplier.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { status, supplierId, limit, cursor } = req.query;

  try {
    const result = await PurchaseOrderService.list(storeId, {
      status: typeof status === 'string' ? status : undefined,
      supplierId: typeof supplierId === 'string' ? supplierId : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });

    res.json({ success: true, purchaseOrders: result.purchaseOrders, nextCursor: result.nextCursor });
  } catch (err: unknown) {
    console.error('Error listing purchase orders:', err);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_PO_FAILED', message: 'Failed to retrieve purchase orders.' },
    });
  }
});

// 2. Get Single Purchase Order by ID
purchaseRouter.get('/:id', requirePermission('supplier.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const po = await PurchaseOrderService.getById(storeId, id);
    if (!po) {
      res.status(404).json({
        success: false,
        error: { code: 'PO_NOT_FOUND', message: 'Purchase order not found.' },
      });
      return;
    }

    res.json({ success: true, purchaseOrder: po });
  } catch (err: unknown) {
    console.error('Error getting purchase order:', err);
    res.status(500).json({
      success: false,
      error: { code: 'GET_PO_FAILED', message: 'Failed to fetch purchase order.' },
    });
  }
});

// 3. Create Purchase Order
purchaseRouter.post('/', requirePermission('po.create'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const userId = req.authContext!.uid;
  const userName = req.authContext!.name;

  const parsed = createPOSchema.safeParse(req.body);
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
    const po = await PurchaseOrderService.createPO(storeId, parsed.data, userId, userName);
    res.status(201).json({ success: true, purchaseOrder: po });
  } catch (err: unknown) {
    console.error('Error creating purchase order:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_PO_FAILED', message: 'Failed to create purchase order.' },
    });
  }
});

// 4. Receive GRN (Goods Received Note)
purchaseRouter.post('/:id/receive', requirePermission('po.receive'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.authContext!.uid;
  const userName = req.authContext!.name;

  const parsed = receiveGRNSchema.safeParse(req.body);
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
    const result = await PurchaseOrderService.receiveGRN(
      storeId,
      { ...parsed.data, poId: id },
      userId,
      userName
    );
    res.json({
      success: true,
      purchaseOrder: result.po,
      batchesCreatedCount: result.batchesCreatedCount,
      invoiceTotalPaise: result.invoiceTotalPaise,
    });
  } catch (err: unknown) {
    console.error('Error receiving GRN:', err);
    const msg = err instanceof Error ? err.message : 'Failed to receive GRN stock';
    const isBadReq = msg.includes('PO_NOT_FOUND') || msg.includes('PO_ALREADY_RECEIVED') || msg.includes('PO_IS_CANCELLED');
    res.status(isBadReq ? 400 : 500).json({
      success: false,
      error: { code: isBadReq ? 'GRN_REJECTED' : 'RECEIVE_GRN_FAILED', message: msg },
    });
  }
});
