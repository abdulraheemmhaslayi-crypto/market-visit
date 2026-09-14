'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="card max-w-md w-full p-8 flex flex-col items-center shadow-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md rounded-2xl">
        <div className="h-16 w-16 rounded-full bg-sky-500/10 flex items-center justify-center mb-5 text-sky-400 border border-sky-500/20">
          <Compass className="h-8 w-8" />
        </div>

        <h1 className="text-4xl font-extrabold text-slate-100 mb-2">404</h1>
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Page Not Found</h2>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          The page or resource you are looking for does not exist or may have been moved.
        </p>

        <Link href="/" className="btn-primary w-full justify-center py-2.5">
          <Home className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
