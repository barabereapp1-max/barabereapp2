import { AlertCircle, ClipboardCheck, Layers, TrendingUp, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useWorkshop } from '../context/WorkshopContext';

const HERO_IMAGE_SRC = '/src/assets/images/workshop_bay_hero_1794741184049.jpg';

export function LoginScreen() {
  const { signInWithGoogle, authBusy, authError } = useWorkshop();
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:grid lg:grid-cols-12">
      {/* Left: Editorial Workshop Image Panel */}
      <div className="relative lg:col-span-7 bg-slate-900 overflow-hidden min-h-[260px] lg:min-h-screen flex flex-col justify-between">
        {!imgFailed ? (
          <img
            src={HERO_IMAGE_SRC}
            alt="Suasana area servis bengkel modern dengan peralatan mekanik tertata rapi"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center">
            <Wrench className="w-24 h-24 text-slate-700" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/30" />

        <div className="relative z-10 p-8 lg:p-12 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            Karya Bengkel POS
          </span>
        </div>

        <div className="relative z-10 p-8 lg:p-12 max-w-2xl">
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-white leading-tight [text-wrap:balance]">
            Kendalikan kasir, stok suku cadang, dan buku servis pelanggan dalam satu sistem real-time.
          </h1>
          <p className="mt-4 text-sm lg:text-base text-slate-200 leading-relaxed max-w-xl">
            Setiap transaksi pembayaran langsung memotong stok gudang secara atomik dan mencatat
            riwayat perbaikan kendaraan pelanggan secara otomatis ke Cloud Firestore.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-white/15">
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-medium">
                <Layers className="w-4 h-4 shrink-0" />
                <span>Stok Terintegrasi</span>
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Peringatan otomatis saat suku cadang mendekati batas minimum.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-medium">
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                <span>Riwayat Otomatis</span>
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Odometer, keluhan, dan daftar penggantian part tersimpan per nopol.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-medium">
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Laporan Harian Live</span>
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Pantau omzet harian, metode bayar, dan kinerja mekanik seketika.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Google Sign-In Card */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div>
            <p className="text-xs font-medium text-blue-700 tracking-wide">
              Akses Sistem Bengkel
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">
              Masuk ke Ruang Kerja Kasir
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Gunakan akun Google Anda untuk menyimpan seluruh data inventaris, nota transaksi,
              dan riwayat pelanggan secara permanen di cloud.
            </p>
          </div>

          {authError && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-4">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={authBusy}
              className="w-full min-h-[48px] px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer whitespace-nowrap"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.52-1.14 2.81-2.4 3.67l3.87 3c2.26-2.09 3.55-5.17 3.55-8.91z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.45 1.16-4.06 1.16-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
              </svg>
              <span>{authBusy ? 'Menghubungkan akun Google...' : 'Masuk dengan Google'}</span>
            </button>
          </div>

          <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-2">
            <p className="font-medium text-slate-700">Perlindungan Data Permanen</p>
            <p className="leading-relaxed">
              Koneksi terenkripsi langsung ke Firebase Cloud Firestore. Stok suku cadang, riwayat
              perbaikan, dan rekap harian tetap aman walau browser ditutup atau berpindah perangkat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
