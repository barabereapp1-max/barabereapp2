import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Package,
  Plus,
  Receipt,
  Search,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWorkshop } from '../context/WorkshopContext';
import { adjustPartStock, cancelTransaction, seedWorkshopStarterData } from '../services/workshopService';
import type { Transaction } from '../types/workshop';
import {
  formatDateId,
  formatNumberId,
  formatRupiah,
  formatShortDayId,
  formatTimeOnly,
  getLastNDays,
  getLocalDateString,
} from '../utils/formatters';
import { ReceiptModal, type ReceiptData } from './ReceiptModal';

interface DashboardViewProps {
  onNavigate: (tab: 'dashboard' | 'pos' | 'inventory' | 'history') => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { user, spareParts, transactions, serviceHistories, dataLoading, notify } = useWorkshop();

  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [txSearch, setTxSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('Semua');
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Transaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busyAction, setBusyAction] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const selectedDayTransactions = useMemo(() => {
    return transactions.filter((t) => t.transactionDate === selectedDate);
  }, [transactions, selectedDate]);

  const completedSelectedDay = useMemo(
    () => selectedDayTransactions.filter((t) => t.status === 'Selesai'),
    [selectedDayTransactions]
  );

  const dailyRevenue = useMemo(
    () => completedSelectedDay.reduce((sum, t) => sum + t.totalAmount, 0),
    [completedSelectedDay]
  );

  const dailyPartsRevenue = useMemo(
    () => completedSelectedDay.reduce((sum, t) => sum + t.subtotalParts, 0),
    [completedSelectedDay]
  );

  const dailyServiceRevenue = useMemo(
    () => completedSelectedDay.reduce((sum, t) => sum + t.serviceFee, 0),
    [completedSelectedDay]
  );

  const cashRevenue = useMemo(
    () =>
      completedSelectedDay
        .filter((t) => t.paymentMethod === 'Tunai')
        .reduce((sum, t) => sum + t.totalAmount, 0),
    [completedSelectedDay]
  );

  const nonCashRevenue = dailyRevenue - cashRevenue;

  const avgTicket =
    completedSelectedDay.length > 0 ? Math.round(dailyRevenue / completedSelectedDay.length) : 0;

  const lowStockParts = useMemo(
    () =>
      spareParts
        .filter((p) => p.stock <= p.minStock)
        .sort((a, b) => a.stock - b.stock),
    [spareParts]
  );

  const outOfStockCount = useMemo(
    () => spareParts.filter((p) => p.stock === 0).length,
    [spareParts]
  );

  const dailyHistoriesCount = useMemo(
    () => serviceHistories.filter((h) => h.serviceDate === selectedDate).length,
    [serviceHistories, selectedDate]
  );

  // 7-day trend data ending at selectedDate or today
  const sevenDayTrend = useMemo(() => {
    const days = getLastNDays(7);
    const map = new Map<string, { revenue: number; count: number }>();
    for (const d of days) {
      map.set(d, { revenue: 0, count: 0 });
    }
    for (const t of transactions) {
      if (t.status !== 'Selesai') continue;
      const entry = map.get(t.transactionDate);
      if (entry) {
        entry.revenue += t.totalAmount;
        entry.count += 1;
      }
    }
    const maxRevenue = Math.max(100000, ...Array.from(map.values()).map((v) => v.revenue));
    return days.map((date) => ({
      date,
      label: formatShortDayId(date),
      revenue: map.get(date)?.revenue || 0,
      count: map.get(date)?.count || 0,
      pct: Math.round(((map.get(date)?.revenue || 0) / maxRevenue) * 100),
    }));
  }, [transactions]);

  const paymentBreakdown = useMemo(() => {
    const methods = ['Tunai', 'QRIS', 'Transfer Bank', 'Kartu Debit'] as const;
    return methods.map((method) => {
      const list = completedSelectedDay.filter((t) => t.paymentMethod === method);
      const total = list.reduce((s, t) => s + t.totalAmount, 0);
      const pct = dailyRevenue > 0 ? Math.round((total / dailyRevenue) * 100) : 0;
      return { method, count: list.length, total, pct };
    });
  }, [completedSelectedDay, dailyRevenue]);

  const filteredTableRows = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return selectedDayTransactions.filter((t) => {
      if (methodFilter !== 'Semua' && t.paymentMethod !== methodFilter) return false;
      if (!q) return true;
      return (
        t.invoiceNumber.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        t.plateNumber.toLowerCase().includes(q) ||
        t.mechanicName.toLowerCase().includes(q)
      );
    });
  }, [selectedDayTransactions, txSearch, methodFilter]);

  const handleQuickRestock = async (partId: string, name: string, amount: number) => {
    try {
      await adjustPartStock(partId, amount);
      notify('success', `Stok "${name}" berhasil ditambah +${amount}.`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal menambah stok.');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setBusyAction(true);
    try {
      await cancelTransaction(cancelTarget, cancelReason);
      notify('info', `Nota ${cancelTarget.invoiceNumber} ditandai Batal.`);
      setCancelTarget(null);
      setCancelReason('');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal membatalkan transaksi.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleSeedData = async () => {
    if (!user) return;
    setBusyAction(true);
    try {
      await seedWorkshopStarterData(user.uid);
      notify('success', '10 suku cadang & 3 pelanggan contoh berhasil ditambahkan.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal memuat data awal.');
    } finally {
      setBusyAction(false);
    }
  };

  const hoveredBar = sevenDayTrend.find((d) => d.date === hoveredDay) || sevenDayTrend[sevenDayTrend.length - 1];

  return (
    <div className="space-y-6">
      {/* Top Toolbar: Date Picker & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Laporan Transaksi Harian Real-Time
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ringkasan omzet, arus suku cadang, dan pencatatan servis aktif per{' '}
            <span className="font-medium text-slate-700">{formatDateId(selectedDate)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || todayStr)}
              aria-label="Pilih tanggal laporan"
              className="text-sm font-mono tabular-nums text-slate-800 bg-transparent focus:outline-none"
            />
          </div>
          {selectedDate !== todayStr && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Hari Ini
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Transaksi Kasir Baru</span>
          </button>
        </div>
      </div>

      {/* Starter prompt if inventory is completely empty */}
      {!dataLoading && spareParts.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Bengkel Anda Siap Digunakan
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Belum ada stok suku cadang tersimpan. Anda dapat langsung memuat katalog contoh
              (oli, kampas rem, aki, ban) atau menambahkan suku cadang secara manual.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSeedData}
              disabled={busyAction}
              className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {busyAction ? 'Menyimpan...' : 'Muat Data Awal Bengkel'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Kelola Stok Manual
            </button>
          </div>
        </div>
      )}

      {/* 4-Column KPI Grid (Single-Elevation, Clean Dividers) */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pendapatan Bersih</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {dataLoading ? '...' : formatRupiah(dailyRevenue)}
          </p>
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            Tunai {formatRupiah(cashRevenue)}
            <span className="mx-1.5 text-slate-300">·</span>
            Non-Tunai {formatRupiah(nonCashRevenue)}
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Transaksi Selesai</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {dataLoading ? '...' : `${formatNumberId(completedSelectedDay.length)} Nota`}
          </p>
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            Rata-rata {formatRupiah(avgTicket)} / nota
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Inventaris Suku Cadang</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {dataLoading ? '...' : `${formatNumberId(spareParts.length)} SKU`}
          </p>
          <p className="mt-2 text-xs tabular-nums">
            {lowStockParts.length > 0 ? (
              <span className="text-amber-700 font-medium">
                {lowStockParts.length} perlu restock ({outOfStockCount} habis)
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">Seluruh stok aman</span>
            )}
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Riwayat Servis Tercatat</span>
            <Wrench className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {dataLoading ? '...' : `${formatNumberId(dailyHistoriesCount)} Unit`}
          </p>
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            Total arsip {formatNumberId(serviceHistories.length)} perbaikan
          </p>
        </div>
      </div>

      {/* Analytics Row: 7-Day Trend + Payment & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 7-Day Revenue Bar Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Tren Omzet 7 Hari Terakhir
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Arahkan kursor pada batang grafik untuk melihat rincian per hari
              </p>
            </div>
            {hoveredBar && (
              <div className="text-right">
                <p className="text-xs text-slate-500">{formatDateId(hoveredBar.date)}</p>
                <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {formatRupiah(hoveredBar.revenue)} ({hoveredBar.count} nota)
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 h-52 flex items-end gap-3 sm:gap-5 pt-4">
            {sevenDayTrend.map((day) => {
              const isSelected = day.date === selectedDate;
              const isHovered = day.date === hoveredDay;
              return (
                <button
                  key={day.date}
                  type="button"
                  onMouseEnter={() => setHoveredDay(day.date)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => setSelectedDate(day.date)}
                  className="flex-1 h-full flex flex-col items-center justify-end gap-2 group cursor-pointer focus:outline-none"
                >
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.count > 0 ? `${day.count}x` : '0'}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      style={{ height: `${Math.max(day.revenue > 0 ? 8 : 3, day.pct)}%` }}
                      className={`w-full rounded-t-md transition-colors ${
                        isSelected
                          ? 'bg-blue-700'
                          : isHovered
                          ? 'bg-slate-700'
                          : day.revenue > 0
                          ? 'bg-slate-300 group-hover:bg-slate-500'
                          : 'bg-slate-100'
                      }`}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-medium whitespace-nowrap ${
                      isSelected ? 'text-blue-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {day.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Breakdown Payment Methods & Parts vs Service */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Komposisi Pendapatan Harian
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan penjualan suku cadang dan jasa mekanik
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Penjualan Suku Cadang</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                  {formatRupiah(dailyPartsRevenue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pendapatan Jasa Servis</p>
                <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                  {formatRupiah(dailyServiceRevenue)}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-700">Metode Pembayaran</h3>
            <div className="mt-3 space-y-3">
              {paymentBreakdown.map((item) => (
                <div key={item.method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {item.method}{' '}
                      <span className="text-slate-400 font-normal">({item.count} nota)</span>
                    </span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatRupiah(item.total)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-700 rounded-full"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Real-Time Daily Transactions Table + Low Stock Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Transactions Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Daftar Transaksi ({formatDateId(selectedDate)})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Diperbarui otomatis setiap kasir menyelesaikan pembayaran
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Cari nota, nopol, nama..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 w-44 sm:w-52"
                />
              </div>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                aria-label="Filter metode pembayaran"
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-600"
              >
                <option value="Semua">Semua Metode</option>
                <option value="Tunai">Tunai</option>
                <option value="QRIS">QRIS</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Kartu Debit">Kartu Debit</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Nota &amp; Jam</th>
                  <th className="py-3 px-4 font-medium">Pelanggan &amp; Kendaraan</th>
                  <th className="py-3 px-4 font-medium">Mekanik</th>
                  <th className="py-3 px-4 font-medium">Metode</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataLoading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Menghubungkan ke laporan transaksi real-time...
                    </td>
                  </tr>
                ) : filteredTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Belum ada transaksi tercatat pada tanggal {formatDateId(selectedDate)}.
                    </td>
                  </tr>
                ) : (
                  filteredTableRows.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-mono font-medium text-slate-900 tabular-nums">
                          {tx.invoiceNumber}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                          {formatTimeOnly(tx.createdAt)} WIB
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{tx.customerName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono">{tx.plateNumber}</span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span>{tx.vehicleModel}</span>
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {tx.mechanicName}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {tx.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(tx.totalAmount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            tx.status === 'Batal' ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          {tx.status === 'Batal' ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>{tx.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReceipt({
                                transactionId: tx.id,
                                invoiceNumber: tx.invoiceNumber,
                                customerName: tx.customerName,
                                plateNumber: tx.plateNumber,
                                vehicleModel: tx.vehicleModel,
                                mechanicName: tx.mechanicName,
                                paymentMethod: tx.paymentMethod,
                                status: tx.status,
                                subtotalParts: tx.subtotalParts,
                                serviceFee: tx.serviceFee,
                                discount: tx.discount,
                                totalAmount: tx.totalAmount,
                                transactionDate: tx.transactionDate,
                                notes: tx.notes,
                                createdAt: tx.createdAt,
                              })
                            }
                            className="text-blue-700 hover:text-blue-900 font-medium cursor-pointer"
                          >
                            Nota
                          </button>
                          {tx.status === 'Selesai' && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(tx)}
                              className="text-slate-400 hover:text-red-600 font-medium cursor-pointer"
                            >
                              Batal
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alert Panel */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Peringatan Stok Menipis
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Suku cadang pada atau di bawah batas minimum
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Semua</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {lowStockParts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Seluruh suku cadang masih berada di atas batas minimum stok.
              </div>
            ) : (
              lowStockParts.slice(0, 6).map((part) => (
                <div
                  key={part.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{part.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      <span className="font-mono">{part.sku}</span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className={part.stock === 0 ? 'text-red-700 font-semibold' : 'text-amber-700 font-semibold'}>
                        {part.stock === 0 ? 'Habis' : `Sisa ${part.stock} ${part.unit}`}
                      </span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span>Min {part.minStock}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickRestock(part.id, part.name, 10)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    +10 {part.unit}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />

      {/* Cancel Transaction Confirmation Modal */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Batalkan Nota {cancelTarget.invoiceNumber}?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Status transaksi akan berubah menjadi Batal dan tidak dihitung dalam pendapatan
                  harian. Tindakan ini tercatat pada laporan admin.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Alasan Pembatalan
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Kesalahan input nominal atau batal servis"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={busyAction}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-medium cursor-pointer"
              >
                {busyAction ? 'Memproses...' : 'Ya, Batalkan Nota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
