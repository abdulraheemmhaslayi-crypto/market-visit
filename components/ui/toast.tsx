'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
}

type ToastContextType = {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, title?: string) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    // Auto-generate title for error if not provided
    const defaultTitle = type === 'error' ? 'Action Failed' : type === 'warning' ? 'Warning' : undefined;
    const toastTitle = title || defaultTitle;

    setToasts((prev) => [...prev, { id, message, type, title: toastTitle }]);

    // Auto-dismiss toast: Give errors more time (6500ms) for reading
    const duration = type === 'error' ? 6500 : 4500;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast container floating overlay */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full p-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 pointer-events-auto animate-in slide-in-from-top-4 ${
              toast.type === 'success'
                ? 'bg-emerald-950/85 dark:bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                : toast.type === 'warning'
                ? 'bg-amber-950/85 dark:bg-amber-950/90 border-amber-500/30 text-amber-300'
                : toast.type === 'error'
                ? 'bg-red-950/85 dark:bg-red-950/90 border-red-500/30 text-red-300'
                : 'bg-slate-900/90 border-slate-700/50 text-slate-150'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-400" />}
              {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-400" />}
              {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-red-400" />}
              {toast.type === 'info' && <Info className="h-5 w-5 text-sky-400" />}
            </div>
            <div className="flex-grow min-w-0">
              {toast.title && <h4 className="font-semibold text-sm mb-0.5 text-white">{toast.title}</h4>}
              <p className="text-sm opacity-90 break-words font-medium">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded-lg hover:bg-white/10 text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
export type ToastProviderProps = {
  children: React.ReactNode;
};
