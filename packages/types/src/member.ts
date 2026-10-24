import type { SystemRole } from './roles';

export interface StoreMember {
  uid: string;
  email: string;
  displayName: string;
  role: SystemRole;
  status: 'ACTIVE' | 'SUSPENDED';
  joinedAt: string;
  updatedAt: string;
}

export interface MembershipInfo {
  storeId: string;
  storeName: string;
  role: SystemRole;
}
