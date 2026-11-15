import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWorkshop } from '../context/WorkshopContext';
import {
  adjustPartStock,
  deleteSparePart,
  saveSparePart,
  seedWorkshopStarterData,
  type SparePartInput,
} from '../services/workshopService';
import {
  FIELD_LIMITS,
  PART_CATEGORIES,
  type PartCategory,
  type SparePart,
} from '../types/workshop';
import { formatNumberId, formatRupiah } from '../utils/formatters';

const EMPTY_FORM: SparePartInput = {
  sku: '',
  name: '',
  category: 'Oli & Pelumas',
  brand: '',
  unit: 'Pcs',
  buyPrice: 0,
  sellPrice: 0,
  stock: 0,
  minStock: 5,
};

export function InventoryView() {
  const { user, spareParts, dataLoading, notify } = useWorkshop();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'empty'>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [formData, setFormData] = useState<SparePartInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SparePart | null>(null);
  const [seeding, setSeeding] = useState(false);

  const summary = useMemo(() => {
    const totalSku = spareParts.length;
    const totalUnits = spareParts.reduce((s, p) => s + p.stock, 0);
    const inventoryCostValue = spareParts.reduce((s, p) => s + p.stock * p.buyPrice, 0);
    const lowStockCount = spareParts.filter((p) => p.stock <= p.minStock).length;
    return { totalSku, totalUnits, inventoryCostValue, lowStockCount };
  }, [spareParts]);

  const filteredParts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return spareParts.filter((part) => {
      if (categoryFilter !== 'Semua' && part.category !== categoryFilter) return false;
      if (stockFilter === 'low' && !(part.stock > 0 && part.stock <= part.minStock)) return false;
      if (stockFilter === 'empty' && part.stock !== 0) return false;
      if (!q) return true;
      return (
        part.name.toLowerCase().includes(q) ||
        part.sku.toLowerCase().includes(q) ||
        part.brand.toLowerCase().includes(q)
      );
    });
  }, [spareParts, searchQuery, categoryFilter, stockFilter]);

  const openAddModal = () => {
    setEditingPart(null);
    setFormData(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEditModal = (part: SparePart) => {
    setEditingPart(part);
    setFormData({
      sku: part.sku,
      name: part.name,
      category: part.category,
      brand: part.brand,
      unit: part.unit,
      buyPrice: part.buyPrice,
      sellPrice: part.sellPrice,
      stock: part.stock,
      minStock: part.minStock,
    });
    setFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await saveSparePart(user.uid, formData, editingPart?.id);
      notify(
        'success',
        editingPart
          ? `Data "${formData.name}" berhasil diperbarui.`
          : `Suku cadang "${formData.name}" berhasil ditambahkan.`
      );
      setFormOpen(false);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal menyimpan suku cadang.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustStock = async (part: SparePart, delta: number) => {
    try {
      await adjustPartStock(part.id, delta);
      notify(
        'success',
        `Stok "${part.name}" diperbarui (${delta > 0 ? `+${delta}` : delta} ${part.unit}).`
      );
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal mengubah stok.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteSparePart(deleteTarget.id);
      notify('info', `Suku cadang "${deleteTarget.name}" telah dihapus.`);
      setDeleteTarget(null);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal menghapus suku cadang.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedWorkshopStarterData(user.uid);
      notify('success', 'Katalog suku cadang awal berhasil dimuat.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal memuat katalog contoh.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Manajemen Stok Suku Cadang
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola katalog harga modal, harga jual, dan pemantauan stok minimum gudang
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start"
        >
          <PackagePlus className="w-4 h-4" />
          <span>Tambah Suku Cadang</span>
        </button>
      </div>

      {/* 4-Column Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Total SKU Terdaftar</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatNumberId(summary.totalSku)} Item
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Total Unit Fisik</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatNumberId(summary.totalUnits)} Unit
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Nilai Aset Modal Stok</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatRupiah(summary.inventoryCostValue)}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Perlu Restock Segera</p>
          <p
            className={`mt-1.5 font-mono text-xl font-bold tabular-nums ${
              summary.lowStockCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {formatNumberId(summary.lowStockCount)} SKU
          </p>
        </div>
      </div>

      {/* Filter Bar & Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari SKU, nama part, atau merek..."
                className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 w-60"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter kategori suku cadang"
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="Semua">Semua Kategori</option>
              {PART_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                stockFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Semua Stok
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                stockFilter === 'low' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Stok Menipis
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('empty')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                stockFilter === 'empty' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Stok Habis
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-medium">SKU &amp; Nama Suku Cadang</th>
                <th className="py-3 px-4 font-medium">Kategori</th>
                <th className="py-3 px-4 font-medium text-right">Harga Modal</th>
                <th className="py-3 px-4 font-medium text-right">Harga Jual</th>
                <th className="py-3 px-4 font-medium text-center">Stok Gudang</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataLoading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Memuat data stok suku cadang...
                  </td>
                </tr>
              ) : spareParts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center space-y-3">
                    <p className="text-sm font-medium text-slate-700">
                      Belum ada suku cadang di gudang.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-medium cursor-pointer"
                      >
                        Tambah Suku Cadang Pertama
                      </button>
                      <button
                        type="button"
                        onClick={handleSeed}
                        disabled={seeding}
                        className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium cursor-pointer"
                      >
                        {seeding ? 'Memuat...' : 'Muat 10 Data Contoh'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Tidak ada suku cadang yang cocok dengan filter aktif.
                  </td>
                </tr>
              ) : (
                filteredParts.map((part) => {
                  const isOut = part.stock === 0;
                  const isLow = part.stock > 0 && part.stock <= part.minStock;

                  return (
                    <tr key={part.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{part.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono">{part.sku}</span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span>{part.brand}</span>
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {part.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {formatRupiah(part.buyPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(part.sellPrice)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(part, -1)}
                            disabled={part.stock <= 0}
                            title="Kurangi 1"
                            className="w-6 h-6 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-mono cursor-pointer"
                          >
                            -
                          </button>
                          <span className="min-w-[64px] text-center font-mono font-semibold text-slate-900 tabular-nums">
                            {part.stock} {part.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(part, 5)}
                            title="Restock +5"
                            className="px-1.5 h-6 rounded border border-slate-200 bg-white hover:bg-slate-100 text-blue-700 font-mono font-medium cursor-pointer flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" />
                            <span>5</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 font-medium text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Habis</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Menipis (Min {part.minStock})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Aman</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(part)}
                            aria-label={`Edit ${part.name}`}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(part)}
                            aria-label={`Hapus ${part.name}`}
                            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Spare Part Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {editingPart ? 'Edit Suku Cadang' : 'Tambah Suku Cadang Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kode SKU*</label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.skuMax}
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="Contoh: OLI-MPX2-08"
                    className="w-full px-3 py-2 text-sm font-mono uppercase rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kategori*</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as PartCategory })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-600"
                  >
                    {PART_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Suku Cadang*</label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.partNameMax}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Oli Mesin AHM MPX2 0.8L"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Merek*</label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.brandMax}
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Contoh: Honda Genuine"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Satuan*</label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.unitMax}
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="Botol / Pcs / Set / Unit"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Harga Modal (Rp)*</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.buyPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, buyPrice: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Harga Jual (Rp)*</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.sellPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, sellPrice: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Stok Awal / Saat Ini*</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Batas Minimum Stok*</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-medium cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : editingPart ? 'Simpan Perubahan' : 'Tambah ke Gudang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Hapus Suku Cadang?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Anda akan menghapus <span className="font-semibold text-slate-900">{deleteTarget.name}</span>{' '}
              ({deleteTarget.sku}) dari katalog stok. Nota transaksi sebelumnya tetap aman di arsip.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-medium cursor-pointer"
              >
                {saving ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
