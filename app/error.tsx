'use client';

import React, { useEffect } from 'react';
import { AlertOctagon, RefreshCw, Home, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    (error?.message && (
      error.message.includes('Loading chunk') ||
      error.message.includes('ChunkLoadError') ||
      error.message.includes('dynamically imported module') ||
      error.message.includes('downloading resources')
    ));

  useEffect(() => {
    console.error('Unhandled Application Error:', error);

    // If chunk load error (stale build cache after deployment), auto-reload once to fetch fresh assets
    if (isChunkError) {
      const storageKey = 'chunk_reload_' + (error?.digest || 'deployment_update');
      const hasReloaded = sessionStorage.getItem(storageKey);
      if (!hasReloaded) {
        sessionStorage.setItem(storageKey, 'true');
        window.location.reload();
      }
    }
  }, [error, isChunkError]);

  const handleTryAgain = () => {
    if (isChunkError) {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="card max-w-md w-full p-8 flex flex-col items-center shadow-2xl border border-indigo-500/20 bg-slate-900/95 backdrop-blur-xl rounded-2xl">
        <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-5 border ${
          isChunkError
            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            : 'bg-red-500/10 text-red-500 border-red-500/20'
        }`}>
          {isChunkError ? <Sparkles className="h-8 w-8 animate-pulse" /> : <AlertOctagon className="h-8 w-8" />}
        </div>

        <h1 className="text-xl font-extrabold text-slate-100 mb-2 tracking-tight">
          {isChunkError ? 'Application Updated' : 'Something Went Wrong'}
        </h1>

        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          {isChunkError
            ? 'A new version of the app was recently deployed. Please reload to load the latest features and updates.'
            : error.message || 'An unexpected application error occurred while loading this page. Don\'t worry, your data is safe.'}
        </p>

        {error.digest && !isChunkError && (
          <div className="mb-6 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-500">
            Error Ref ID: {error.digest}
          </div>
        )}

        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={handleTryAgain}
            className="btn-primary flex-1 justify-center py-2.5 font-bold shadow-lg cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {isChunkError ? 'Reload App' : 'Try Again'}
          </button>

          <Link href="/" className="btn-ghost flex-1 justify-center py-2.5 text-slate-300 border border-slate-700 hover:bg-slate-800">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
