"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const isProduction = process.env.NODE_ENV === "production";
    if (!isProduction || isLocalhost) {
      console.warn("Skipping service worker registration in development/local environment.");
      return;
    }

    // 1. Listen for new service worker taking control and reload the page
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // 2. Register the service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered with scope:", registration.scope);
        registration.update();
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });

      // 3. Listen for browser install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        // Prevent default mini-infobar from showing on mobile
        e.preventDefault();
        // Save the event so it can be triggered later
        setDeferredPrompt(e);
        // Show our custom banner
        setShowBanner(true);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      // 4. Hide banner if already installed
      const handleAppInstalled = () => {
        console.log("PWA was installed");
        setDeferredPrompt(null);
        setShowBanner(false);
      };
      
      window.addEventListener("appinstalled", handleAppInstalled);

    // 5. Catch ChunkLoadError globally on stale client bundles after new deployment
    const handleGlobalError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const reason = 'reason' in event ? event.reason : event.error;
      const message = reason?.message || reason?.toString() || '';
      if (
        message.includes('Loading chunk') ||
        message.includes('ChunkLoadError') ||
        message.includes('dynamically imported module')
      ) {
        console.warn('Chunk load error detected. Reloading page for updated deployment assets...');
        const reloadKey = 'global_chunk_reload_' + Date.now();
        const lastReload = sessionStorage.getItem('last_chunk_reload');
        // Prevent infinite loops if network is down
        if (!lastReload || Date.now() - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem('last_chunk_reload', Date.now().toString());
          window.location.reload();
        }
      }
    };

    window.addEventListener('unhandledrejection', handleGlobalError);
    window.addEventListener('error', handleGlobalError);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener('unhandledrejection', handleGlobalError);
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the browser install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, clear it
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleCloseClick = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-md w-auto z-50 transition-all duration-500 ease-out transform translate-y-0 animate-bounce-subtle">
      <div className="relative p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 shadow-2xl flex items-start gap-4 transition-all duration-300">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Brand Icon Container */}
        <div className="w-12 h-12 rounded-xl bg-indigo-650 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-600/20">
          <Download className="w-6 h-6 animate-bounce" />
        </div>

        {/* Content Details */}
        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 leading-snug">
            Install Supervisor App
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3.5 leading-relaxed">
            Install for offline access, instant notifications, and a full-screen standalone audit experience.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleInstallClick}
              className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs transition-all duration-200 cursor-pointer shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              Install Now
            </button>
            <button
              onClick={handleCloseClick}
              className="py-2 px-3.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-400 font-semibold text-xs transition-all duration-200 cursor-pointer border border-slate-200/40 dark:border-slate-750/30"
            >
              Later
            </button>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleCloseClick}
          className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Custom micro-animations */}
      <style jsx global>{`
        @keyframes bounceSubtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounceSubtle 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
