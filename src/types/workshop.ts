import type { Timestamp } from 'firebase/firestore';

export const ADMIN_EMAIL = 'barabereapp1@gmail.com';

export const PART_CATEGORIES = [
  'Oli & Pelumas',
  'Rem & Kampas',
  'Ban & Velg',
  'Mesin & CVT',
  'Kelistrikan',
  'Aksesoris',
  'Lainnya',
] as const;

export type PartCategory = (typeof PART_CATEGORIES)[number];

export const PAYMENT_METHODS = [
  'Tunai',
  'QRIS',
  'Transfer Bank',
  'Kartu Debit',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type TransactionStatus = 'Selesai' | 'Batal';
export type UserRole = 'admin' | 'cashier';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  workshopName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SparePart {
  id: string;
  ownerId: string;
  sku: string;
  name: string;
  category: PartCategory;
  brand: string;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Customer {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  plateNumber: string;
  vehicleModel: string;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Transaction {
  id: string;
  ownerId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  plateNumber: string;
  vehicleModel: string;
  mechanicName: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  subtotalParts: number;
  serviceFee: number;
  discount: number;
  totalAmount: number;
  itemsCount: number;
  itemSummary: string;
  notes: string;
  transactionDate: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TransactionItem {
  id: string;
  ownerId: string;
  transactionId: string;
  itemType: 'part' | 'service';
  partId: string;
  name: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ServiceHistory {
  id: string;
  ownerId: string;
  transactionId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  plateNumber: string;
  vehicleModel: string;
  odometerKm: number;
  complaint: string;
  workSummary: string;
  mechanicName: string;
  totalCost: number;
  nextServiceNote: string;
  serviceDate: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface CartItem {
  key: string;
  itemType: 'part' | 'service';
  partId: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  maxStock?: number;
}

export interface ServicePreset {
  id: string;
  name: string;
  defaultPrice: number;
  estimatedMinutes: number;
}

export const SERVICE_PRESETS: ServicePreset[] = [
  { id: 'srv-ringan', name: 'Servis Ringan & Tune Up', defaultPrice: 65000, estimatedMinutes: 45 },
  { id: 'srv-oli', name: 'Jasa Ganti Oli Mesin & Gardan', defaultPrice: 15000, estimatedMinutes: 15 },
  { id: 'srv-cvt', name: 'Servis Bersihkan CVT Matic', defaultPrice: 55000, estimatedMinutes: 40 },
  { id: 'srv-rem', name: 'Jasa Ganti Kampas Rem & Setel', defaultPrice: 25000, estimatedMinutes: 25 },
  { id: 'srv-ban', name: 'Jasa Pasang Ban Tubeless', defaultPrice: 25000, estimatedMinutes: 20 },
  { id: 'srv-kelistrikan', name: 'Cek Kelistrikan & Pengisian Aki', defaultPrice: 40000, estimatedMinutes: 30 },
  { id: 'srv-injeksi', name: 'Pembersihan Injektor & Throttle Body', defaultPrice: 75000, estimatedMinutes: 50 },
];

export const FIELD_LIMITS = {
  skuMax: 40,
  partNameMax: 120,
  brandMax: 60,
  unitMax: 20,
  customerNameMax: 100,
  phoneMax: 24,
  plateMax: 20,
  vehicleMax: 80,
  mechanicMax: 80,
  summaryMax: 500,
  notesMax: 500,
  complaintMax: 500,
  nextServiceMax: 200,
  workshopNameMax: 100,
} as const;
