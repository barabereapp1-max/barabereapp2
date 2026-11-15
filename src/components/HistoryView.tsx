import {
  ClipboardList,
  Edit3,
  FileText,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWorkshop } from '../context/WorkshopContext';
import { saveCustomer, updateServiceHistory } from '../services/workshopService';
import { type Customer, FIELD_LIMITS, type ServiceHistory } from '../types/workshop';
import { formatDateId, formatNumberId, formatRupiah, formatTimestampId } from '../utils/formatters';
import { ReceiptModal, type ReceiptData } from './ReceiptModal';

export function HistoryView() {
  const { user, serviceHistories, customers, transactions, dataLoading, notify } = useWorkshop();

  const [activeSubTab, setActiveSubTab] = useState<'logs' | 'customers'>('logs');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected customer vehicle service book modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Edit Service History modal
  const [editingHistory, setEditingHistory] = useState<ServiceHistory | null>(null);
  const [editOdometer, setEditOdometer] = useState('');
  const [editComplaint, setEditComplaint] = useState('');
  const [editWorkSummary, setEditWorkSummary] = useState('');
  const [editNextNote, setEditNextNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Add Customer modal
  const [addCustOpen, setAddCustOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPlate, setCustPlate] = useState('');
  const [custVehicle, setCustVehicle] = useState('');

  // Linked receipt viewer
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  const filteredHistories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return serviceHistories;
    return serviceHistories.filter(
      (h) =>
        h.plateNumber.toLowerCase().includes(q) ||
        h.customerName.toLowerCase().includes(q) ||
        h.vehicleModel.toLowerCase().includes(q) ||
        h.invoiceNumber.toLowerCase().includes(q) ||
        h.workSummary.toLowerCase().includes(q) ||
        h.mechanicName.toLowerCase().includes(q)
    );
  }, [serviceHistories, searchQuery]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.plateNumber.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.vehicleModel.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const selectedCustomerHistories = useMemo(() => {
    if (!selectedCustomer) return [];
    return serviceHistories.filter((h) => h.customerId === selectedCustomer.id);
  }, [selectedCustomer, serviceHistories]);

  const openEditHistory = (h: ServiceHistory) => {
    setEditingHistory(h);
    setEditOdometer(String(h.odometerKm || 0));
    setEditComplaint(h.complaint || '');
    setEditWorkSummary(h.workSummary || '');
    setEditNextNote(h.nextServiceNote || '');
  };

  const handleSaveHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHistory) return;
    setSaving(true);
    try {
      await updateServiceHistory(editingHistory.id, {
        odometerKm: Number(editOdometer) || 0,
        complaint: editComplaint,
        workSummary: editWorkSummary,
        nextServiceNote: editNextNote,
      });
      notify('success', `Catatan servis ${editingHistory.invoiceNumber} berhasil diperbarui.`);
      setEditingHistory(null);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal memperbarui riwayat perbaikan.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await saveCustomer(user.uid, {
        name: custName,
        phone: custPhone || '0800000000',
        plateNumber: custPlate,
        vehicleModel: custVehicle,
      });
      notify('success', `Pelanggan "${custName}" (${custPlate.toUpperCase()}) ditambahkan.`);
      setAddCustOpen(false);
      setCustName('');
      setCustPhone('');
      setCustPlate('');
      setCustVehicle('');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal menambah pelanggan.');
    } finally {
      setSaving(false);
    }
  };

  const openReceiptForTransaction = (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) {
      notify('info', 'Data nota tidak ditemukan.');
      return;
    }
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
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Riwayat Perbaikan &amp; Data Pelanggan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Setiap perbaikan tercatat otomatis setelah transaksi kasir diselesaikan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveSubTab('logs')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'logs'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Log Perbaikan ({serviceHistories.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('customers')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'customers'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Pelanggan ({customers.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAddCustOpen(true)}
            className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tambah Pelanggan</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor polisi (cth: B 4821 KXY), nama pelanggan, atau mekanik..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
            />
          </div>
          <p className="text-xs text-slate-500 tabular-nums">
            Menampilkan{' '}
            <span className="font-semibold text-slate-800">
              {activeSubTab === 'logs' ? filteredHistories.length : filteredCustomers.length}
            </span>{' '}
            data tersimpan
          </p>
        </div>

        {activeSubTab === 'logs' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Tanggal &amp; Nota</th>
                  <th className="py-3 px-4 font-medium">Kendaraan &amp; Pelanggan</th>
                  <th className="py-3 px-4 font-medium text-right">Odometer</th>
                  <th className="py-3 px-4 font-medium">Tindakan &amp; Suku Cadang</th>
                  <th className="py-3 px-4 font-medium">Mekanik</th>
                  <th className="py-3 px-4 font-medium text-right">Total Biaya</th>
                  <th className="py-3 px-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataLoading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Memuat riwayat perbaikan...
                    </td>
                  </tr>
                ) : filteredHistories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Belum ada riwayat perbaikan tercatat. Selesaikan transaksi di Kasir untuk
                      mencatat buku servis secara otomatis.
                    </td>
                  </tr>
                ) : (
                  filteredHistories.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-medium text-slate-900">{formatDateId(h.serviceDate)}</p>
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                          {h.invoiceNumber}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono font-semibold text-slate-900">{h.plateNumber}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {h.customerName}
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span>{h.vehicleModel}</span>
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {h.odometerKm > 0 ? `${formatNumberId(h.odometerKm)} km` : '-'}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-slate-900 font-medium leading-relaxed">{h.workSummary}</p>
                        {h.complaint && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Keluhan: {h.complaint}
                          </p>
                        )}
                        {h.nextServiceNote && (
                          <p className="text-[11px] text-blue-700 mt-0.5">
                            Berikutnya: {h.nextServiceNote}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {h.mechanicName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(h.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openReceiptForTransaction(h.transactionId)}
                            title="Lihat Nota"
                            className="p-1.5 rounded hover:bg-slate-100 text-blue-700 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditHistory(h)}
                            title="Edit Catatan Servis"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Nomor Polisi</th>
                  <th className="py-3 px-4 font-medium">Nama Pelanggan</th>
                  <th className="py-3 px-4 font-medium">Model Kendaraan</th>
                  <th className="py-3 px-4 font-medium text-right">Kunjungan</th>
                  <th className="py-3 px-4 font-medium text-right">Total Belanja</th>
                  <th className="py-3 px-4 font-medium">Terakhir Servis</th>
                  <th className="py-3 px-4 font-medium text-right">Buku Servis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Belum ada pelanggan terdaftar.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {c.plateNumber}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{c.name}</p>
                        <p className="font-mono text-[11px] text-slate-500 mt-0.5">{c.phone}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{c.vehicleModel}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                        {c.totalVisits}x
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(c.totalSpent)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                        {formatTimestampId(c.lastVisitAt)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="text-blue-700 hover:text-blue-900 font-medium cursor-pointer"
                        >
                          Buka Riwayat
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Vehicle Service Book Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Buku Servis — <span className="font-mono">{selectedCustomer.plateNumber}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCustomer.name} · {selectedCustomer.vehicleModel} ·{' '}
                  {selectedCustomer.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[65vh] overflow-y-auto divide-y divide-slate-200">
              {selectedCustomerHistories.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Belum ada catatan perbaikan untuk kendaraan ini.
                </p>
              ) : (
                selectedCustomerHistories.map((h) => (
                  <div key={h.id} className="py-4 first:pt-0 last:pb-0 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="font-semibold text-slate-900">
                          {formatDateId(h.serviceDate)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{h.invoiceNumber}</span>
                        {h.odometerKm > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {formatNumberId(h.odometerKm)} km
                            </span>
                          </>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatRupiah(h.totalCost)}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-900">{h.workSummary}</p>
                    {h.complaint && (
                      <p className="text-slate-600">Keluhan awal: {h.complaint}</p>
                    )}
                    <div className="flex items-center justify-between text-slate-500 pt-1">
                      <span>Mekanik: {h.mechanicName}</span>
                      {h.nextServiceNote && (
                        <span className="text-blue-700">{h.nextServiceNote}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Service History Modal */}
      {editingHistory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Perbarui Catatan Servis ({editingHistory.invoiceNumber})
              </h3>
              <button
                type="button"
                onClick={() => setEditingHistory(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveHistory} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Odometer (km)</label>
                <input
                  type="number"
                  min={0}
                  value={editOdometer}
                  onChange={(e) => setEditOdometer(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Keluhan Pelanggan</label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.complaintMax}
                  value={editComplaint}
                  onChange={(e) => setEditComplaint(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Ringkasan Pekerjaan &amp; Penggantian Part*
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={FIELD_LIMITS.summaryMax}
                  value={editWorkSummary}
                  onChange={(e) => setEditWorkSummary(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Rekomendasi Servis Berikutnya
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.nextServiceMax}
                  value={editNextNote}
                  onChange={(e) => setEditNextNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingHistory(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-medium cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {addCustOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Tambah Pelanggan &amp; Kendaraan
              </h3>
              <button
                type="button"
                onClick={() => setAddCustOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Pelanggan*</label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.customerNameMax}
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nomor Telepon / WA*</label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.phoneMax}
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nomor Polisi*</label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.plateMax}
                  value={custPlate}
                  onChange={(e) => setCustPlate(e.target.value.toUpperCase())}
                  placeholder="B 4821 KXY"
                  className="w-full px-3 py-2 text-sm font-mono uppercase rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Model Kendaraan*</label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.vehicleMax}
                  value={custVehicle}
                  onChange={(e) => setCustVehicle(e.target.value)}
                  placeholder="Honda Vario 160 (2023)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddCustOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-medium cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReceiptModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </div>
  );
}
