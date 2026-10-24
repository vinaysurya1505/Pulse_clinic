import { initializeFirebaseAdmin, getFirestore } from './src/lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';
import { MedicineService } from './src/services/medicine.service';
import { BatchService } from './src/services/batch.service';

initializeFirebaseAdmin();
const db = getFirestore();

async function seed() {
  const storeId = 'pulseclinic-main';
  console.log(`Checking store ${storeId}...`);

  // Ensure store exists
  const storeRef = db.collection(COLLECTIONS.stores).doc(storeId);
  const storeDoc = await storeRef.get();
  if (!storeDoc.exists) {
    await storeRef.set({
      storeName: 'PulseClinic Pharmacy',
      phone: '9876543210',
      email: 'owner@pulseclinic.in',
      address: {
        street: '123 Health Avenue, Koramangala',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        pincode: '560034',
      },
      gstin: '29AABCU9603R1ZM',
      drugLicenseNumber: 'KA-B1-2024-84920',
      invoicePrefix: 'INV',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log('Store document created.');
  }

  // Check if Dolo already created
  const existingMeds = await MedicineService.list(storeId, { search: 'Dolo' });
  let med1Id = existingMeds.medicines[0]?.id;

  if (!med1Id) {
    const med1 = await MedicineService.create(storeId, {
      brandName: 'Dolo 650mg',
      genericName: 'Paracetamol',
      category: 'Analgesics & Antipyretics',
      dosageForm: 'TABLET',
      strength: '650mg',
      manufacturer: 'Micro Labs Ltd',
      hsnCode: '30049060',
      gstRateBps: 1200, // 12%
      baseUnit: 'TABLET',
      stripSize: 15,
      allowLooseSales: true,
      scheduleCategory: 'NONE',
      rackLocation: 'Rack A-1',
      barcode: '8901234567890',
    });
    med1Id = med1.id;
    console.log('Created med1: Dolo 650mg ->', med1Id);
  }

  // Add batch for Dolo 650mg
  await BatchService.createBatch(
    storeId,
    {
      medicineId: med1Id,
      batchNumber: 'DL24A01',
      expiryDate: '2027-06-30',
      mrpPaise: 3000, // ₹30.00 for strip of 15 (₹2.00 per unit)
      purchasePricePaise: 2000,
      initialStockUnits: 150, // 10 strips
      supplierId: 'sup-direct',
    },
    'admin'
  );
  console.log('Created batch for Dolo 650mg');

  // Seed Amoxicillin (Schedule H)
  const existingAug = await MedicineService.list(storeId, { search: 'Augmentin' });
  let med2Id = existingAug.medicines[0]?.id;

  if (!med2Id) {
    const med2 = await MedicineService.create(storeId, {
      brandName: 'Augmentin 625 Duo',
      genericName: 'Amoxicillin + Potassium Clavulanate',
      category: 'Antibiotics',
      dosageForm: 'TABLET',
      strength: '625mg',
      manufacturer: 'GSK Pharmaceuticals',
      hsnCode: '30041010',
      gstRateBps: 1200, // 12%
      baseUnit: 'TABLET',
      stripSize: 10,
      allowLooseSales: false,
      scheduleCategory: 'H', // Schedule H prescription drug!
      rackLocation: 'Rack B-3',
      barcode: '8901234567891',
    });
    med2Id = med2.id;
    console.log('Created med2: Augmentin 625 Duo (Schedule H) ->', med2Id);
  }

  // Add batch for Augmentin
  await BatchService.createBatch(
    storeId,
    {
      medicineId: med2Id,
      batchNumber: 'AG24B99',
      expiryDate: '2027-12-31',
      mrpPaise: 20000, // ₹200.00 for strip of 10 (₹20.00 per unit)
      purchasePricePaise: 15000,
      initialStockUnits: 100, // 10 strips
      supplierId: 'sup-direct',
    },
    'admin'
  );
  console.log('Created batch for Augmentin');

  console.log('Inventory successfully seeded for pulseclinic-main!');
}

seed().catch(console.error);
