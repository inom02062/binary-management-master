export enum ApartmentStatus {
  EMPTY = 'EMPTY',
  PAID = 'PAID',
  PAYING = 'PAYING',
  LATE = 'LATE',
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  note?: string;
  status?: 'PAID' | 'PLANNED' | 'CANCELLED';
}

export interface Apartment {
  id: string;
  blockId: string;
  floor: number;
  number: number;
  status: ApartmentStatus;
  tenantName?: string;
  tenantSurname?: string;
  totalAmount?: number;
  downPayment?: number;
  firstDueDate?: string;
  installmentMonths?: number;
  scheduleBasePaid?: number;
  gracePeriodDays?: number;
  layoutX?: number;
  layoutY?: number;
  layoutWidth?: number;
  layoutHeight?: number;
  payments: Payment[];
}

export interface Block {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floorsCount: number;
  aptsPerFloor: number;
  color: string;
  imageUrl?: string;
}

export type Language = 'ru' | 'en' | 'uz';
export type Theme = 'light' | 'dark';

export interface User {
  id: string;
  username: string;
  role: 'SUPERADMIN' | 'HYPERADMIN' | 'ADMIN' | 'VIEWER';
  isActive: boolean;
  tenantId?: string | null;
}

export interface TenantAccount {
  id: string;
  name: string;
  users: TenantUser[];
  isActive: boolean;
  createdAt: string;
}

export interface TenantUser {
  id: string;
  username: string;
  role: 'HYPERADMIN' | 'ADMIN' | 'VIEWER';
  isActive: boolean;
}

export interface AdminUser extends User {
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  username: string;
  action: string;
  tenantId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export type ViewState =
  | { type: 'LOGIN' }
  | { type: 'DASHBOARD' }
  | { type: 'MAP_EDITOR' }
  | { type: 'BLOCK_DETAILS'; blockId: string }
  | { type: 'FLOOR_DETAILS'; blockId: string; floor: number }
  | { type: 'SEARCH' }
  | { type: 'PAYMENTS' }
  | { type: 'ANALYTICS' }
  | { type: 'INSTALLMENTS_MANAGER' }
  | { type: 'ADMIN_USERS' }
  | { type: 'CONTROL_PANEL' };

export interface ExtendedPayment extends Payment {
  apartment: Apartment & { block: Block };
}