export interface DoctorProfile {
    id: string;
    storeId: string;
    name: string;
    registrationNumber: string;
    specialization?: string;
    phone?: string;
    email?: string;
    hospitalClinic?: string;
    commissionBps: number;
    commissionEnabled: boolean;
    prescriptionsLinkedCount: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface CreateDoctorInput {
    name: string;
    registrationNumber: string;
    specialization?: string;
    phone?: string;
    email?: string;
    hospitalClinic?: string;
    commissionBps?: number;
    commissionEnabled?: boolean;
}
export interface UpdateDoctorInput {
    name?: string;
    registrationNumber?: string;
    specialization?: string;
    phone?: string;
    email?: string;
    hospitalClinic?: string;
    commissionBps?: number;
    commissionEnabled?: boolean;
    isActive?: boolean;
}
//# sourceMappingURL=doctor.d.ts.map