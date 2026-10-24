import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { SupplierService } from '../services/supplier.service';

export const supplierRouter = Router({ mergeParams: true });

supplierRouter.use(authMiddleware);
supplierRouter.use(tenantMiddleware);

const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').trim(),
  gstin: z.string().optional(),
  phone: z.string().min(1, 'Phone number is required').trim(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  contactPerson: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
    })
    .optional(),
  paymentTermsDays: z.number().int().min(0).optional(),
});

const recordPaymentSchema = z.object({
  amountPaise: z.number().int().positive('Payment amount must be greater than ₹0.00'),
  paymentMode: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI']),
  referenceNumber: z.string().min(1, 'Transaction reference/cheque number is required').trim(),
  notes: z.string().optional(),
});

// 1. List / Search Suppliers
supplierRouter.get('/', requirePermission('supplier.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { search, limit, cursor } = req.query;

  try {
    const result = await SupplierService.list(storeId, {
      search: typeof search === 'string' ? search : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });

    res.json({ success: true, suppliers: result.suppliers, nextCursor: result.nextCursor });
  } catch (err: unknown) {
    console.error('Error listing suppliers:', err);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_SUPPLIERS_FAILED', message: 'Failed to retrieve suppliers.' },
    });
  }
});

// 2. Get Supplier by ID
supplierRouter.get('/:id', requirePermission('supplier.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const supplier = await SupplierService.getById(storeId, id);
    if (!supplier) {
      res.status(404).json({
        success: false,
        error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier profile not found.' },
      });
      return;
    }

    res.json({ success: true, supplier });
  } catch (err: unknown) {
    console.error('Error getting supplier:', err);
    res.status(500).json({
      success: false,
      error: { code: 'GET_SUPPLIER_FAILED', message: 'Failed to fetch supplier details.' },
    });
  }
});

// 3. Create Supplier Profile
supplierRouter.post('/', requirePermission('supplier.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  const parsed = createSupplierSchema.safeParse(req.body);
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
    const supplier = await SupplierService.create(storeId, parsed.data);
    res.status(201).json({ success: true, supplier });
  } catch (err: unknown) {
    console.error('Error creating supplier:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_SUPPLIER_FAILED', message: 'Failed to create supplier profile.' },
    });
  }
});

// 4. Update Supplier Profile
supplierRouter.put('/:id', requirePermission('supplier.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const parsed = createSupplierSchema.partial().safeParse(req.body);
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
    const updated = await SupplierService.update(storeId, id, parsed.data);
    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier profile not found to update.' },
      });
      return;
    }

    res.json({ success: true, supplier: updated });
  } catch (err: unknown) {
    console.error('Error updating supplier:', err);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_SUPPLIER_FAILED', message: 'Failed to update supplier.' },
    });
  }
});

// 5. Get Supplier Statement & Ledger History
supplierRouter.get('/:id/statement', requirePermission('supplier.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const statement = await SupplierService.getStatement(storeId, id);
    res.json({ success: true, statement });
  } catch (err: unknown) {
    console.error('Error fetching statement:', err);
    res.status(500).json({
      success: false,
      error: { code: 'STATEMENT_FAILED', message: 'Failed to retrieve supplier statement.' },
    });
  }
});

// 6. Record Supplier Payment
supplierRouter.post('/:id/payments', requirePermission('supplier.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.authContext!.uid;
  const userName = req.authContext!.name;

  const parsed = recordPaymentSchema.safeParse(req.body);
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
    const result = await SupplierService.recordPayment(
      storeId,
      { ...parsed.data, supplierId: id },
      userId,
      userName
    );
    res.json({ success: true, supplier: result.supplier, ledgerEntry: result.ledgerEntry });
  } catch (err: unknown) {
    console.error('Error recording payment:', err);
    res.status(500).json({
      success: false,
      error: { code: 'PAYMENT_FAILED', message: 'Failed to record supplier payment.' },
    });
  }
});
