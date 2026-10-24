export declare const BaseUnits: {
    readonly TABLET: "TABLET";
    readonly CAPSULE: "CAPSULE";
    readonly ML: "ML";
    readonly VIAL: "VIAL";
    readonly BOTTLE: "BOTTLE";
    readonly PIECE: "PIECE";
    readonly SACHET: "SACHET";
    readonly TUBE: "TUBE";
};
export type BaseUnit = (typeof BaseUnits)[keyof typeof BaseUnits];
export declare const ScheduleCategories: {
    readonly NONE: "NONE";
    readonly H: "H";
    readonly H1: "H1";
    readonly X: "X";
};
export type ScheduleCategory = (typeof ScheduleCategories)[keyof typeof ScheduleCategories];
export interface MedicineMaster {
    id: string;
    storeId: string;
    brandName: string;
    genericName: string;
    category: string;
    dosageForm: string;
    strength: string;
    manufacturer?: string;
    hsnCode: string;
    gstRateBps: number;
    baseUnit: BaseUnit;
    stripSize: number;
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
export declare function packToUnits(packs: number, stripSize: number): number;
/**
 * Converts smallest base units into whole packs and loose units.
 * E.g., 25 units with stripSize 10 = { fullPacks: 2, looseUnits: 5 }
 */
export declare function unitsToPacks(units: number, stripSize: number): {
    fullPacks: number;
    looseUnits: number;
};
/**
 * Computes unit price in integer paise given a pack price in integer paise.
 * E.g., 1000 paise (₹10.00) for a 10-unit strip = 100 paise (₹1.00) per unit.
 */
export declare function calculateUnitPrice(packPricePaise: number, stripSize: number): number;
/**
 * Validates whether a requested sale quantity in units is legally permissible
 * given the medicine's loose sales policy.
 */
export declare function validateLooseSale(quantityUnits: number, stripSize: number, allowLooseSales: boolean): boolean;
//# sourceMappingURL=medicine.d.ts.map