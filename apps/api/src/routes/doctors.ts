import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { DoctorService } from '../services/doctor.service';

export const doctorRouter = Router({ mergeParams: true });

doctorRouter.use(authMiddleware);
doctorRouter.use(tenantMiddleware);

const createDoctorSchema = z.object({
  name: z.string().min(1, 'Doctor name is required').trim(),
  registrationNumber: z.string().min(1, 'Medical registration number is required').trim(),
  specialization: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  hospitalClinic: z.string().optional(),
  commissionBps: z.number().int().min(0).max(10000).optional(),
  commissionEnabled: z.boolean().optional(),
});

const updateDoctorSchema = z.object({
  name: z.string().min(1).trim().optional(),
  registrationNumber: z.string().min(1).trim().optional(),
  specialization: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  hospitalClinic: z.string().optional(),
  commissionBps: z.number().int().min(0).max(10000).optional(),
  commissionEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// 1. List / Search Doctors
doctorRouter.get('/', requirePermission('doctor.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const { search, isActive, limit, cursor } = req.query;

  try {
    const result = await DoctorService.list(storeId, {
      search: typeof search === 'string' ? search : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });

    res.json({
      success: true,
      doctors: result.doctors,
      nextCursor: result.nextCursor,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get Doctor By ID
doctorRouter.get('/:id', requirePermission('doctor.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const doctorId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const doctor = await DoctorService.getById(storeId, doctorId);
    if (!doctor) {
      res.status(404).json({ success: false, error: 'Doctor not found' });
      return;
    }
    res.json({ success: true, doctor });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Create Doctor Profile
doctorRouter.post('/', requirePermission('doctor.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  const parsed = createDoctorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    });
    return;
  }

  try {
    const doctorId = await DoctorService.create(storeId, parsed.data);
    res.status(201).json({
      success: true,
      doctorId,
      message: 'Doctor profile registered successfully',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. Update Doctor Profile
doctorRouter.put('/:id', requirePermission('doctor.write'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const doctorId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const parsed = updateDoctorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    });
    return;
  }

  try {
    await DoctorService.update(storeId, doctorId, parsed.data);
    res.json({
      success: true,
      message: 'Doctor profile updated successfully',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
