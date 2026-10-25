export interface DoctorProfile {
  id: string;
  storeId: string;
  name: string;
  registrationNumber?: string;
  specialization?: string;
  phone?: string;
  email?: string;
  hospitalClinic?: string;
  commissionBps: number; // Basis points (e.g., 500 = 5.00%)
  commissionEnabled: boolean; // Configurable toggle, default false per DEC-OPEN-02
  prescriptionsLinkedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDoctorInput {
  name: string;
  registrationNumber?: string;
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
