'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Calendar,
  User,
  MapPin,
  Store,
  X,
  ExternalLink,
  Image as ImageIcon,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AppWindow,
  CheckCircle2,
  SlidersHorizontal,
  FileCheck,
  Maximize2,
} from 'lucide-react';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';

export interface AuditPhoto {
  photoId: string;
  visitId: string;
  category: string;
  cloudinaryUrl: string;
  publicId: string;
  uploadedAt: string;
  appName: string;
  supervisor: string;
  manager: string;
  outlet: string;
  route: string;
  channel: string;
}

export default function SupervisorAuditPhotoGalleryPage() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(12);

  const [photos, setPhotos] = useState<AuditPhoto[]>([]);
  const [applications, setApplications] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [outlets, setOutlets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedPhoto, setSelectedPhoto] = useState<AuditPhoto | null>(null);

  const [pagination, setPagination] = useState({
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 12,
  });

  const fetchPhotos = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const params = new URLSearchParams();
        if (selectedDate) params.set('date', selectedDate);
        else params.set('date', 'all');

        if (selectedApp && selectedApp !== 'all') params.set('appName', selectedApp);
        if (selectedRoute && selectedRoute !== 'all') params.set('routeCode', selectedRoute);
        if (selectedOutlet && selectedOutlet !== 'all') params.set('outlet', selectedOutlet);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        params.set('page', currentPage.toString());
        params.set('limit', pageSize.toString());

        const res = await fetch(`/api/photos?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setPhotos(data.photos || []);
          if (data.applications && Array.isArray(data.applications)) {
            setApplications(data.applications);
          }
          if (data.routes && Array.isArray(data.routes)) {
            setRoutes(data.routes);
          }
          if (data.outlets && Array.isArray(data.outlets)) {
            setOutlets(data.outlets);
          }
          if (data.pagination) {
            setPagination(data.pagination);
          }
        }
      } catch (err) {
        console.error('Failed to load supervisor audit photos:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedDate, selectedApp, selectedRoute, selectedOutlet, searchQuery, currentPage, pageSize]
  );

  useEffect(() => {
    fetchPhotos(false);
  }, [fetchPhotos]);

  const handleResetFilters = () => {
    setSelectedDate(getTodayStr());
    setSelectedApp('all');
    setSelectedRoute('all');
    setSelectedOutlet('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleExportPhotos = () => {
    exportToExcel({
      filename: `my_audit_photos_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Audit Photos',
      title: 'My Audit Photo Gallery Log',
      filterSummary: `Date: ${selectedDate || 'All'} | App: ${selectedApp} | Route: ${selectedRoute} | Outlet: ${selectedOutlet} | Search: "${searchQuery}"`,
      columns: [
        { header: 'Upload Date', key: 'uploadedAt', formatter: (val: any) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Photo ID', key: 'photoId' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Category / Asset', key: 'category' },
        { header: 'Outlet', key: 'outlet' },
        { header: 'Route', key: 'route' },
        { header: 'Channel', key: 'channel' },
        { header: 'Application', key: 'appName' },
        { header: 'Cloudinary Image URL', key: 'cloudinaryUrl' },
      ],
      data: photos,
    });
  };

  const getCategoryStyle = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('dairy'))
      return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
    if (cat.includes('beverage'))
      return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    if (cat.includes('ice'))
      return { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' };
    return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-accent/10 text-accent">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              My Audit Photo Gallery
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                Personal Stream
              </span>
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Audit attachments captured during your personal market visits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <ExportButton onClick={handleExportPhotos} label="Export Log" variant="outline" />
          <button
            onClick={() => fetchPhotos(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] border border-[var(--border)] transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <div className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{pagination.totalCount} Photo{pagination.totalCount === 1 ? '' : 's'} Found</span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-soft)]">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <SlidersHorizontal className="h-4 w-4 text-accent" />
            Filter Gallery
          </div>
          {(selectedDate || selectedApp !== 'all' || selectedOutlet !== 'all' || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Date Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-accent" /> Date Filter
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Dynamic Application Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <AppWindow className="h-3.5 w-3.5 text-accent" /> Application
            </label>
            <select
              value={selectedApp}
              onChange={(e) => {
                setSelectedApp(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors"
            >
              <option value="all">All Applications</option>
              {applications.map((app) => (
                <option key={app} value={app}>
                  {app}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Route Code Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-accent" /> Route Code
            </label>
            <select
              value={selectedRoute}
              onChange={(e) => {
                setSelectedRoute(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors"
            >
              <option value="all">All Routes ({routes.length})</option>
              {routes.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Outlet Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5 text-accent" /> Outlet / Store
            </label>
            <select
              value={selectedOutlet}
              onChange={(e) => {
                setSelectedOutlet(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors"
            >
              <option value="all">All Outlets ({outlets.length})</option>
              {outlets.map((outlet) => (
                <option key={outlet} value={outlet}>
                  {outlet}
                </option>
              ))}
            </select>
          </div>

          {/* Text Search Box */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-accent" /> Search Text
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                placeholder="Search outlet, route..."
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors"
              />
              <Search className="h-3.5 w-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Photo Grid */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 card">
          <RefreshCw className="h-8 w-8 text-accent animate-spin mx-auto" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Loading Your Audit Photos...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="py-20 text-center space-y-3 card">
          <ImageIcon className="h-12 w-12 text-[var(--text-muted)] mx-auto opacity-40" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">No Audit Photos Found</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
            {selectedDate
              ? `There are no photos recorded for ${selectedDate}. Try selecting "All Dates" or clearing filters.`
              : 'You have not submitted any audit photos yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {photos.map((photo) => {
            const catStyle = getCategoryStyle(photo.category);
            const dateObj = new Date(photo.uploadedAt);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const formattedTime = dateObj.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={photo.photoId}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col"
              >
                {/* Image Frame */}
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  <img
                    src={photo.cloudinaryUrl}
                    alt={photo.category}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Category Pill Overlay */}
                  <div
                    className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm"
                    style={{
                      backgroundColor: catStyle.bg,
                      color: catStyle.text,
                      border: `1px solid ${catStyle.border}`,
                    }}
                  >
                    {photo.category || 'Attachment'}
                  </div>

                  {/* Image Spec Badge Overlay */}
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-black/70 text-white/90 backdrop-blur-sm border border-white/20 flex items-center gap-1">
                    <FileCheck className="h-3 w-3 text-emerald-400" /> Optimized HD (~350 KB)
                  </div>

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-bold text-white px-3 py-1.5 rounded-xl bg-accent backdrop-blur-sm flex items-center gap-1.5 shadow-lg">
                      <Maximize2 className="h-3.5 w-3.5" /> Click to Expand
                    </span>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                      <span className="truncate">{photo.outlet}</span>
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[var(--text-muted)] flex-shrink-0" />
                      <span>Route: {photo.route || 'N/A'} ({photo.channel})</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-soft)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="h-3 w-3 text-accent" /> {formattedDate} {formattedTime}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--border-soft)]">
          <p className="text-xs text-[var(--text-muted)]">
            Showing Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalCount} total photos)
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--border-soft)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  onClick={() => setCurrentPage(pNum)}
                  className={`h-8 w-8 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    currentPage === pNum
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {pNum}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage >= pagination.totalPages}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--border-soft)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Dialog Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedPhoto(null)}
          />

          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-slide-up flex flex-col md:flex-row max-h-[90vh]">
            <div className="flex-1 bg-black flex items-center justify-center p-4 min-h-[300px] max-h-[60vh] md:max-h-[90vh]">
              <img
                src={selectedPhoto.cloudinaryUrl}
                alt={selectedPhoto.category}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>

            <div className="w-full md:w-80 p-6 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    {selectedPhoto.category || 'Audit Photo'}
                  </span>
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Outlet Name</label>
                    <p className="text-sm font-semibold text-slate-100">{selectedPhoto.outlet}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Route</label>
                      <p className="text-xs font-mono font-medium text-slate-300">{selectedPhoto.route || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Channel</label>
                      <p className="text-xs font-medium text-slate-300">{selectedPhoto.channel || 'GT'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Date & Time</label>
                    <p className="text-xs font-mono text-slate-300">
                      {new Date(selectedPhoto.uploadedAt).toLocaleString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Visit Ref ID</label>
                    <p className="text-[11px] font-mono text-slate-400 break-all">{selectedPhoto.visitId}</p>
                  </div>
                </div>
              </div>

              <a
                href={selectedPhoto.cloudinaryUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary w-full justify-center py-2.5 text-xs"
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Open Full HD Image
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
