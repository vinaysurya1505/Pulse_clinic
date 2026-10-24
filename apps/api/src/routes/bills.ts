import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { BillingCalculationEngine } from '../services/BillingCalculationEngine';
import { BillFinalizationService } from '../services/BillFinalizationService';
import { ApprovalCodeService } from '../services/ApprovalCodeService';
import { RefundExecutionEngine } from '../services/RefundExecutionEngine';
import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';

export const billRouter = Router({ mergeParams: true });

billRouter.use(authMiddleware);
billRouter.use(tenantMiddleware);

const quoteSchema = z.object({
  items: z.array(
    z.object({
      medicineId: z.string().min(1),
      batchId: z.string().min(1),
      quantityUnits: z.number().int().positive(),
      discountBps: z.number().int().min(0).max(10000).optional(),
      customGstRateBps: z.number().int().min(0).max(10000).optional(),
    })
  ).min(1, 'Cart cannot be empty'),
  overallDiscountBps: z.number().int().min(0).max(10000).optional(),
  customerStateCode: z.string().optional(),
  enableDoctorCommission: z.boolean().optional(),
  doctorCommissionBps: z.number().int().min(0).max(10000).optional(),
  roundOffToRupee: z.boolean().optional(),
});

const finalizeBillSchema = z.object({
  items: z.array(
    z.object({
      medicineId: z.string().min(1),
      batchId: z.string().min(1),
      quantityUnits: z.number().int().positive(),
      discountBps: z.number().int().min(0).max(10000).optional(),
      customGstRateBps: z.number().int().min(0).max(10000).optional(),
    })
  ).min(1, 'Cart cannot be empty'),
  overallDiscountBps: z.number().int().min(0).max(10000).optional(),
  paymentModes: z.array(
    z.object({
      mode: z.enum(['CASH', 'UPI', 'CARD']),
      amountPaise: z.number().int().positive(),
      reference: z.string().optional(),
    })
  ).min(1, 'At least one payment mode required'),
  customer: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    stateCode: z.string().optional(),
  }).optional(),
  doctorId: z.string().optional(),
  doctorName: z.string().optional(),
  prescriptionNumber: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// 1. Calculate Billing Quote (POS Dry Run)
billRouter.post('/quote', requirePermission('bill.create'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    });
    return;
  }

  try {
    const quote = await BillingCalculationEngine.calculateQuote(storeId, parsed.data);
    res.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2. Atomic Bill Finalization & Invoice Numbering
billRouter.post('/', requirePermission('bill.create'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const billerUid = req.authContext?.uid || 'cashier';

  // Check Idempotency-Key header or payload
  const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
  if (idempotencyKey) {
    req.body.idempotencyKey = idempotencyKey;
  }

  const parsed = finalizeBillSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    });
    return;
  }

  try {
    const invoice = await BillFinalizationService.finalizeBill(storeId, parsed.data, billerUid);
    res.status(201).json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        grandTotalPaise: invoice.grandTotalPaise,
        netPayablePaise: invoice.netPayablePaise,
        status: invoice.status,
        createdAt: invoice.createdAt,
      },
      message: `Invoice ${invoice.invoiceNumber} finalized successfully`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 3. List Invoices (Register & History)
billRouter.get('/', requirePermission('bill.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { limit, status, search } = req.query;

  try {
    const db = getFirestore();
    const invoicesCol = db.collection(COLLECTIONS.invoices(storeId));
    const limitCount = Math.min(limit ? parseInt(limit as string, 10) : 50, 100);

    const snapshot = await invoicesCol.get();
    let docs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as any[];

    // Sort by createdAt desc in memory
    docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (status) {
      docs = docs.filter((inv) => inv.status === status);
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.toLowerCase().trim();
      docs = docs.filter(
        (inv) =>
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.customer?.name?.toLowerCase().includes(q) ||
          inv.customer?.phone?.includes(q)
      );
    }

    let nextCursor: string | undefined = undefined;
    if (docs.length > limitCount) {
      nextCursor = docs[limitCount - 1].id;
      docs = docs.slice(0, limitCount);
    }

    res.json({
      success: true,
      invoices: docs,
      nextCursor,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get Invoice Detail by ID
billRouter.get('/:id', requirePermission('bill.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const invoiceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const db = getFirestore();
    const doc = await db.collection(COLLECTIONS.invoices(storeId)).doc(invoiceId).get();
    if (!doc.exists) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({
      success: true,
      invoice: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const requestApprovalSchema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
});

// 5. Request Refund Approval Code (OTP Generator) - Prompt 17
billRouter.post('/:id/request-approval', requirePermission('bill.refund'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const invoiceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const requesterUid = req.authContext?.uid || 'cashier';

  const parsed = requestApprovalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors.map((e) => e.message).join(', ') });
    return;
  }

  try {
    const result = await ApprovalCodeService.requestApproval(
      storeId,
      invoiceId,
      requesterUid,
      parsed.data.reason
    );
    res.status(201).json({
      success: true,
      requestId: result.requestId,
      expiresAt: result.expiresAt,
      message: result.message,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

const resendApprovalSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
});

// 6. Resend Refund Approval Code Email - Prompt 17
billRouter.post('/:id/resend-approval', requirePermission('bill.refund'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  const parsed = resendApprovalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors.map((e) => e.message).join(', ') });
    return;
  }

  try {
    const result = await ApprovalCodeService.resendApproval(storeId, parsed.data.requestId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

const refundSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  approvalCode: z.string().min(8, 'Approval code must be 8 characters').max(8),
  reason: z.string().optional(),
  refundType: z.enum(['FULL', 'PARTIAL']).optional(),
  lineItems: z.array(
    z.object({
      batchId: z.string().min(1),
      quantityUnits: z.number().int().positive(),
    })
  ).optional(),
  refundModes: z.array(
    z.object({
      mode: z.enum(['CASH', 'UPI', 'CARD']),
      amountPaise: z.number().int().positive(),
    })
  ).optional(),
});

// 7. Execute Cancellation / Refund with Verification Code - Prompt 18
billRouter.post('/:id/refund', requirePermission('bill.refund'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const invoiceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const operatorUid = req.authContext?.uid || 'cashier';

  const parsed = refundSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors.map((e) => e.message).join(', ') });
    return;
  }

  try {
    const result = await RefundExecutionEngine.executeRefund(
      storeId,
      invoiceId,
      parsed.data,
      operatorUid
    );
    res.json({
      success: true,
      refundId: result.refundRecord.id,
      invoiceStatus: result.invoiceStatus,
      netRefundPaise: result.refundRecord.netRefundPaise,
      message: `Invoice ${result.refundRecord.invoiceNumber} successfully ${result.invoiceStatus.toLowerCase()}.`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

