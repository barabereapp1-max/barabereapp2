import { Printer, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWorkshop } from '../context/WorkshopContext';
import { fetchTransactionItems } from '../services/workshopService';
import type { Transaction, TransactionItem } from '../types/workshop';
import { formatDateId, formatRupiah, formatTimestampId } from '../utils/formatters';

export interface ReceiptData {
  transactionId: string;
  invoiceNumber: string;
  customerName: string;
  plateNumber: string;
  vehicleModel: string;
  mechanicName: string;
  paymentMethod: string;
  status: string;
  subtotalParts: number;
  serviceFee: number;
  discount: number;
  totalAmount: number;
  transactionDate: string;
  notes?: string;
  odometerKm?: number;
  nextServiceNote?: string;
  items?: TransactionItem[];
  createdAt?: Transaction['createdAt'];
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const { user, isAdmin, profile, serviceHistories } = useWorkshop();
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!receipt || !user) return;
    if (receipt.items && receipt.items.length > 0) {
      setItems(receipt.items);
      return;
    }

    let cancelled = false;
    setLoadingItems(true);
    fetchTransactionItems(receipt.transactionId, user.uid, isAdmin)
      .then((fetched) => {
        if (!cancelled) setItems(fetched);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });

    return () => {
      cancelled = true;
    };
  }, [receipt, user, isAdmin]);

  if (!receipt) return null;

  const linkedHistory = serviceHistories.find((h) => h.transactionId === receipt.transactionId);
  const odometerKm = receipt.odometerKm ?? linkedHistory?.odometerKm;
  const nextServiceNote = receipt.nextServiceNote ?? linkedHistory?.nextServiceNote;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden my-auto">
        {/* Modal Header (hidden on print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 id="receipt-title" className="font-display text-base font-semibold text-slate-900">
            Nota Transaksi Bengkel
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Nota</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup nota"
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 space-y-5 text-sm text-slate-800">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-dashed border-slate-300">
            <div>
              <p className="font-display text-lg font-bold text-slate-900">
                {profile?.workshopName || 'Bengkel Karya Motor'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Layanan Perawatan, Perbaikan &amp; Suku Cadang Resmi
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {receipt.invoiceNumber}
              </p>
              <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                {receipt.createdAt
                  ? formatTimestampId(receipt.createdAt)
                  : formatDateId(receipt.transactionDate)}
              </p>
            </div>
          </div>

          {/* Customer & Vehicle Summary */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs pb-4 border-b border-slate-200">
            <div>
              <span className="text-slate-500">Pelanggan</span>
              <p className="font-medium text-slate-900 mt-0.5">{receipt.customerName}</p>
            </div>
            <div>
              <span className="text-slate-500">Nomor Polisi / Kendaraan</span>
              <p className="font-medium text-slate-900 mt-0.5">
                <span className="font-mono">{receipt.plateNumber}</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span>{receipt.vehicleModel}</span>
              </p>
            </div>
            <div>
              <span className="text-slate-500">Mekanik Penanggung Jawab</span>
              <p className="font-medium text-slate-900 mt-0.5">{receipt.mechanicName}</p>
            </div>
            <div>
              <span className="text-slate-500">Pembayaran &amp; Status</span>
              <p className="font-medium text-slate-900 mt-0.5">
                {receipt.paymentMethod}
                <span className="text-slate-400 mx-1.5">·</span>
                <span className={receipt.status === 'Batal' ? 'text-red-600' : 'text-emerald-700'}>
                  {receipt.status}
                </span>
              </p>
            </div>
            {typeof odometerKm === 'number' && odometerKm > 0 && (
              <div>
                <span className="text-slate-500">Odometer Saat Servis</span>
                <p className="font-mono font-medium text-slate-900 tabular-nums mt-0.5">
                  {odometerKm.toLocaleString('id-ID')} km
                </p>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Uraian Suku Cadang / Jasa</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Harga</th>
                  <th className="py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingItems ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      Memuat rincian item...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      Rincian item tersedia pada arsip nota.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-2">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.itemType === 'part' ? 'Suku Cadang' : 'Jasa Servis'}
                        </p>
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {item.qty}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {formatRupiah(item.unitPrice)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatRupiah(item.totalPrice)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Suku Cadang</span>
              <span className="font-mono tabular-nums">{formatRupiah(receipt.subtotalParts)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Jasa Perbaikan</span>
              <span className="font-mono tabular-nums">{formatRupiah(receipt.serviceFee)}</span>
            </div>
            {receipt.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Diskon</span>
                <span className="font-mono tabular-nums">-{formatRupiah(receipt.discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-slate-300 text-sm font-bold text-slate-900">
              <span>Total Dibayar</span>
              <span className="font-mono text-base tabular-nums">
                {formatRupiah(receipt.totalAmount)}
              </span>
            </div>
          </div>

          {nextServiceNote && (
            <div className="pt-3 border-t border-slate-200 text-xs text-slate-600">
              <span className="font-medium text-slate-800">Rekomendasi Servis Berikutnya: </span>
              <span>{nextServiceNote}</span>
            </div>
          )}

          {receipt.notes && (
            <div className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">Catatan: </span>
              <span>{receipt.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
