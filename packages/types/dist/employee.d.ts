export type EmployeeRole = 'MANAGER' | 'PHARMACIST' | 'ACCOUNTANT';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type EmployeeLedgerType = 'ADVANCE' | 'REPAYMENT' | 'SALARY_PAYMENT';
export interface EmployeeProfileMasked {
    id: string;
    storeId: string;
    fullName: string;
    email: string;
    phone: string;
    assignedRole: EmployeeRole;
    status: EmployeeStatus;
    salaryPaise: number;
    advanceBalancePaise: number;
    aadhaarLastFour: string;
    panLastFour: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateEmployeeInput {
    fullName: string;
    email: string;
    phone: string;
    assignedRole: EmployeeRole;
    salaryPaise: number;
    aadhaarLastFour: string;
    panLastFour: string;
}
export interface UpdateEmployeeInput {
    fullName?: string;
    email?: string;
    phone?: string;
    assignedRole?: EmployeeRole;
    status?: EmployeeStatus;
    salaryPaise?: number;
}
export interface EmployeeLedgerEntry {
    id: string;
    storeId: string;
    employeeId: string;
    type: EmployeeLedgerType;
    amountPaise: number;
    balanceAfterPaise: number;
    description: string;
    referenceNumber?: string;
    recordedBy: string;
    createdAt: string;
}
export interface RecordEmployeeLedgerInput {
    type: EmployeeLedgerType;
    amountPaise: number;
    description: string;
    referenceNumber?: string;
}
/**
 * DPDP Compliance Validation (DEC-OPEN-04)
 * Strictly enforces approved last-four digit retention and rejects any raw 12-digit Aadhaar.
 */
export declare function validateAadhaarLastFour(input: string): {
    valid: boolean;
    error?: string;
};
/**
 * DPDP Compliance Validation (DEC-OPEN-04)
 * Strictly enforces approved last-four character retention and rejects any raw 10-character PAN.
 */
export declare function validatePanLastFour(input: string): {
    valid: boolean;
    error?: string;
};
/**
 * Displays masked Aadhaar according to DPDP visual presentation standard.
 */
export declare function formatMaskedAadhaar(lastFour: string): string;
/**
 * Displays masked PAN according to DPDP visual presentation standard.
 */
export declare function formatMaskedPan(lastFour: string): string;
//# sourceMappingURL=employee.d.ts.map