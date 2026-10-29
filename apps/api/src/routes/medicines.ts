import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { MedicineService } from '../services/medicine.service';
import { BatchService } from '../services/batch.service';
import { BaseUnits, ScheduleCategories } from '@pulseclinic/types';

export const medicineRouter = Router({ mergeParams: true });

medicineRouter.use(authMiddleware);
medicineRouter.use(tenantMiddleware);

const baseUnitEnum = z.enum([
  BaseUnits.TABLET,
  BaseUnits.CAPSULE,
  BaseUnits.ML,
  BaseUnits.VIAL,
  BaseUnits.BOTTLE,
  BaseUnits.PIECE,
  BaseUnits.SACHET,
  BaseUnits.TUBE,
]);

const scheduleEnum = z.enum([
  ScheduleCategories.NONE,
  ScheduleCategories.H,
  ScheduleCategories.H1,
  ScheduleCategories.X,
]);

const createMedicineSchema = z.object({
  brandName: z.string().min(1, 'Brand name is required').trim(),
  genericName: z.string().min(1, 'Generic name is required').trim(),
  category: z.string().min(1, 'Category is required').trim(),
  dosageForm: z.string().min(1, 'Dosage form is required').trim(),
  strength: z.string().min(1, 'Strength is required').trim(),
  manufacturer: z.string().optional().default(''),
  hsnCode: z.string().trim().optional().default('3004'),
  gstRateBps: z.number().int().min(0).max(10000).optional().default(0),
  baseUnit: baseUnitEnum,
  stripSize: z.number().int().min(1, 'Strip/pack size must be at least 1'),
  allowLooseSales: z.boolean().optional().default(true),
  scheduleCategory: scheduleEnum.optional().default(ScheduleCategories.NONE),
  rackLocation: z.string().optional(),
  barcode: z.string().optional(),
  reorderLevelUnits: z.number().int().min(0).optional(),
});

const updateMedicineSchema = createMedicineSchema.partial();

// 1. List / Search medicines
medicineRouter.get('/', requirePermission('inventory.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { category, scheduleCategory, limit, cursor } = req.query;
  const searchQuery = typeof req.query.search === 'string' ? req.query.search : typeof req.query.query === 'string' ? req.query.query : undefined;

  try {
    const result = await MedicineService.list(storeId, {
      search: searchQuery,
      category: typeof category === 'string' ? category : undefined,
      scheduleCategory: typeof scheduleCategory === 'string' ? scheduleCategory : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });

    res.json({
      success: true,
      medicines: result.medicines,
      nextCursor: result.nextCursor,
    });
  } catch (err: unknown) {
    console.error('Error listing medicines:', err);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_MEDICINES_FAILED', message: 'Failed to retrieve medicines.' },
    });
  }
});

// 2. Get single medicine by ID
medicineRouter.get('/:id', requirePermission('inventory.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const medicine = await MedicineService.getById(storeId, id);
    if (!medicine) {
      res.status(404).json({
        success: false,
        error: { code: 'MEDICINE_NOT_FOUND', message: 'Medicine entry not found.' },
      });
      return;
    }

    res.json({ success: true, medicine });
  } catch (err: unknown) {
    console.error('Error getting medicine:', err);
    res.status(500).json({
      success: false,
      error: { code: 'GET_MEDICINE_FAILED', message: 'Failed to fetch medicine.' },
    });
  }
});

// 3. Create new medicine entry
medicineRouter.post('/', requirePermission('inventory.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  const parsed = createMedicineSchema.safeParse(req.body);
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
    const created = await MedicineService.create(storeId, parsed.data);
    res.status(201).json({ success: true, medicine: created });
  } catch (err: unknown) {
    console.error('Error creating medicine:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_MEDICINE_FAILED', message: 'Failed to create medicine entry.' },
    });
  }
});

// 4. Update medicine entry
medicineRouter.put('/:id', requirePermission('inventory.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const parsed = updateMedicineSchema.safeParse(req.body);
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
    const updated = await MedicineService.update(storeId, id, parsed.data);
    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'MEDICINE_NOT_FOUND', message: 'Medicine entry not found to update.' },
      });
      return;
    }

    res.json({ success: true, medicine: updated });
  } catch (err: unknown) {
    console.error('Error updating medicine:', err);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_MEDICINE_FAILED', message: 'Failed to update medicine.' },
    });
  }
});

// 5. Quick-create: Medicine + first Batch in one call (Google Sheets-style rapid entry)
const quickCreateSchema = z.object({
  brandName: z.string().min(1, 'Medicine name is required').trim(),
  dosageForm: z.string().min(1, 'Form/type is required').trim(),
  rackLocation: z.string().optional(),
  stripSize: z.number().int().min(1, 'Units per strip must be at least 1'),
  mrpRupees: z.number().positive('MRP must be a positive number'),
  batchNumber: z.string().min(1, 'Batch number is required').trim(),
  expiryDate: z.string().min(1, 'Expiry date is required').trim(),
  initialStockUnits: z.number().int().min(1, 'Stock quantity must be at least 1').optional().default(1),
});

medicineRouter.post('/quick', requirePermission('inventory.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const userId = req.authContext!.uid;
  const userName = req.authContext!.name;

  const parsed = quickCreateSchema.safeParse(req.body);
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

  const data = parsed.data;

  // Normalize expiry: accept MM/YYYY or MM-YYYY → YYYY-MM-28
  let expiryIso = data.expiryDate;
  const mmYYYY = data.expiryDate.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mmYYYY) {
    const mm = mmYYYY[1].padStart(2, '0');
    expiryIso = `${mmYYYY[2]}-${mm}-28`;
  }

  // Derive dosage form → base unit mapping
  const formLower = data.dosageForm.toLowerCase();
  let baseUnit: string = BaseUnits.PIECE;
  if (formLower.includes('tablet') || formLower.includes('tab')) baseUnit = BaseUnits.TABLET;
  else if (formLower.includes('capsule') || formLower.includes('cap')) baseUnit = BaseUnits.CAPSULE;
  else if (formLower.includes('syrup') || formLower.includes('liquid') || formLower.includes('solution') || formLower.includes('suspension')) baseUnit = BaseUnits.BOTTLE;
  else if (formLower.includes('cream') || formLower.includes('ointment') || formLower.includes('gel')) baseUnit = BaseUnits.TUBE;
  else if (formLower.includes('injection') || formLower.includes('vial') || formLower.includes('ampoule')) baseUnit = BaseUnits.VIAL;
  else if (formLower.includes('sachet') || formLower.includes('powder') || formLower.includes('granule')) baseUnit = BaseUnits.SACHET;
  else if (formLower.includes('drop')) baseUnit = BaseUnits.BOTTLE;

  try {
    // Step 1: Create medicine with smart defaults
    const medicine = await MedicineService.create(storeId, {
      brandName: data.brandName,
      genericName: data.brandName,
      category: 'Other',
      dosageForm: data.dosageForm,
      strength: '',
      manufacturer: '',
      hsnCode: '3004',
      gstRateBps: 0,
      baseUnit: baseUnit as any,
      stripSize: data.stripSize,
      allowLooseSales: true,
      scheduleCategory: ScheduleCategories.NONE,
      rackLocation: data.rackLocation || '',
      barcode: '',
      reorderLevelUnits: 50,
    });

    // Step 2: Create first batch
    const mrpPaise = Math.round(data.mrpRupees * 100);
    const batch = await BatchService.createBatch(
      storeId,
      {
        medicineId: medicine.id,
        batchNumber: data.batchNumber,
        expiryDate: expiryIso,
        mrpPaise,
        costPricePaise: mrpPaise,
        initialStockUnits: data.initialStockUnits,
        rackLocation: data.rackLocation || '',
      },
      userId,
      userName
    );

    res.status(201).json({ success: true, medicine, batch });
  } catch (err: unknown) {
    console.error('Error in quick-create medicine+batch:', err);
    res.status(500).json({
      success: false,
      error: { code: 'QUICK_CREATE_FAILED', message: 'Failed to create medicine and batch.' },
    });
  }
});

// 6. Soft-delete / Archive medicine entry
medicineRouter.delete('/:id', requirePermission('inventory.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const archived = await MedicineService.archive(storeId, id);
    if (!archived) {
      res.status(404).json({
        success: false,
        error: { code: 'MEDICINE_NOT_FOUND', message: 'Medicine entry not found to delete.' },
      });
      return;
    }

    res.json({ success: true, message: 'Medicine archived successfully.' });
  } catch (err: unknown) {
    console.error('Error archiving medicine:', err);
    res.status(500).json({
      success: false,
      error: { code: 'ARCHIVE_MEDICINE_FAILED', message: 'Failed to archive medicine.' },
    });
  }
});
