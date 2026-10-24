import { initializeFirebaseAdmin, getFirestore } from '../apps/api/src/lib/firebase-admin';
import { COLLECTIONS } from '@pulseclinic/config';

initializeFirebaseAdmin();
const db = getFirestore();

async function main() {
  const storeId = 'pulseclinic-main';
  const medsSnap = await db.collection(COLLECTIONS.medicines(storeId)).get();
  console.log(`Medicines in ${storeId}: ${medsSnap.size}`);
  medsSnap.docs.forEach((d) => {
    const data = d.data();
    console.log(`- ${d.id}: ${data.brandName} (${data.genericName}), stripSize: ${data.stripSize}, HSN: ${data.hsnCode}`);
  });

  const batchesSnap = await db.collection(COLLECTIONS.batches(storeId)).get();
  console.log(`Batches in ${storeId}: ${batchesSnap.size}`);
  batchesSnap.docs.forEach((d) => {
    const data = d.data();
    console.log(`- ${d.id}: Batch ${data.batchNumber}, Med: ${data.medicineId}, Stock: ${data.stockUnits}, MRP: ${data.mrpPaise}, Exp: ${data.expiryDate}`);
  });
}

main().catch(console.error);
