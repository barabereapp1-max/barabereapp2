import React from 'react';
import { WorkshopShell } from './components/WorkshopShell';
import { WorkshopProvider } from './context/WorkshopContext';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kesalahan tidak terduga pada aplikasi.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full space-y-3">
            <h1 className="font-display text-lg font-bold text-slate-900">
              Terjadi Gangguan Aplikasi
            </h1>
            <p className="text-xs text-slate-600 font-mono break-all">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium cursor-pointer"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <WorkshopProvider>
        <WorkshopShell />
      </WorkshopProvider>
    </AppErrorBoundary>
  );
}
