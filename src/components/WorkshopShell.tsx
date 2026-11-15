import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Store,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useWorkshop } from '../context/WorkshopContext';
import { updateWorkshopName } from '../services/workshopService';
import { FIELD_LIMITS } from '../types/workshop';
import { DashboardView } from './DashboardView';
import { HistoryView } from './HistoryView';
import { InventoryView } from './InventoryView';
import { LoginScreen } from './LoginScreen';
import { PosView } from './PosView';

type NavTab = 'dashboard' | 'pos' | 'inventory' | 'history';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'dashboard', label: 'Dashboard Admin', icon: BarChart3 },
  { id: 'pos', label: 'Kasir Bengkel', icon: ShoppingCart },
  { id: 'inventory', label: 'Stok Suku Cadang', icon: Package },
  { id: 'history', label: 'Riwayat Perbaikan', icon: ClipboardList },
];

export function WorkshopShell() {
  const {
    user,
    profile,
    isAdmin,
    authReady,
    dataError,
    spareParts,
    toasts,
    dismissToast,
    signOutUser,
    notify,
    refreshProfileState,
  } = useWorkshop();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workshopInput, setWorkshopInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto">
            <Wrench className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-700">Memuat sistem kasir bengkel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const lowStockCount = spareParts.filter((p) => p.stock <= p.minStock).length;
  const activeNavMeta = NAV_ITEMS.find((item) => item.id === activeTab)!;
  const workshopTitle = profile?.workshopName || 'Bengkel Karya Motor';

  const openWorkshopSettings = () => {
    setWorkshopInput(workshopTitle);
    setSettingsOpen(true);
  };

  const handleSaveWorkshopName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingSettings(true);
    try {
      await updateWorkshopName(user.uid, workshopInput);
      refreshProfileState(workshopInput.trim());
      notify('success', 'Nama bengkel berhasil diperbarui.');
      setSettingsOpen(false);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Gagal memperbarui nama bengkel.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const initials = (user.displayName || user.email || 'KB')
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900 text-slate-200 border-r border-slate-800">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <span className="font-display text-sm font-bold text-white truncate">
            {workshopTitle}
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1" aria-label="Menu utama bengkel">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'inventory' && lowStockCount > 0 && (
                  <span className="font-mono text-xs tabular-nums text-amber-300">
                    {lowStockCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <button
            type="button"
            onClick={openWorkshopSettings}
            className="w-full px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Store className="w-4 h-4 shrink-0 text-slate-400" />
            <span>Pengaturan Nama Bengkel</span>
          </button>

          <div className="flex items-center gap-3 px-2 pt-2 border-t border-slate-800/80">
            {user.photoURL && !avatarFailed ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Profil Pengguna'}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-800"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">
                {user.displayName || 'Pengguna Bengkel'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {isAdmin ? 'Admin' : 'Kasir'} · {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={signOutUser}
            className="w-full px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 w-64 bg-slate-900 text-slate-200 flex flex-col h-full">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800">
              <span className="font-display text-sm font-bold text-white truncate">
                {workshopTitle}
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button
                type="button"
                onClick={signOutUser}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1-2 primary actions on right */}
        <header className="no-print h-14 lg:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0 truncate">
              <span className="font-medium text-slate-500 hidden sm:inline truncate">
                {workshopTitle}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">
                {activeNavMeta.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeTab !== 'pos' && (
              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Buka Kasir</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {dataError && (
            <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Gangguan Sinkronisasi Firestore</p>
                <p className="font-mono break-all text-[11px]">{dataError}</p>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === 'pos' && <PosView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'history' && <HistoryView />}
        </main>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-xs font-medium bg-white ${
                t.type === 'error'
                  ? 'border-red-200 text-red-800'
                  : t.type === 'success'
                  ? 'border-emerald-200 text-emerald-900'
                  : 'border-slate-200 text-slate-800'
              }`}
            >
              {t.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-relaxed">{t.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Workshop Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Pengaturan Nama Bengkel
              </h3>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveWorkshopName} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nama Bengkel (Tampil di Nota &amp; Header)
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={FIELD_LIMITS.workshopNameMax}
                  value={workshopInput}
                  onChange={(e) => setWorkshopInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-medium cursor-pointer"
                >
                  {savingSettings ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
