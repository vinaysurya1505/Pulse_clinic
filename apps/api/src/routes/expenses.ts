import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { ExpenseService } from '../services/ExpenseService';
import { CashRegisterService } from '../services/CashRegisterService';

export const expenseRouter = Router({ mergeParams: true });

expenseRouter.use(authMiddleware);
expenseRouter.use(tenantMiddleware);

const createExpenseSchema = z.object({
  category: z.enum([
    'RENT',
    'UTILITIES',
    'SALARY',
    'MAINTENANCE',
    'PACKAGING',
    'PETTY_CASH',
    'MARKETING',
    'MISCELLANEOUS',
  ]),
  amountPaise: z.number().int().positive('Amount must be positive'),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD']),
  description: z.string().min(2, 'Description must be at least 2 characters'),
  vendorName: z.string().optional(),
  billInvoiceNumber: z.string().optional(),
});

// 1. List Expenses
expenseRouter.get('/', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { category, startDate, endDate, limit } = req.query;

  try {
    const result = await ExpenseService.list(storeId, {
      category: category as any,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({
      success: true,
      expenses: result.expenses,
      totalAmountPaise: result.totalAmountPaise,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Create Expense
expenseRouter.post('/', requirePermission('store.update'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const paidByUid = req.authContext?.uid || 'cashier';

  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    });
    return;
  }

  try {
    const expense = await ExpenseService.create(storeId, parsed.data, paidByUid);
    res.status(201).json({
      success: true,
      expense,
      message: 'Expense recorded successfully',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Get Active Cash Drawer Session & Live Reconciliation
expenseRouter.get('/cash-register', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  try {
    const session = await CashRegisterService.getActiveSession(storeId);
    res.json({
      success: true,
      session,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const openRegisterSchema = z.object({
  openingCashPaise: z.number().int().min(0, 'Opening balance cannot be negative'),
  notes: z.string().optional(),
});

// 4. Open Cash Register Session
expenseRouter.post('/cash-register/open', requirePermission('store.update'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const openedBy = req.authContext?.uid || 'cashier';

  const parsed = openRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    });
    return;
  }

  try {
    const session = await CashRegisterService.openRegister(storeId, parsed.data, openedBy);
    res.status(201).json({
      success: true,
      session,
      message: 'Cash drawer opened successfully',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const closeRegisterSchema = z.object({
  actualCashCountPaise: z.number().int().min(0, 'Counted cash cannot be negative'),
  notes: z.string().optional(),
});

// 5. Close Cash Register Session
expenseRouter.post('/cash-register/close', requirePermission('store.update'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const closedBy = req.authContext?.uid || 'cashier';

  const parsed = closeRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    });
    return;
  }

  try {
    const session = await CashRegisterService.closeRegister(storeId, parsed.data, closedBy);
    res.json({
      success: true,
      session,
      message: 'Cash drawer reconciled and closed successfully',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
