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
  aadhaarLastFour: string; // Strictly last 4 digits
  panLastFour: string; // Strictly last 4 characters
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
export function validateAadhaarLastFour(input: string): { valid: boolean; error?: string } {
  if (!input) {
    return { valid: false, error: 'Aadhaar last four digits are required.' };
  }
  const clean = input.trim();
  if (clean.length > 4) {
    return {
      valid: false,
      error: 'Raw Aadhaar numbers are strictly rejected under DPDP compliance. Submit only the approved last 4 digits.',
    };
  }
  if (!/^\d{4}$/.test(clean)) {
    return { valid: false, error: 'Aadhaar last four must contain exactly 4 numeric digits.' };
  }
  return { valid: true };
}

/**
 * DPDP Compliance Validation (DEC-OPEN-04)
 * Strictly enforces approved last-four character retention and rejects any raw 10-character PAN.
 */
export function validatePanLastFour(input: string): { valid: boolean; error?: string } {
  if (!input) {
    return { valid: false, error: 'PAN last four characters are required.' };
  }
  const clean = input.trim().toUpperCase();
  if (clean.length > 4) {
    return {
      valid: false,
      error: 'Raw PAN numbers are strictly rejected under DPDP compliance. Submit only the approved last 4 characters.',
    };
  }
  if (!/^[A-Z0-9]{4}$/.test(clean)) {
    return { valid: false, error: 'PAN last four must contain exactly 4 alphanumeric characters.' };
  }
  return { valid: true };
}

/**
 * Displays masked Aadhaar according to DPDP visual presentation standard.
 */
export function formatMaskedAadhaar(lastFour: string): string {
  if (!lastFour || lastFour.length < 4) return 'XXXX-XXXX-????';
  return `XXXX-XXXX-${lastFour.slice(-4)}`;
}

/**
 * Displays masked PAN according to DPDP visual presentation standard.
 */
export function formatMaskedPan(lastFour: string): string {
  if (!lastFour || lastFour.length < 4) return 'XXXXXX????';
  return `XXXXXX${lastFour.slice(-4).toUpperCase()}`;
}
