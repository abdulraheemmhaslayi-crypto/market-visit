'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Camera,
  Calendar,
  User,
  MapPin,
  Store,
  Tag,
  X,
  ExternalLink,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  FileCheck,
} from 'lucide-react';
import ImageLightboxModal from '@/components/ui/ImageLightboxModal';

export interface DashboardPhoto {
  photoId: string;
  visitId: string;
  category: string;
  cloudinaryUrl: string;
  uploadedAt: string;
  supervisor: string;
  manager: string;
  outlet: string;
  route: string;
  channel: string;
}

interface PhotoGallerySectionProps {
  photos: DashboardPhoto[];
  fFrom?: string;
  fTo?: string;
  fMgr?: string;
  fSuper?: string;
  fChannel?: string;
  fCust?: string;
  fRoute?: string;
}

export function PhotoGallerySection({
  photos,
  fFrom,
  fTo,
  fMgr,
  fSuper,
  fChannel,
  fCust,
  fRoute,
}: PhotoGallerySectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8; // 8 uniform photos per page

  // Filter photos based on active dashboard filters
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      const pDate = new Date(p.uploadedAt);
      const from = fFrom ? new Date(`${fFrom}T00:00:00`) : null;
      const to = fTo ? new Date(`${fTo}T23:59:59`) : null;

      const fromOk = !from || pDate >= from;
      const toOk = !to || pDate <= to;
      const mgrOk = !fMgr || p.manager.toUpperCase() === fMgr.toUpperCase();
      const superOk = !fSuper || p.supervisor.toUpperCase() === fSuper.toUpperCase();
      const channelOk = !fChannel || p.channel === fChannel;
      const outletOk = !fCust || p.outlet.toLowerCase().includes(fCust.toLowerCase());
      const routeOk = !fRoute || (p.route && p.route.toUpperCase() === fRoute.toUpperCase());

      return fromOk && toOk && mgrOk && superOk && channelOk && outletOk && routeOk;
    });
  }, [photos, fFrom, fTo, fMgr, fSuper, fChannel, fCust, fRoute]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [fFrom, fTo, fMgr, fSuper, fChannel, fCust, fRoute]);

  const totalPages = Math.max(1, Math.ceil(filteredPhotos.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedPhotos = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredPhotos.slice(start, start + pageSize);
  }, [filteredPhotos, validPage, pageSize]);

  const paginationItems = useMemo<(number | 'ellipsis')[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (validPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
    }
    if (validPage >= totalPages - 3) {
      return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, 'ellipsis', validPage - 1, validPage, validPage + 1, 'ellipsis', totalPages];
  }, [validPage, totalPages]);

  const getCategoryColor = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('dairy')) return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
    if (cat.includes('beverage')) return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    if (cat.includes('ice')) return { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' };
    return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
  };

  return (
    <div className="card p-5 space-y-4 my-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-soft)]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent/10 text-accent">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Audit Photo Gallery
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time audit attachments captured during market visits ({filteredPhotos.length} total photo{filteredPhotos.length === 1 ? '' : 's'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-medium px-3 py-1.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]">
            {fFrom || fTo ? `Filtered: ${fFrom || 'Start'} to ${fTo || 'Today'}` : 'All Dates'}
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-muted)] space-y-2">
          <ImageIcon className="h-10 w-10 mx-auto opacity-40" />
          <p className="text-sm font-medium">No audit photos found matching the selected filters.</p>
          <p className="text-xs opacity-75">Try expanding your date range or clearing specific filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
            {paginatedPhotos.map((photo) => {
              const catStyle = getCategoryColor(photo.category);
              const dateObj = new Date(photo.uploadedAt);
              const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={photo.photoId}
                  onClick={() => {
                    const idx = filteredPhotos.findIndex((p) => p.photoId === photo.photoId);
                    setLightboxIndex(idx !== -1 ? idx : 0);
                  }}
                  className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col h-full"
                >
                  {/* Fixed-Height Uniform Image Frame */}
                  <div className="relative h-44 sm:h-48 w-full bg-slate-950 overflow-hidden flex-shrink-0">
                    <img
                      src={photo.cloudinaryUrl}
                      alt={photo.category}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Category Pill Overlay */}
                    <div
                      className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm z-10"
                      style={{
                        backgroundColor: catStyle.bg,
                        color: catStyle.text,
                        border: `1px solid ${catStyle.border}`,
                      }}
                    >
                      {photo.category || 'Attachment'}
                    </div>

                    {/* Image Spec Badge Overlay */}
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-black/75 text-white/90 backdrop-blur-sm border border-white/20 flex items-center gap-1 z-10">
                      <FileCheck className="h-3 w-3 text-emerald-400" /> Optimized HD (~350 KB)
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                      <span className="text-xs font-bold text-white px-3 py-1.5 rounded-xl bg-accent backdrop-blur-sm flex items-center gap-1.5 shadow-lg">
                        <Maximize2 className="h-3.5 w-3.5" /> Click to Expand
                      </span>
                    </div>
                  </div>

                  {/* Fixed/Uniform Footer Box */}
                  <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between bg-[var(--surface)]">
                    <div className="space-y-1">
                      <p className="text-xs font-extrabold text-[var(--text-primary)] truncate flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                        <span className="truncate" title={photo.outlet}>{photo.outlet}</span>
                      </p>
                      <p className="text-[11px] font-medium text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-[var(--text-muted)] flex-shrink-0" />
                        <span className="truncate">Sup: {photo.supervisor} ({photo.manager})</span>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-soft)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-1 truncate max-w-[50%]">
                        <MapPin className="h-3 w-3 flex-shrink-0" /> <span className="truncate">Route: {photo.route || 'N/A'}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono flex-shrink-0">
                        <Calendar className="h-3 w-3 text-accent" /> {formattedDate} {formattedTime}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-4 border-t border-[var(--border-soft)]">
              {/* Left Details */}
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>
                  Showing <strong className="text-[var(--text-primary)]">{(validPage - 1) * pageSize + 1}</strong> –{' '}
                  <strong className="text-[var(--text-primary)]">{Math.min(validPage * pageSize, filteredPhotos.length)}</strong> of{' '}
                  <strong className="text-[var(--text-primary)]">{filteredPhotos.length.toLocaleString()}</strong> photos
                </span>
                <span className="hidden sm:inline px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--border-soft)] font-mono text-[11px]">
                  Page {validPage} / {totalPages}
                </span>
              </div>

              {/* Center / Right Pagination Nav */}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {/* First Page */}
                <button
                  type="button"
                  title="First Page"
                  onClick={() => setCurrentPage(1)}
                  disabled={validPage === 1}
                  className="h-8 w-8 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>

                {/* Prev Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validPage === 1}
                  className="h-8 px-2.5 sm:px-3 text-xs font-bold rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Prev</span>
                </button>

                {/* Windowed Page Number Pills */}
                <div className="flex items-center gap-1">
                  {paginationItems.map((item, idx) => {
                    if (item === 'ellipsis') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-[var(--text-muted)] select-none">
                          …
                        </span>
                      );
                    }
                    const pNum = item as number;
                    const isActive = validPage === pNum;
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setCurrentPage(pNum)}
                        className={`h-8 min-w-[32px] px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          isActive
                            ? 'bg-accent text-white shadow-md shadow-accent/20 scale-105'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                </div>

                {/* Next Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validPage === totalPages}
                  className="h-8 px-2.5 sm:px-3 text-xs font-bold rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1"
                >
                  <span className="hidden sm:inline">Next</span> <ChevronRight className="h-3.5 w-3.5" />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  title="Last Page"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validPage === totalPages}
                  className="h-8 w-8 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>

                {/* Quick Page Jump for large datasets */}
                {totalPages > 7 && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] ml-1.5 pl-2 border-l border-[var(--border-soft)]">
                    <span className="hidden lg:inline text-[11px]">Go to:</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      defaultValue={validPage}
                      key={validPage}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value, 10);
                          if (!isNaN(val) && val >= 1 && val <= totalPages) {
                            setCurrentPage(val);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setCurrentPage(val);
                        }
                      }}
                      className="w-12 h-8 text-center text-xs font-bold rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lightbox Dialog Modal with Next/Prev Navigation */}
      <ImageLightboxModal
        photos={filteredPhotos}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
        title="Audit Photo Gallery"
      />
    </div>
  );
}
