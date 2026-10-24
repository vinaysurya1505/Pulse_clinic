import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getFirestore } from '../lib/firebase-admin';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { COLLECTIONS } from '@pulseclinic/config';

export const storeRouter = Router();

const createStoreSchema = z.object({
  storeName: z.string().min(1).max(200),
  tradeName: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      stateCode: z.string().length(2),
      pincode: z.string().length(6),
    })
    .optional(),
  gstin: z.string().max(15).optional(),
  drugLicenseNumber: z.string().max(50).optional(),
  invoicePrefix: z.string().min(1).max(10).default('INV'),
});

storeRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  const parsed = createStoreSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
    });
    return;
  }

  const uid = req.authContext!.uid;
  const db = getFirestore();
  const now = new Date().toISOString();

  try {
    const storeRef = db.collection(COLLECTIONS.stores).doc();
    const storeId = storeRef.id;

    await db.runTransaction(async (tx) => {
      tx.set(storeRef, {
        ...parsed.data,
        enableDoctorCommission: false,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
      });

      const memberRef = db.doc(`${COLLECTIONS.members(storeId)}/${uid}`);
      tx.set(memberRef, {
        uid,
        email: req.authContext!.email,
        displayName: req.authContext!.name,
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: now,
        updatedAt: now,
      });
    });

    res.status(201).json({
      success: true,
      store: { id: storeId, ...parsed.data },
    });
  } catch {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create store.' },
    });
  }
});

const updateStoreSchema = z.object({
  storeName: z.string().min(1).max(200).optional(),
  tradeName: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      stateCode: z.string().length(2),
      pincode: z.string().length(6),
    })
    .optional(),
  gstin: z.string().max(15).optional(),
  drugLicenseNumber: z.string().max(50).optional(),
  invoicePrefix: z.string().min(1).max(10).optional(),
});

storeRouter.put(
  '/:storeId',
  authMiddleware,
  tenantMiddleware,
  requirePermission('store.update'),
  async (req: Request, res: Response) => {
    const parsed = updateStoreSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      });
      return;
    }

    const { storeId } = req.tenantContext!;
    const db = getFirestore();

    try {
      const storeRef = db.collection(COLLECTIONS.stores).doc(storeId);
      await storeRef.update({
        ...parsed.data,
        updatedAt: new Date().toISOString(),
      });

      const updatedDoc = await storeRef.get();
      res.json({
        success: true,
        store: { id: storeId, ...updatedDoc.data() },
      });
    } catch {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update store.' },
      });
    }
  },
);

storeRouter.get(
  '/:storeId',
  authMiddleware,
  tenantMiddleware,
  requirePermission('store.read'),
  async (req: Request, res: Response) => {
    const { storeId } = req.tenantContext!;
    const db = getFirestore();

    try {
      const storeDoc = await db.collection(COLLECTIONS.stores).doc(storeId).get();
      if (!storeDoc.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Store not found.' },
        });
        return;
      }

      res.json({
        success: true,
        store: { id: storeId, ...storeDoc.data() },
      });
    } catch {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch store.' },
      });
    }
  },
);

storeRouter.get(
  '/:storeId/members',
  authMiddleware,
  tenantMiddleware,
  requirePermission('employee.read'),
  async (req: Request, res: Response) => {
    const { storeId } = req.tenantContext!;
    const db = getFirestore();

    try {
      const membersSnap = await db.collection(COLLECTIONS.members(storeId)).get();
      const members = membersSnap.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));

      res.json({ success: true, members });
    } catch {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch members.' },
      });
    }
  },
);
