'use client';

import React, { useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  MapPin,
  User,
  AppWindow,
  FileCheck,
  Maximize2,
} from 'lucide-react';

export interface LightboxItem {
  photoId?: string;
  url?: string;
  cloudinaryUrl?: string;
  category?: string;
  outlet?: string;
  supervisor?: string;
  manager?: string;
  route?: string;
  channel?: string;
  uploadedAt?: string;
  visitId?: string;
  appName?: string;
  [key: string]: any;
}

export interface ImageLightboxModalProps {
  photos: LightboxItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  title?: string;
}

export default function ImageLightboxModal({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  title,
}: ImageLightboxModalProps) {
  const total = photos.length;
  const current = photos[currentIndex] || null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(currentIndex - 1);
    }
  }, [hasPrev, currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNavigate(currentIndex + 1);
    }
  }, [hasNext, currentIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Touch swipe support for mobile
  useEffect(() => {
    if (!isOpen) return;
    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          // Swiped left -> Next
          handleNext();
        } else {
          // Swiped right -> Prev
          handlePrev();
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, handlePrev, handleNext]);

  if (!isOpen || !current || total === 0) return null;

  const imageUrl = current.cloudinaryUrl || current.url || '';
  const categoryName = current.category || 'Audit Photo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Dark Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Lightbox Dialog Container */}
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col md:flex-row max-h-[92vh] text-white">
        {/* Left Side: Image Container with Overlay Navigation */}
        <div className="flex-1 bg-black/95 relative flex items-center justify-center min-h-[300px] max-h-[55vh] md:max-h-[88vh] select-none overflow-hidden group">
          {/* Main Image */}
          <img
            key={imageUrl}
            src={imageUrl}
            alt={categoryName}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95"
          />

          {/* Top Overlay Badge & Counter (Mobile & Desktop) */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-black/60 text-sky-400 border border-sky-500/30 backdrop-blur-md shadow-md">
              {categoryName}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-black/60 text-slate-200 border border-slate-700 backdrop-blur-md shadow-md">
              {currentIndex + 1} / {total}
            </span>
          </div>

          {/* Previous Button (Floating Overlay) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            disabled={!hasPrev}
            aria-label="Previous Image"
            className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full backdrop-blur-md shadow-xl transition-all duration-200 cursor-pointer ${
              hasPrev
                ? 'bg-black/60 hover:bg-sky-600/80 text-white border border-white/20 hover:scale-110'
                : 'bg-black/20 text-white/20 border border-white/5 cursor-not-allowed opacity-30'
            }`}
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Next Button (Floating Overlay) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            disabled={!hasNext}
            aria-label="Next Image"
            className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full backdrop-blur-md shadow-xl transition-all duration-200 cursor-pointer ${
              hasNext
                ? 'bg-black/60 hover:bg-sky-600/80 text-white border border-white/20 hover:scale-110'
                : 'bg-black/20 text-white/20 border border-white/5 cursor-not-allowed opacity-30'
            }`}
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Bottom Bar: Mini Navigation Controls */}
          <div className="absolute bottom-3 inset-x-0 z-20 flex items-center justify-center gap-4 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 backdrop-blur-md shadow-lg pointer-events-auto">
              <button
                onClick={handlePrev}
                disabled={!hasPrev}
                className="text-xs font-semibold px-2 py-0.5 rounded text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                {currentIndex + 1} of {total}
              </span>
              <button
                onClick={handleNext}
                disabled={!hasNext}
                className="text-xs font-semibold px-2 py-0.5 rounded text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Metadata & Information Panel */}
        <div className="w-full md:w-80 p-5 sm:p-6 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col justify-between space-y-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Header with Title and Close Button */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  {title || 'Image Details'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Attachment {currentIndex + 1} of {total}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Metadata Fields */}
            <div className="space-y-3 text-xs">
              {current.appName && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Application
                  </label>
                  <p className="text-xs font-semibold text-sky-400 flex items-center gap-1.5 mt-0.5">
                    <AppWindow className="h-3.5 w-3.5" /> {current.appName}
                  </p>
                </div>
              )}

              {current.outlet && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Outlet / Store
                  </label>
                  <p className="text-sm font-semibold text-slate-100 mt-0.5">
                    {current.outlet}
                  </p>
                </div>
              )}

              {(current.supervisor || current.manager) && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Supervisor / Manager
                  </label>
                  <p className="text-xs font-medium text-slate-200 mt-0.5">
                    {current.supervisor || 'N/A'}{' '}
                    {current.manager && (
                      <span className="text-slate-400">({current.manager})</span>
                    )}
                  </p>
                </div>
              )}

              {(current.route || current.channel) && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Route
                    </label>
                    <p className="text-xs font-mono font-medium text-slate-300 mt-0.5">
                      {current.route || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Channel
                    </label>
                    <p className="text-xs font-medium text-slate-300 mt-0.5">
                      {current.channel || 'GT'}
                    </p>
                  </div>
                </div>
              )}

              {current.uploadedAt && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Date & Time
                  </label>
                  <p className="text-xs font-mono text-slate-300 mt-0.5">
                    {new Date(current.uploadedAt).toLocaleString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}

              {current.visitId && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Visit Reference
                  </label>
                  <p className="text-[11px] font-mono text-slate-400 break-all mt-0.5">
                    {current.visitId}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={handlePrev}
                disabled={!hasPrev}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button
                onClick={handleNext}
                disabled={!hasNext}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-sky-400 text-xs font-semibold transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Full Image
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
