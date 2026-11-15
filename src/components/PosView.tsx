import {
  Check,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWorkshop } from '../context/WorkshopContext';
import { processWorkshopCheckout } from '../services/workshopService';
import {
  type CartItem,
  FIELD_LIMITS,
  PART_CATEGORIES,
  PAYMENT_METHODS,
  type PaymentMethod,
  SERVICE_PRESETS,
  type SparePart,
} from '../types/workshop';
import { formatNumberId, formatRupiah } from '../utils/formatters';
import { ReceiptModal, type ReceiptData } from './ReceiptModal';

export function PosView() {
  const { user, spareParts, customers, notify } = useWorkshop();

  // Left catalog filters
  const [catalogMode, setCatalogMode] = useState<'parts' | 'services'>('parts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // Custom service form
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');

  // Cart & checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>(
    customers.length > 0 ? 'existing' : 'new'
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPlate, setCustPlate] = useState('');
  const [custVehicle, setCustVehicle] = useState('');

  // Automatic Service History fields
  const [mechanicName, setMechanicName] = useState('Andi Saputra');
  const [odometerKm, setOdometerKm] = useState('');
  const [complaint, setComplaint] = useState('');
  const [nextServiceNote, setNextServiceNote] = useState(
    'Ganti oli & cek rem kembali dalam 2.000 km'
  );
  const [discountInput, setDiscountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  const filteredParts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return spareParts.filter((part) => {
      if (selectedCategory !== 'Semua' && part.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        part.name.toLowerCase().includes(q) ||
        part.sku.toLowerCase().includes(q) ||
        part.brand.toLowerCase().includes(q)
      );
    });
  }, [spareParts, searchQuery, selectedCategory]);

  const selectedExistingCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const addPartToCart = (part: SparePart) => {
    if (part.stock <= 0) {
      notify('error', `Stok "${part.name}" sedang habis.`);
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.itemType === 'part' && i.partId === part.id);
      if (idx >= 0) {
        const current = prev[idx];
        if (current.qty >= part.stock) {
          notify('info', `Maksimal stok tersedia untuk "${part.name}" adalah ${part.stock} ${part.unit}.`);
          return prev;
        }
        const updated = [...prev];
        updated[idx] = { ...current, qty: current.qty + 1, maxStock: part.stock };
        return updated;
      }
      return [
        ...prev,
        {
          key: `part-${part.id}`,
          itemType: 'part',
          partId: part.id,
          name: part.name,
          unit: part.unit,
          qty: 1,
          unitPrice: part.sellPrice,
          maxStock: part.stock,
        },
      ];
    });
  };

  const addServiceToCart = (name: string, price: number, keySuffix: string) => {
    const cleanName = name.trim().slice(0, FIELD_LIMITS.partNameMax);
    const cleanPrice = Math.max(0, Math.round(price));
    if (cleanName.length < 2) {
      notify('error', 'Nama jasa servis minimal 2 karakter.');
      return;
    }

    setCart((prev) => {
      const key = `srv-${keySuffix}`;
      const idx = prev.findIndex((i) => i.key === key);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      return [
        ...prev,
        {
          key,
          itemType: 'service',
          partId: '',
          name: cleanName,
          unit: 'Jasa',
          qty: 1,
          unitPrice: cleanPrice,
        },
      ];
    });
  };

  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(customServicePrice.replace(/[^\d]/g, '')) || 0;
    addServiceToCart(customServiceName, priceNum, `custom-${Date.now()}`);
    setCustomServiceName('');
    setCustomServicePrice('');
  };

  const updateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          const nextQty = item.qty + delta;
          if (nextQty <= 0) return null;
          if (item.itemType === 'part' && item.maxStock !== undefined && nextQty > item.maxStock) {
            notify('info', `Stok "${item.name}" hanya tersisa ${item.maxStock} ${item.unit}.`);
            return item;
          }
          return { ...item, qty: nextQty };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const removeCartItem = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const subtotalParts = useMemo(
    () => cart.filter((i) => i.itemType === 'part').reduce((s, i) => s + i.qty * i.unitPrice, 0),
    [cart]
  );

  const serviceFee = useMemo(
    () => cart.filter((i) => i.itemType === 'service').reduce((s, i) => s + i.qty * i.unitPrice, 0),
    [cart]
  );

  const rawSubtotal = subtotalParts + serviceFee;
  const discountVal = Math.min(rawSubtotal, Math.max(0, Number(discountInput) || 0));
  const totalAmount = Math.max(0, rawSubtotal - discountVal);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (cart.length === 0) {
      notify('error', 'Tambahkan minimal 1 suku cadang atau jasa servis terlebih dahulu.');
      return;
    }

    const useExisting = customerMode === 'existing' && selectedExistingCustomer !== null;
    const customerPayload = useExisting
      ? {
          name: selectedExistingCustomer.name,
          phone: selectedExistingCustomer.phone,
          plateNumber: selectedExistingCustomer.plateNumber,
          vehicleModel: selectedExistingCustomer.vehicleModel,
        }
      : {
          name: custName,
          phone: custPhone || '0800000000',
          plateNumber: custPlate,
          vehicleModel: custVehicle,
        };

    if (
      customerPayload.name.trim().length < 2 ||
      customerPayload.plateNumber.trim().length < 2 ||
      customerPayload.vehicleModel.trim().length < 2
    ) {
      notify('error', 'Lengkapi Nama Pelanggan, Nomor Polisi, dan Model Kendaraan.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await processWorkshopCheckout({
        ownerId: user.uid,
        existingCustomerId: useExisting ? selectedExistingCustomer.id : undefined,
        customer: customerPayload,
        mechanicName,
        odometerKm: Number(odometerKm) || 0,
        complaint,
        nextServiceNote,
        paymentMethod,
        discount: discountVal,
        notes,
        cart,
      });

      notify(
        'success',
        `Transaksi ${result.invoiceNumber} selesai. Stok diperbarui & riwayat perbaikan otomatis tercatat.`
      );

      setActiveReceipt({
        transactionId: result.transactionId,
        invoiceNumber: result.invoiceNumber,
        customerName: result.customer.name,
        plateNumber: result.customer.plateNumber,
        vehicleModel: result.customer.vehicleModel,
        mechanicName: result.mechanicName,
        paymentMethod: result.paymentMethod,
        status: 'Selesai',
        subtotalParts: result.subtotalParts,
        serviceFee: result.serviceFee,
        discount: result.discount,
        totalAmount: result.totalAmount,
        transactionDate: result.transactionDate,
        odometerKm: result.odometerKm,
        nextServiceNote: result.nextServiceNote,
        items: result.items,
      });

      // Reset cart & transient service fields
      setCart([]);
      setComplaint('');
      setOdometerKm('');
      setDiscountInput('');
      setNotes('');
      if (!useExisting) {
        setCustName('');
        setCustPhone('');
        setCustPlate('');
        setCustVehicle('');
        setSelectedCustomerId(result.customerId);
        setCustomerMode('existing');
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal memproses transaksi kasir.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Kasir Bengkel &amp; Pencatatan Servis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pembayaran otomatis memotong stok gudang dan menyimpan riwayat perbaikan kendaraan
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setCatalogMode('parts')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              catalogMode === 'parts'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Suku Cadang ({spareParts.length})
          </button>
          <button
            type="button"
            onClick={() => setCatalogMode('services')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              catalogMode === 'services'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Jasa Perbaikan ({SERVICE_PRESETS.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Catalog Panel (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {catalogMode === 'parts' ? (
            <>
              <div className="p-4 border-b border-slate-200 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama suku cadang, kode SKU, atau merek..."
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(['Semua', ...PART_CATEGORIES] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
                {filteredParts.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    Tidak ada suku cadang yang sesuai dengan pencarian Anda.
                  </div>
                ) : (
                  filteredParts.map((part) => {
                    const outOfStock = part.stock <= 0;
                    const lowStock = part.stock > 0 && part.stock <= part.minStock;
                    const inCartQty =
                      cart.find((c) => c.itemType === 'part' && c.partId === part.id)?.qty || 0;

                    return (
                      <div
                        key={part.id}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono font-medium text-slate-700">{part.sku}</span>
                            <span aria-hidden="true">·</span>
                            <span>{part.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{part.brand}</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                            {part.name}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs">
                            <span className="font-mono font-bold text-slate-900 tabular-nums">
                              {formatRupiah(part.sellPrice)}
                            </span>
                            <span className="text-slate-300">|</span>
                            <span
                              className={`font-medium tabular-nums ${
                                outOfStock
                                  ? 'text-red-700'
                                  : lowStock
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {outOfStock
                                ? 'Stok Habis'
                                : `Stok ${formatNumberId(part.stock)} ${part.unit}`}
                            </span>
                            {inCartQty > 0 && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="font-medium text-blue-700 tabular-nums">
                                  {inCartQty} di nota
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => addPartToCart(part)}
                          disabled={outOfStock}
                          className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="p-5 space-y-6">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  Paket Jasa Bengkel Standar
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih layanan jasa perbaikan untuk dimasukkan ke nota transaksi
                </p>

                <div className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {SERVICE_PRESETS.map((srv) => (
                    <div
                      key={srv.id}
                      className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{srv.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          Estimasi {srv.estimatedMinutes} menit
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {formatRupiah(srv.defaultPrice)}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addServiceToCart(srv.name, srv.defaultPrice, srv.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Service Input */}
              <form
                onSubmit={handleAddCustomService}
                className="pt-5 border-t border-slate-200 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-slate-500" />
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Tambah Jasa Perbaikan Kustom
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      value={customServiceName}
                      onChange={(e) => setCustomServiceName(e.target.value)}
                      maxLength={FIELD_LIMITS.partNameMax}
                      placeholder="Contoh: Bongkar Pasang Shockbreaker"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="number"
                      min={0}
                      value={customServicePrice}
                      onChange={(e) => setCustomServicePrice(e.target.value)}
                      placeholder="Tarif Jasa (Rp)"
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-2 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
                    >
                      Tambah
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Checkout & Service Log Form (5 cols) */}
        <form
          onSubmit={handleCheckout}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5"
        >
          {/* Customer Selector */}
          <div className="space-y-3 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                1. Data Pelanggan &amp; Kendaraan
              </h2>
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  disabled={customers.length === 0}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                    customerMode === 'existing'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>Terdaftar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    customerMode === 'new'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Baru</span>
                </button>
              </div>
            </div>

            {customerMode === 'existing' && customers.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  aria-label="Pilih pelanggan terdaftar"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Pilih Pelanggan / Nomor Polisi --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.plateNumber} — {c.name} ({c.vehicleModel})
                    </option>
                  ))}
                </select>
                {selectedExistingCustomer && (
                  <p className="text-xs text-slate-500 tabular-nums">
                    HP: {selectedExistingCustomer.phone}
                    <span className="mx-1.5 text-slate-300">·</span>
                    Riwayat kunjungan: {selectedExistingCustomer.totalVisits}x
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  maxLength={FIELD_LIMITS.customerNameMax}
                  required
                  placeholder="Nama Pelanggan*"
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  maxLength={FIELD_LIMITS.phoneMax}
                  placeholder="No. HP / WhatsApp"
                  className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
                <input
                  type="text"
                  value={custPlate}
                  onChange={(e) => setCustPlate(e.target.value.toUpperCase())}
                  maxLength={FIELD_LIMITS.plateMax}
                  required
                  placeholder="Nomor Polisi (cth: B 4821 KXY)*"
                  className="px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
                <input
                  type="text"
                  value={custVehicle}
                  onChange={(e) => setCustVehicle(e.target.value)}
                  maxLength={FIELD_LIMITS.vehicleMax}
                  required
                  placeholder="Model Kendaraan (cth: Vario 160)*"
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>

          {/* Automatic Service History Details */}
          <div className="space-y-2.5 pb-4 border-b border-slate-200">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              2. Detail Perbaikan (Otomatis ke Buku Servis)
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Nama Mekanik*
                </label>
                <input
                  type="text"
                  value={mechanicName}
                  onChange={(e) => setMechanicName(e.target.value)}
                  maxLength={FIELD_LIMITS.mechanicMax}
                  required
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Odometer (km)
                </label>
                <input
                  type="number"
                  min={0}
                  value={odometerKm}
                  onChange={(e) => setOdometerKm(e.target.value)}
                  placeholder="Contoh: 18450"
                  className="w-full px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
            <input
              type="text"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              maxLength={FIELD_LIMITS.complaintMax}
              placeholder="Keluhan pelanggan (opsional, cth: tarikan berat & rem bunyi)"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
            />
            <input
              type="text"
              value={nextServiceNote}
              onChange={(e) => setNextServiceNote(e.target.value)}
              maxLength={FIELD_LIMITS.nextServiceMax}
              placeholder="Rekomendasi servis berikutnya"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Cart Items */}
          <div className="space-y-3 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                3. Rincian Item Nota ({cart.length})
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                <ShoppingCart className="w-5 h-5 mx-auto mb-1.5 text-slate-300" />
                Pilih suku cadang atau jasa di panel kiri untuk memulai transaksi.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.key} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-900 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {formatRupiah(item.unitPrice)} / {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.key, -1)}
                        aria-label="Kurangi jumlah"
                        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.key, 1)}
                        aria-label="Tambah jumlah"
                        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="w-20 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {formatRupiah(item.qty * item.unitPrice)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.key)}
                        aria-label="Hapus item"
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Summary */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Diskon (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Catatan Nota
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={FIELD_LIMITS.notesMax}
                  placeholder="Opsional"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      paymentMethod === method
                        ? 'border-blue-700 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal Suku Cadang</span>
                <span className="font-mono tabular-nums">{formatRupiah(subtotalParts)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Subtotal Jasa Perbaikan</span>
                <span className="font-mono tabular-nums">{formatRupiah(serviceFee)}</span>
              </div>
              {discountVal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Diskon</span>
                  <span className="font-mono tabular-nums">-{formatRupiah(discountVal)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                <span className="text-sm font-bold text-slate-900">Total Pembayaran</span>
                <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {formatRupiah(totalAmount)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || cart.length === 0}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>
                {submitting ? 'Memproses Transaksi...' : 'Selesaikan Pembayaran & Catat Riwayat'}
              </span>
            </button>
          </div>
        </form>
      </div>

      <ReceiptModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </div>
  );
}
