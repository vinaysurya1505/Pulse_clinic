import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { EmployeeService } from '../services/employee.service';

export const employeeRouter = Router({ mergeParams: true });

employeeRouter.use(authMiddleware);
employeeRouter.use(tenantMiddleware);

const createEmployeeSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').trim(),
  email: z.string().email('Invalid email address').trim(),
  phone: z.string().min(1, 'Phone number is required').trim(),
  assignedRole: z.enum(['MANAGER', 'PHARMACIST', 'ACCOUNTANT']),
  salaryPaise: z.number().int().min(0, 'Salary must be a non-negative amount in paise'),
  aadhaarLastFour: z.string().min(1, 'Aadhaar last four is required').trim(),
  panLastFour: z.string().min(1, 'PAN last four is required').trim(),
});

const updateEmployeeSchema = z.object({
  fullName: z.string().min(1).trim().optional(),
  email: z.string().email().trim().optional(),
  phone: z.string().min(1).trim().optional(),
  assignedRole: z.enum(['MANAGER', 'PHARMACIST', 'ACCOUNTANT']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  salaryPaise: z.number().int().min(0).optional(),
});

const recordLedgerSchema = z.object({
  type: z.enum(['ADVANCE', 'REPAYMENT', 'SALARY_PAYMENT']),
  amountPaise: z.number().int().positive('Amount must be greater than ₹0.00'),
  description: z.string().min(1, 'Description is required').trim(),
  referenceNumber: z.string().optional(),
});

// 1. List Employees
employeeRouter.get('/', requirePermission('employee.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { role, status, limit, cursor } = req.query;

  try {
    const result = await EmployeeService.list(storeId, {
      role: typeof role === 'string' ? role : undefined,
      status: typeof status === 'string' ? status : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });

    res.json({
      success: true,
      employees: result.employees,
      nextCursor: result.nextCursor,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get Employee by ID
employeeRouter.get('/:id', requirePermission('employee.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const employee = await EmployeeService.getById(storeId, employeeId);
    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }
    res.json({ success: true, employee });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Create Employee Profile (With strictly masked DPDP PII)
employeeRouter.post('/', requirePermission('employee.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    });
    return;
  }

  try {
    const employeeId = await EmployeeService.create(storeId, parsed.data);
    res.status(201).json({
      success: true,
      employeeId,
      message: 'Employee registered successfully under DPDP compliance',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. Update Employee Profile
employeeRouter.put('/:id', requirePermission('employee.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const parsed = updateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    });
    return;
  }

  try {
    await EmployeeService.update(storeId, employeeId, parsed.data);
    res.json({
      success: true,
      message: 'Employee profile updated successfully',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 5. Get Employee Ledger History
employeeRouter.get(
  '/:id/ledger',
  requirePermission('employee.read'),
  async (req: Request, res: Response) => {
    const storeId = req.tenantContext!.storeId;
    const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    try {
      const result = await EmployeeService.getLedger(storeId, employeeId, limit);
      res.json({
        success: true,
        entries: result.entries,
        currentBalancePaise: result.currentBalancePaise,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// 6. Record Employee Salary Advance / Repayment
employeeRouter.post(
  '/:id/ledger',
  requirePermission('employee.write'),
  async (req: Request, res: Response) => {
    const storeId = req.tenantContext!.storeId;
    const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const recordedBy = req.authContext?.uid || 'system';

    const parsed = recordLedgerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(', '),
      });
      return;
    }

    try {
      const result = await EmployeeService.recordLedgerEntry(
        storeId,
        employeeId,
        parsed.data,
        recordedBy
      );

      res.status(201).json({
        success: true,
        entryId: result.entryId,
        newBalancePaise: result.newBalancePaise,
        message: 'Employee financial ledger entry posted successfully',
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);
