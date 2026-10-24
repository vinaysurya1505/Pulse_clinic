export interface StoreProfile {
    id: string;
    storeName: string;
    tradeName?: string;
    phone?: string;
    email?: string;
    address?: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        stateCode: string;
        pincode: string;
    };
    gstin?: string;
    drugLicenseNumber?: string;
    invoicePrefix: string;
    enableDoctorCommission: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface StoreSettings {
    enableDoctorCommission: boolean;
    defaultGstSlabs: number[];
    invoicePrefix: string;
}
//# sourceMappingURL=store.d.ts.map