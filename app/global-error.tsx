'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-4 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Critical Application Error</h2>
          <p className="text-sm text-slate-400 mb-6">
            A system error occurred. Please try reloading the page.
          </p>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </button>
        </div>
      </body>
    </html>
  );
}
