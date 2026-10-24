export const BaseUnits = {
  TABLET: 'TABLET',
  CAPSULE: 'CAPSULE',
  ML: 'ML',
  VIAL: 'VIAL',
  BOTTLE: 'BOTTLE',
  PIECE: 'PIECE',
  SACHET: 'SACHET',
  TUBE: 'TUBE',
} as const;

export type BaseUnit = (typeof BaseUnits)[keyof typeof BaseUnits];

export const ScheduleCategories = {
  NONE: 'NONE',
  H: 'H',
  H1: 'H1',
  X: 'X',
} as const;

export type ScheduleCategory = (typeof ScheduleCategories)[keyof typeof ScheduleCategories];

export interface MedicineMaster {
  id: string;
  storeId: string;
  brandName: string;
  genericName: string;
  category: string;
  dosageForm: string; // e.g. Tablet, Syrup, Injection, Ointment, Capsule
  strength: string; // e.g. 500mg, 250mg/5ml
  manufacturer?: string;
  hsnCode: string;
  gstRateBps: number; // Basis points (e.g. 500 = 5%, 1200 = 12%, 1800 = 18%)
  baseUnit: BaseUnit;
  stripSize: number; // Units per pack (e.g. 10 tablets/strip, >= 1)
  allowLooseSales: boolean;
  scheduleCategory: ScheduleCategory;
  rackLocation?: string;
  barcode?: string;
  reorderLevelUnits?: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateMedicineInput = Omit<MedicineMaster, 'id' | 'storeId' | 'isArchived' | 'createdAt' | 'updatedAt'>;
export type UpdateMedicineInput = Partial<CreateMedicineInput>;

/**
 * Unit & Pack Conversion Utilities (ADR-010)
 */

/**
 * Converts pack quantities to smallest base units.
 * E.g., 2 packs with stripSize 10 = 20 units.
 */
export function packToUnits(packs: number, stripSize: number): number {
  if (stripSize <= 0) throw new Error('stripSize must be greater than 0');
  return Math.floor(packs * stripSize);
}

/**
 * Converts smallest base units into whole packs and loose units.
 * E.g., 25 units with stripSize 10 = { fullPacks: 2, looseUnits: 5 }
 */
export function unitsToPacks(units: number, stripSize: number): { fullPacks: number; looseUnits: number } {
  if (stripSize <= 0) throw new Error('stripSize must be greater than 0');
  const fullPacks = Math.floor(units / stripSize);
  const looseUnits = units % stripSize;
  return { fullPacks, looseUnits };
}

/**
 * Computes unit price in integer paise given a pack price in integer paise.
 * E.g., 1000 paise (₹10.00) for a 10-unit strip = 100 paise (₹1.00) per unit.
 */
export function calculateUnitPrice(packPricePaise: number, stripSize: number): number {
  if (stripSize <= 0) throw new Error('stripSize must be greater than 0');
  return Math.floor(packPricePaise / stripSize);
}

/**
 * Validates whether a requested sale quantity in units is legally permissible
 * given the medicine's loose sales policy.
 */
export function validateLooseSale(quantityUnits: number, stripSize: number, allowLooseSales: boolean): boolean {
  if (stripSize <= 0 || quantityUnits <= 0) return false;
  if (allowLooseSales) return true;
  // If loose sales are not permitted, the quantity MUST be an exact multiple of the stripSize
  return quantityUnits % stripSize === 0;
}
