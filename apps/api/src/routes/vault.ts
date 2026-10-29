import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requirePermission } from '../middleware/tenant';
import { getFirestore } from '../lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { BatchInventory, InvoiceRecord, DoctorProfile } from '@pulseclinic/types';
import { DailyClosingService } from '../services/DailyClosingService';

export const vaultRouter = Router({ mergeParams: true });

vaultRouter.use(authMiddleware);
vaultRouter.use(tenantMiddleware);

const verifyPinSchema = z.object({
  pin: z.string().min(1, 'PIN is required'),
});

const updateCostSchema = z.object({
  batchId: z.string().min(1),
  costPricePaise: z.number().int().min(0),
});

const bulkUpdateCostSchema = z.object({
  updates: z.array(z.object({
    batchId: z.string().min(1),
    costPricePaise: z.number().int().min(0),
  })).min(1).max(100),
});

// 1. Verify Owner PIN
vaultRouter.post('/verify-pin', async (req: Request, res: Response) => {
  const parsed = verifyPinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'PIN is required' } });
    return;
  }

  const vaultPin = process.env.OWNER_VAULT_PIN;
  if (!vaultPin) {
    res.status(500).json({ success: false, error: { code: 'PIN_NOT_CONFIGURED', message: 'Owner vault PIN not configured on server' } });
    return;
  }

  if (parsed.data.pin !== vaultPin) {
    res.status(401).json({ success: false, error: { code: 'INVALID_PIN', message: 'Incorrect PIN' } });
    return;
  }

  res.json({ success: true, message: 'Vault unlocked' });
});

// 2. Get all batches with cost prices (for cost price editor)
vaultRouter.get('/batches', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  try {
    const db = getFirestore();
    const batchesSnap = await db.collection(COLLECTIONS.batches(storeId))
      .where('status', '!=', 'RECALLED')
      .get();

    const batches = batchesSnap.docs.map((doc) => {
      const d = doc.data() as BatchInventory;
      return {
        id: doc.id,
        medicineId: d.medicineId,
        medicineBrandName: d.medicineBrandName || '',
        dosageForm: d.dosageForm || '',
        batchNumber: d.batchNumber,
        expiryDate: d.expiryDate,
        mrpPaise: d.mrpPaise,
        costPricePaise: d.costPricePaise || 0,
        stockUnits: d.stockUnits,
        status: d.status,
      };
    });

    batches.sort((a, b) => a.medicineBrandName.localeCompare(b.medicineBrandName));
    res.json({ success: true, batches });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch batch data' } });
  }
});

// 3. Update single batch cost price
vaultRouter.post('/batches/cost', requirePermission('store.update'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const parsed = updateCostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.errors.map(e => e.message).join(', ') } });
    return;
  }

  try {
    const db = getFirestore();
    await db.collection(COLLECTIONS.batches(storeId)).doc(parsed.data.batchId).update({
      costPricePaise: parsed.data.costPricePaise,
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update cost price' } });
  }
});

// 4. Bulk update cost prices
vaultRouter.post('/batches/cost/bulk', requirePermission('store.update'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const parsed = bulkUpdateCostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.errors.map(e => e.message).join(', ') } });
    return;
  }

  try {
    const db = getFirestore();
    const now = new Date().toISOString();
    const batch = db.batch();

    for (const update of parsed.data.updates) {
      const ref = db.collection(COLLECTIONS.batches(storeId)).doc(update.batchId);
      batch.update(ref, { costPricePaise: update.costPricePaise, updatedAt: now });
    }

    await batch.commit();
    res.json({ success: true, updatedCount: parsed.data.updates.length });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: 'BULK_UPDATE_FAILED', message: 'Failed to bulk update cost prices' } });
  }
});

// 5. Profit analytics
vaultRouter.get('/profit', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;

  try {
    const db = getFirestore();
    const today = DailyClosingService.getTodayIST();

    // Get all invoices
    const invoicesSnap = await db.collection(COLLECTIONS.invoices(storeId)).get();
    const allInvoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (InvoiceRecord & { id: string })[];

    // Get all batches for cost price lookup
    const batchesSnap = await db.collection(COLLECTIONS.batches(storeId)).get();
    const batchDataMap: Record<string, { costPricePaise: number; mrpPaise: number }> = {};
    for (const doc of batchesSnap.docs) {
      const b = doc.data() as BatchInventory;
      batchDataMap[doc.id] = { costPricePaise: b.costPricePaise || 0, mrpPaise: b.mrpPaise || 0 };
    }

    let todayRevenuePaise = 0;
    let todayCostPaise = 0;
    let todayInvoiceCount = 0;
    let totalRevenuePaise = 0;
    let totalCostPaise = 0;
    const medicineProfitMap: Record<string, { name: string; revenuePaise: number; costPaise: number; qtySold: number }> = {};

    for (const inv of allInvoices) {
      if (inv.status !== 'FINALIZED') continue;
      const invDateIST = DailyClosingService.toISTDate(inv.createdAt);
      const isToday = invDateIST === today;

      const invRevenue = inv.netPayablePaise || 0;
      let invCost = 0;

      if (inv.items) {
        for (const item of inv.items) {
          const bd = batchDataMap[item.batchId];
          let itemCost = 0;
          if (bd && bd.costPricePaise > 0 && bd.mrpPaise > 0) {
            const costPerUnit = (bd.costPricePaise / bd.mrpPaise) * item.unitPricePaise;
            itemCost = Math.round(costPerUnit * item.quantityUnits);
          }
          invCost += itemCost;

          const key = item.medicineId || item.medicineName;
          if (!medicineProfitMap[key]) {
            medicineProfitMap[key] = { name: item.medicineName, revenuePaise: 0, costPaise: 0, qtySold: 0 };
          }
          medicineProfitMap[key].revenuePaise += item.grossLinePaise || 0;
          medicineProfitMap[key].costPaise += itemCost;
          medicineProfitMap[key].qtySold += item.quantityUnits;
        }
      }

      totalRevenuePaise += invRevenue;
      totalCostPaise += invCost;

      if (isToday) {
        todayRevenuePaise += invRevenue;
        todayCostPaise += invCost;
        todayInvoiceCount++;
      }
    }

    const medicineProfit = Object.values(medicineProfitMap)
      .map(m => ({
        ...m,
        profitPaise: m.revenuePaise - m.costPaise,
        marginPercent: m.revenuePaise > 0 ? Math.round(((m.revenuePaise - m.costPaise) / m.revenuePaise) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.profitPaise - a.profitPaise);

    // Count batches missing cost price
    let missingCostCount = 0;
    for (const doc of batchesSnap.docs) {
      const b = doc.data() as BatchInventory;
      if (b.status !== 'RECALLED' && (!b.costPricePaise || b.costPricePaise === 0) && (b.stockUnits || 0) > 0) {
        missingCostCount++;
      }
    }

    res.json({
      success: true,
      profit: {
        todayRevenuePaise,
        todayCostPaise,
        todayProfitPaise: todayRevenuePaise - todayCostPaise,
        todayInvoiceCount,
        totalRevenuePaise,
        totalCostPaise,
        totalProfitPaise: totalRevenuePaise - totalCostPaise,
        totalMarginPercent: totalRevenuePaise > 0 ? Math.round(((totalRevenuePaise - totalCostPaise) / totalRevenuePaise) * 10000) / 100 : 0,
        topProfitable: medicineProfit.slice(0, 10),
        leastProfitable: medicineProfit.filter(m => m.profitPaise >= 0).slice(-5).reverse(),
        lossMakers: medicineProfit.filter(m => m.profitPaise < 0),
        missingCostCount,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: 'PROFIT_CALC_FAILED', message: 'Failed to calculate profit analytics' } });
  }
});

// ==================== Doctor Commission Routes ====================

// 6. Get all doctor commission summaries
vaultRouter.get('/doctor-commissions', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  try {
    const db = getFirestore();
    const summariesSnap = await db.collection(COLLECTIONS.doctorCommissionSummaries(storeId)).get();
    const summaries = summariesSnap.docs.map(doc => ({
      doctorId: doc.id,
      ...doc.data(),
    }));

    // Also fetch doctor details for names/commission rates
    const doctorsSnap = await db.collection(COLLECTIONS.doctors(storeId)).where('isActive', '==', true).get();
    const doctorMap: Record<string, { name: string; commissionBps: number }> = {};
    for (const doc of doctorsSnap.docs) {
      const d = doc.data() as DoctorProfile;
      doctorMap[doc.id] = { name: d.name, commissionBps: d.commissionBps || 0 };
    }

    const result = summaries.map((s: any) => ({
      ...s,
      doctorName: doctorMap[s.doctorId]?.name || s.doctorName || 'Unknown',
      commissionBps: doctorMap[s.doctorId]?.commissionBps || 0,
    }));

    res.json({ success: true, commissions: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch doctor commissions' } });
  }
});

// 7. Get commission ledger for a specific doctor
vaultRouter.get('/doctor-commissions/:doctorId/ledger', requirePermission('store.read'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const doctorId = req.params.doctorId as string;
  try {
    const db = getFirestore();
    const ledgerSnap = await db.collection(COLLECTIONS.doctorCommissionLedger(storeId, doctorId))
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const entries = ledgerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, ledger: entries });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch commission ledger' } });
  }
});

// 8. Record a commission payment to a doctor
const payCommissionSchema = z.object({
  amountPaise: z.number().int().min(1, 'Amount must be at least 1 paise'),
  note: z.string().optional(),
});

vaultRouter.post('/doctor-commissions/:doctorId/pay', requirePermission('store.update'), async (req: Request, res: Response) => {
  const storeId = req.tenantContext!.storeId;
  const doctorId = req.params.doctorId as string;
  const parsed = payCommissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.errors.map(e => e.message).join(', ') } });
    return;
  }

  try {
    const db = getFirestore();
    const now = new Date().toISOString();
    const summaryRef = db.collection(COLLECTIONS.doctorCommissionSummaries(storeId)).doc(doctorId);

    await db.runTransaction(async (t) => {
      const summarySnap = await t.get(summaryRef);
      if (!summarySnap.exists) {
        throw new Error('No commission record found for this doctor');
      }
      const summary = summarySnap.data()!;
      const remaining = summary.remainingPaise || 0;
      if (parsed.data.amountPaise > remaining) {
        throw new Error(`Payment amount (₹${(parsed.data.amountPaise / 100).toFixed(2)}) exceeds remaining commission (₹${(remaining / 100).toFixed(2)})`);
      }

      // Write payment ledger entry
      const ledgerRef = db.collection(COLLECTIONS.doctorCommissionLedger(storeId, doctorId)).doc();
      t.set(ledgerRef, {
        id: ledgerRef.id,
        storeId,
        doctorId,
        doctorName: summary.doctorName || '',
        type: 'PAYMENT',
        amountPaise: -parsed.data.amountPaise,
        note: parsed.data.note || '',
        recordedBy: req.authContext?.uid || 'owner',
        createdAt: now,
      });

      // Update summary
      t.update(summaryRef, {
        totalPaidPaise: (summary.totalPaidPaise || 0) + parsed.data.amountPaise,
        remainingPaise: remaining - parsed.data.amountPaise,
        lastUpdatedAt: now,
      });
    });

    res.json({ success: true, message: 'Payment recorded successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PAYMENT_FAILED', message: err.message || 'Failed to record payment' } });
  }
});
