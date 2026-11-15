import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ADMIN_EMAIL,
  type CartItem,
  type Customer,
  FIELD_LIMITS,
  type PartCategory,
  type PaymentMethod,
  type SparePart,
  type Transaction,
  type TransactionItem,
  type UserProfile,
} from '../types/workshop';
import { clampText, generateInvoiceNumber, getLocalDateString } from '../utils/formatters';

export async function syncUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const isDefaultAdmin = Boolean(user.emailVerified && user.email === ADMIN_EMAIL);

  try {
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as UserProfile;
      const nextDisplayName = clampText(user.displayName || existingData.displayName || 'Kasir Bengkel', 100);
      const nextPhotoURL = clampText(user.photoURL || existingData.photoURL || '', 500);
      await updateDoc(userRef, {
        displayName: nextDisplayName,
        ...(nextPhotoURL ? { photoURL: nextPhotoURL } : {}),
        workshopName: existingData.workshopName || 'Bengkel Karya Motor',
        updatedAt: serverTimestamp(),
      });
      return {
        ...existingData,
        displayName: nextDisplayName,
        photoURL: nextPhotoURL || existingData.photoURL,
      };
    }

    const newProfile = {
      uid: user.uid,
      displayName: clampText(user.displayName || 'Kasir Bengkel', 100),
      email: clampText(user.email || '', 160),
      ...(user.photoURL ? { photoURL: clampText(user.photoURL, 500) } : {}),
      role: isDefaultAdmin ? 'admin' : 'cashier',
      workshopName: 'Bengkel Karya Motor',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    const createdSnap = await getDoc(userRef);
    return createdSnap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function updateWorkshopName(uid: string, workshopName: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const cleanName = clampText(workshopName, FIELD_LIMITS.workshopNameMax);
  if (cleanName.length < 2) {
    throw new Error('Nama bengkel minimal 2 karakter.');
  }
  try {
    await updateDoc(userRef, {
      workshopName: cleanName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export interface SparePartInput {
  sku: string;
  name: string;
  category: PartCategory;
  brand: string;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
}

export async function saveSparePart(
  ownerId: string,
  input: SparePartInput,
  existingId?: string
): Promise<string> {
  const payload = {
    sku: clampText(input.sku.toUpperCase(), FIELD_LIMITS.skuMax),
    name: clampText(input.name, FIELD_LIMITS.partNameMax),
    category: input.category,
    brand: clampText(input.brand, FIELD_LIMITS.brandMax),
    unit: clampText(input.unit, FIELD_LIMITS.unitMax),
    buyPrice: Math.max(0, Math.round(Number(input.buyPrice) || 0)),
    sellPrice: Math.max(0, Math.round(Number(input.sellPrice) || 0)),
    stock: Math.max(0, Math.round(Number(input.stock) || 0)),
    minStock: Math.max(0, Math.round(Number(input.minStock) || 0)),
  };

  if (payload.sku.length < 2 || payload.name.length < 2) {
    throw new Error('SKU dan nama suku cadang minimal 2 karakter.');
  }

  if (existingId) {
    const partRef = doc(db, 'spareParts', existingId);
    try {
      await updateDoc(partRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return existingId;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `spareParts/${existingId}`);
    }
  } else {
    const newRef = doc(collection(db, 'spareParts'));
    try {
      await setDoc(newRef, {
        ownerId,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return newRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `spareParts/${newRef.id}`);
    }
  }
}

export async function adjustPartStock(partId: string, delta: number): Promise<void> {
  const partRef = doc(db, 'spareParts', partId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(partRef);
      if (!snap.exists()) {
        throw new Error('Suku cadang tidak ditemukan.');
      }
      const data = snap.data() as SparePart;
      const nextStock = Math.max(0, Math.round(data.stock + delta));
      tx.update(partRef, {
        stock: nextStock,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Suku cadang tidak ditemukan.') {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `spareParts/${partId}`);
  }
}

export async function deleteSparePart(partId: string): Promise<void> {
  const partRef = doc(db, 'spareParts', partId);
  try {
    await deleteDoc(partRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `spareParts/${partId}`);
  }
}

export interface CustomerInput {
  name: string;
  phone: string;
  plateNumber: string;
  vehicleModel: string;
}

export async function saveCustomer(
  ownerId: string,
  input: CustomerInput,
  existingId?: string
): Promise<string> {
  const payload = {
    name: clampText(input.name, FIELD_LIMITS.customerNameMax),
    phone: clampText(input.phone, FIELD_LIMITS.phoneMax),
    plateNumber: clampText(input.plateNumber.toUpperCase(), FIELD_LIMITS.plateMax),
    vehicleModel: clampText(input.vehicleModel, FIELD_LIMITS.vehicleMax),
  };

  if (payload.name.length < 2 || payload.plateNumber.length < 2) {
    throw new Error('Nama pelanggan dan nomor polisi wajib diisi.');
  }

  if (existingId) {
    const custRef = doc(db, 'customers', existingId);
    try {
      await updateDoc(custRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return existingId;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${existingId}`);
    }
  } else {
    const newRef = doc(collection(db, 'customers'));
    try {
      await setDoc(newRef, {
        ownerId,
        ...payload,
        totalVisits: 0,
        totalSpent: 0,
        lastVisitAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return newRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `customers/${newRef.id}`);
    }
  }
}

export interface CheckoutPayload {
  ownerId: string;
  existingCustomerId?: string;
  customer: CustomerInput;
  mechanicName: string;
  odometerKm: number;
  complaint: string;
  nextServiceNote: string;
  paymentMethod: PaymentMethod;
  discount: number;
  notes: string;
  cart: CartItem[];
}

export interface CheckoutResult {
  transactionId: string;
  invoiceNumber: string;
  customerId: string;
  historyId: string;
  totalAmount: number;
  subtotalParts: number;
  serviceFee: number;
  discount: number;
  transactionDate: string;
  items: TransactionItem[];
  customer: CustomerInput;
  mechanicName: string;
  paymentMethod: PaymentMethod;
  workSummary: string;
  odometerKm: number;
  nextServiceNote: string;
}

export async function processWorkshopCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  if (payload.cart.length === 0) {
    throw new Error('Keranjang kasir masih kosong.');
  }

  const cleanCustomer = {
    name: clampText(payload.customer.name, FIELD_LIMITS.customerNameMax),
    phone: clampText(payload.customer.phone || '-', FIELD_LIMITS.phoneMax).padEnd(5, '0').slice(0, FIELD_LIMITS.phoneMax),
    plateNumber: clampText(payload.customer.plateNumber.toUpperCase(), FIELD_LIMITS.plateMax),
    vehicleModel: clampText(payload.customer.vehicleModel, FIELD_LIMITS.vehicleMax),
  };

  if (cleanCustomer.name.length < 2 || cleanCustomer.plateNumber.length < 2 || cleanCustomer.vehicleModel.length < 2) {
    throw new Error('Nama pelanggan, nomor polisi, dan model kendaraan minimal 2 karakter.');
  }

  const cleanMechanic = clampText(payload.mechanicName || 'Mekanik Utama', FIELD_LIMITS.mechanicMax);
  const cleanComplaint = clampText(payload.complaint || '', FIELD_LIMITS.complaintMax);
  const cleanNotes = clampText(payload.notes || '', FIELD_LIMITS.notesMax);
  const cleanNextNote = clampText(
    payload.nextServiceNote || 'Servis berkala kembali dalam 2.000 km atau 2 bulan.',
    FIELD_LIMITS.nextServiceMax
  );
  const odometerKm = Math.max(0, Math.round(Number(payload.odometerKm) || 0));

  const subtotalParts = payload.cart
    .filter((item) => item.itemType === 'part')
    .reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  const serviceFee = payload.cart
    .filter((item) => item.itemType === 'service')
    .reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  const rawTotal = subtotalParts + serviceFee;
  const discount = Math.min(rawTotal, Math.max(0, Math.round(Number(payload.discount) || 0)));
  const totalAmount = Math.max(0, rawTotal - discount);

  const itemSummary = clampText(
    payload.cart.map((item) => `${item.name} (${item.qty}x)`).join(', '),
    FIELD_LIMITS.summaryMax
  );

  const workSummary = clampText(
    [
      ...payload.cart.filter((i) => i.itemType === 'service').map((i) => i.name),
      ...payload.cart
        .filter((i) => i.itemType === 'part')
        .map((i) => `Ganti ${i.name} (${i.qty} ${i.unit})`),
    ].join('; ') || itemSummary,
    FIELD_LIMITS.summaryMax
  );

  const invoiceNumber = generateInvoiceNumber();
  const transactionDate = getLocalDateString();

  const txRef = doc(collection(db, 'transactions'));
  const historyRef = doc(collection(db, 'serviceHistories'));
  const customerRef = payload.existingCustomerId
    ? doc(db, 'customers', payload.existingCustomerId)
    : doc(collection(db, 'customers'));

  const partCartItems = payload.cart.filter((item) => item.itemType === 'part' && item.partId);

  const createdItems: TransactionItem[] = [];

  try {
    await runTransaction(db, async (tx) => {
      // 1. ALL READS FIRST
      const partSnaps = await Promise.all(
        partCartItems.map(async (item) => ({
          item,
          ref: doc(db, 'spareParts', item.partId),
          snap: await tx.get(doc(db, 'spareParts', item.partId)),
        }))
      );

      let existingCustData: Customer | null = null;
      if (payload.existingCustomerId) {
        const custSnap = await tx.get(customerRef);
        if (custSnap.exists()) {
          existingCustData = custSnap.data() as Customer;
        }
      }

      // 2. VALIDATE STOCK
      for (const entry of partSnaps) {
        if (!entry.snap.exists()) {
          throw new Error(`Suku cadang "${entry.item.name}" tidak ditemukan di inventaris.`);
        }
        const partData = entry.snap.data() as SparePart;
        if (partData.stock < entry.item.qty) {
          throw new Error(
            `Stok "${partData.name}" tidak mencukupi (tersisa ${partData.stock} ${partData.unit}).`
          );
        }
      }

      // 3. ALL WRITES
      // 3a. Decrement spare part stock
      for (const entry of partSnaps) {
        const partData = entry.snap.data() as SparePart;
        tx.update(entry.ref, {
          stock: partData.stock - entry.item.qty,
          updatedAt: serverTimestamp(),
        });
      }

      // 3b. Create or update Customer
      if (existingCustData) {
        tx.update(customerRef, {
          name: cleanCustomer.name,
          phone: cleanCustomer.phone,
          plateNumber: cleanCustomer.plateNumber,
          vehicleModel: cleanCustomer.vehicleModel,
          totalVisits: (existingCustData.totalVisits || 0) + 1,
          totalSpent: (existingCustData.totalSpent || 0) + totalAmount,
          lastVisitAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(customerRef, {
          ownerId: payload.ownerId,
          ...cleanCustomer,
          totalVisits: 1,
          totalSpent: totalAmount,
          lastVisitAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 3c. Create Transaction header
      tx.set(txRef, {
        ownerId: payload.ownerId,
        invoiceNumber,
        customerId: customerRef.id,
        customerName: cleanCustomer.name,
        plateNumber: cleanCustomer.plateNumber,
        vehicleModel: cleanCustomer.vehicleModel,
        mechanicName: cleanMechanic,
        paymentMethod: payload.paymentMethod,
        status: 'Selesai',
        subtotalParts,
        serviceFee,
        discount,
        totalAmount,
        itemsCount: payload.cart.length,
        itemSummary,
        notes: cleanNotes,
        transactionDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3d. Create Transaction line items subcollection
      for (const cartItem of payload.cart) {
        const itemRef = doc(collection(db, 'transactions', txRef.id, 'items'));
        const itemDoc: Omit<TransactionItem, 'id'> = {
          ownerId: payload.ownerId,
          transactionId: txRef.id,
          itemType: cartItem.itemType,
          partId: cartItem.partId || '',
          name: clampText(cartItem.name, FIELD_LIMITS.partNameMax),
          qty: cartItem.qty,
          unitPrice: cartItem.unitPrice,
          totalPrice: cartItem.qty * cartItem.unitPrice,
        };
        tx.set(itemRef, itemDoc);
        createdItems.push({ id: itemRef.id, ...itemDoc });
      }

      // 3e. Automatically create ServiceHistory record
      tx.set(historyRef, {
        ownerId: payload.ownerId,
        transactionId: txRef.id,
        invoiceNumber,
        customerId: customerRef.id,
        customerName: cleanCustomer.name,
        plateNumber: cleanCustomer.plateNumber,
        vehicleModel: cleanCustomer.vehicleModel,
        odometerKm,
        complaint: cleanComplaint,
        workSummary,
        mechanicName: cleanMechanic,
        totalCost: totalAmount,
        nextServiceNote: cleanNextNote,
        serviceDate: transactionDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return {
      transactionId: txRef.id,
      invoiceNumber,
      customerId: customerRef.id,
      historyId: historyRef.id,
      totalAmount,
      subtotalParts,
      serviceFee,
      discount,
      transactionDate,
      items: createdItems,
      customer: cleanCustomer,
      mechanicName: cleanMechanic,
      paymentMethod: payload.paymentMethod,
      workSummary,
      odometerKm,
      nextServiceNote: cleanNextNote,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('tidak mencukupi') ||
        error.message.includes('tidak ditemukan') ||
        error.message.includes('minimal 2 karakter'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `transactions/${txRef.id}`);
  }
}

export async function fetchTransactionItems(
  transactionId: string,
  ownerId: string,
  isAdmin: boolean
): Promise<TransactionItem[]> {
  const path = `transactions/${transactionId}/items`;
  try {
    const itemsCol = collection(db, 'transactions', transactionId, 'items');
    const q = isAdmin ? itemsCol : query(itemsCol, where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TransactionItem, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function cancelTransaction(tx: Transaction, reason: string): Promise<void> {
  const txRef = doc(db, 'transactions', tx.id);
  const cleanNote = clampText(
    reason ? `Dibatalkan: ${reason}` : 'Transaksi dibatalkan oleh kasir.',
    FIELD_LIMITS.notesMax
  );
  try {
    await updateDoc(txRef, {
      status: 'Batal',
      notes: cleanNote,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${tx.id}`);
  }
}

export async function updateServiceHistory(
  historyId: string,
  updates: {
    odometerKm: number;
    complaint: string;
    workSummary: string;
    nextServiceNote: string;
  }
): Promise<void> {
  const ref = doc(db, 'serviceHistories', historyId);
  try {
    await updateDoc(ref, {
      odometerKm: Math.max(0, Math.round(Number(updates.odometerKm) || 0)),
      complaint: clampText(updates.complaint, FIELD_LIMITS.complaintMax),
      workSummary: clampText(updates.workSummary, FIELD_LIMITS.summaryMax),
      nextServiceNote: clampText(updates.nextServiceNote, FIELD_LIMITS.nextServiceMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `serviceHistories/${historyId}`);
  }
}

export async function seedWorkshopStarterData(ownerId: string): Promise<void> {
  const batch = writeBatch(db);

  const starterParts: SparePartInput[] = [
    {
      sku: 'OLI-AHM-MPX2',
      name: 'Oli Mesin AHM MPX2 10W-30 0.8L',
      category: 'Oli & Pelumas',
      brand: 'Honda Genuine',
      unit: 'Botol',
      buyPrice: 44000,
      sellPrice: 58000,
      stock: 28,
      minStock: 8,
    },
    {
      sku: 'OLI-YML-MAT',
      name: 'Oli Yamalube Power Matic 0.8L',
      category: 'Oli & Pelumas',
      brand: 'Yamaha Genuine',
      unit: 'Botol',
      buyPrice: 42000,
      sellPrice: 55000,
      stock: 22,
      minStock: 6,
    },
    {
      sku: 'OLI-GRD-120',
      name: 'Oli Gardan Matic 120ml',
      category: 'Oli & Pelumas',
      brand: 'Honda Genuine',
      unit: 'Tube',
      buyPrice: 12000,
      sellPrice: 20000,
      stock: 35,
      minStock: 10,
    },
    {
      sku: 'REM-KMP-DPN',
      name: 'Kampas Rem Depan Cakram Vario / Beat',
      category: 'Rem & Kampas',
      brand: 'Nissin',
      unit: 'Set',
      buyPrice: 36000,
      sellPrice: 55000,
      stock: 14,
      minStock: 5,
    },
    {
      sku: 'REM-KMP-BLK',
      name: 'Kampas Rem Tromol Belakang Matic',
      category: 'Rem & Kampas',
      brand: 'Federal Parts',
      unit: 'Set',
      buyPrice: 28000,
      sellPrice: 45000,
      stock: 4,
      minStock: 5,
    },
    {
      sku: 'CVT-VBL-K44',
      name: 'V-Belt Set + Roller Beat ESP / Scoopy',
      category: 'Mesin & CVT',
      brand: 'Bando',
      unit: 'Set',
      buyPrice: 95000,
      sellPrice: 135000,
      stock: 9,
      minStock: 3,
    },
    {
      sku: 'BUS-NGK-CPR8',
      name: 'Busi NGK CPR8EA-9 Standard',
      category: 'Kelistrikan',
      brand: 'NGK',
      unit: 'Pcs',
      buyPrice: 16000,
      sellPrice: 28000,
      stock: 24,
      minStock: 8,
    },
    {
      sku: 'AKI-GS-GTZ5S',
      name: 'Aki Kering GS Astra GTZ5S MF',
      category: 'Kelistrikan',
      brand: 'GS Astra',
      unit: 'Unit',
      buyPrice: 195000,
      sellPrice: 255000,
      stock: 3,
      minStock: 4,
    },
    {
      sku: 'BAN-FDR-9090',
      name: 'Ban Tubeless FDR Sport XR Evo 90/90-14',
      category: 'Ban & Velg',
      brand: 'FDR',
      unit: 'Unit',
      buyPrice: 210000,
      sellPrice: 275000,
      stock: 6,
      minStock: 2,
    },
    {
      sku: 'FLT-UDR-K59',
      name: 'Filter Udara Vario 125 / 150 K59',
      category: 'Mesin & CVT',
      brand: 'Aspira',
      unit: 'Pcs',
      buyPrice: 32000,
      sellPrice: 52000,
      stock: 11,
      minStock: 4,
    },
  ];

  for (const part of starterParts) {
    const ref = doc(collection(db, 'spareParts'));
    batch.set(ref, {
      ownerId,
      ...part,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const starterCustomers: CustomerInput[] = [
    {
      name: 'Budi Santoso',
      phone: '081288441209',
      plateNumber: 'B 4821 KXY',
      vehicleModel: 'Honda Vario 160 (2023)',
    },
    {
      name: 'Rina Wijaya',
      phone: '085691234401',
      plateNumber: 'B 3190 TGU',
      vehicleModel: 'Yamaha NMAX 155 (2022)',
    },
    {
      name: 'Dimas Pratama',
      phone: '081310992811',
      plateNumber: 'B 6512 EKP',
      vehicleModel: 'Honda Beat Street (2021)',
    },
  ];

  for (const cust of starterCustomers) {
    const ref = doc(collection(db, 'customers'));
    batch.set(ref, {
      ownerId,
      ...cust,
      totalVisits: 0,
      totalSpent: 0,
      lastVisitAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'spareParts');
  }
}
