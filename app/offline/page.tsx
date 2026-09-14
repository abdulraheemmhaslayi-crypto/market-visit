"use client";

import { WifiOff, RotateCw, Home } from "lucide-react";
import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-radial from-[#EEF2FF] to-[#F4F6FA] dark:from-[#0B0F1A] dark:to-[#111827] p-6 font-sans transition-colors duration-300">
      <div className="relative w-full max-w-md p-8 md:p-10 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-slate-800/40 shadow-2xl flex flex-col items-center text-center transition-all duration-300 transform hover:scale-[1.01]">
        
        {/* Glow effect */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Icon Circle */}
        <div className="relative w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center mb-6 shadow-inner animate-pulse">
          <WifiOff className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 animate-ping" />
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900" />
        </div>

        {/* Typography */}
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-3">
          No Internet Connection
        </h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mb-8 leading-relaxed max-w-sm">
          You are currently offline. Supervisor Field Visit Management will display cached pages, but dynamic operations require an active network connection.
        </p>

        {/* Online Status Check */}
        {isOnline && (
          <div className="w-full mb-6 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2 border border-emerald-200/50 dark:border-emerald-900/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Connection restored! Click Retry to reload.
          </div>
        )}

        {/* Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleRetry}
            className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            Retry Connection
          </button>
          
          <a
            href="/"
            className="w-full py-3.5 px-6 rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 active:bg-slate-300 dark:active:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold text-sm flex items-center justify-center gap-2 border border-slate-200/40 dark:border-slate-700/30 transition-all duration-200 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
