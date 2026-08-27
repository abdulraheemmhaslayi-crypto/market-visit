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

export default function AuditPhotoGalleryPage() {
  // Today's date YYYY-MM-DD by default
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(12);

  const [photos, setPhotos] = useState<AuditPhoto[]>([]);
  const [applications, setApplications] = useState<string[]>([]);
  const [supervisors, setSupervisors] = useState<string[]>([]);
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
        if (selectedSupervisor && selectedSupervisor !== 'all') params.set('supervisor', selectedSupervisor);
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
          if (data.supervisors && Array.isArray(data.supervisors)) {
            setSupervisors(data.supervisors);
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
        console.error('Failed to load audit photos:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedDate, selectedApp, selectedSupervisor, selectedRoute, selectedOutlet, searchQuery, currentPage, pageSize]
  );

  useEffect(() => {
    fetchPhotos(false);
  }, [fetchPhotos]);

  const handleResetFilters = () => {
    setSelectedDate(getTodayStr());
    setSelectedApp('all');
    setSelectedSupervisor('all');
    setSelectedRoute('all');
    setSelectedOutlet('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleExportPhotos = () => {
    exportToExcel({
      filename: `photo_audits_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Photo Audits',
      title: 'Audit Photo Gallery Metadata Log',
      filterSummary: `Date: ${selectedDate || 'All'} | App: ${selectedApp} | Supervisor: ${selectedSupervisor} | Route: ${selectedRoute} | Outlet: ${selectedOutlet} | Search: "${searchQuery}"`,
      columns: [
        { header: 'Upload Date', key: 'uploadedAt', formatter: (val: any) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Photo ID', key: 'photoId' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Category / Asset', key: 'category' },
        { header: 'Manager', key: 'manager' },
        { header: 'Supervisor', key: 'supervisor' },
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

  const getAppBadgeStyle = (appName: string) => {
    const app = (appName || '').toLowerCase();
    if (app.includes('chrome'))
      return { bg: 'rgba(234, 67, 53, 0.15)', text: '#ea4335', border: 'rgba(234, 67, 53, 0.3)' };
    if (app.includes('edge'))
      return { bg: 'rgba(0, 120, 212, 0.15)', text: '#0078d4', border: 'rgba(0, 120, 212, 0.3)' };
    if (app.includes('code'))
      return { bg: 'rgba(0, 101, 203, 0.15)', text: '#0065cb', border: 'rgba(0, 101, 203, 0.3)' };
    return { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' };
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
              Audit Photo Gallery
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                Live DB Stream
              </span>
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Real-time audit attachments captured across field visits and applications.
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
          {(selectedDate || selectedApp !== 'all' || selectedSupervisor !== 'all' || selectedOutlet !== 'all' || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Date Selector (Default: Today) */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-accent" /> Date Filter
            </label>
            <div className="relative">
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
              className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors cursor-pointer"
            >
              <option value="all">All Applications</option>
              {applications.map((app) => (
                <option key={app} value={app}>
                  {app}
                </option>
              ))}
            </select>
          </div>

          {/* Supervisor Filter Slicer */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-accent" /> Supervisors
            </label>
            <select
              value={selectedSupervisor}
              onChange={(e) => {
                setSelectedSupervisor(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors cursor-pointer"
            >
              <option value="all">All Supervisors</option>
              {supervisors.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </div>

          {/* Route Code Filter Slicer */}
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
              className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors cursor-pointer"
            >
              <option value="all">All Routes ({routes.length})</option>
              {routes.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>

          {/* Outlet Name Filter Slicer */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5 text-accent" /> Outlet Name
            </label>
            <select
              value={selectedOutlet}
              onChange={(e) => {
                setSelectedOutlet(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors cursor-pointer"
            >
              <option value="all">All Outlets</option>
              {outlets.map((outlet) => (
                <option key={outlet} value={outlet}>
                  {outlet}
                </option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-accent" /> Search Keyword
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Outlet, Supervisor, Route..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-accent transition-colors pl-8"
              />
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            </div>
          </div>

          {/* Date Shortcut Pills */}
          <div className="space-y-1 flex flex-col justify-end">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedDate(getTodayStr());
                  setCurrentPage(1);
                }}
                className={`flex-1 text-[11px] font-semibold py-2 px-2.5 rounded-xl border transition-all cursor-pointer ${
                  selectedDate === getTodayStr()
                    ? 'bg-accent text-white border-accent'
                    : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border-soft)]'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  setSelectedDate('');
                  setCurrentPage(1);
                }}
                className={`flex-1 text-[11px] font-semibold py-2 px-2.5 rounded-xl border transition-all cursor-pointer ${
                  !selectedDate
                    ? 'bg-accent text-white border-accent'
                    : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border-soft)]'
                }`}
              >
                All Dates
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin text-accent" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Loading Audit Photos from Database...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-3 shadow-sm">
          <ImageIcon className="h-12 w-12 mx-auto text-[var(--text-muted)] opacity-50" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            No audit photos found matching the selected filters.
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
            {selectedDate
              ? `There are no photos recorded for ${selectedDate}${selectedApp !== 'all' ? ` in ${selectedApp}` : ''}. Try switching date or clearing filters.`
              : 'Try adjusting your application or search filters.'}
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-2 text-xs font-semibold px-4 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {photos.map((photo) => {
            const catStyle = getCategoryStyle(photo.category);
            const appStyle = getAppBadgeStyle(photo.appName);
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
                className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm hover:shadow-xl hover:border-accent/50 transition-all duration-300 cursor-pointer flex flex-col"
              >
                {/* Image Frame */}
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  <img
                    src={photo.cloudinaryUrl}
                    alt={photo.category}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* App Pill Overlay */}
                  <div
                    className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-md flex items-center gap-1"
                    style={{
                      backgroundColor: appStyle.bg,
                      color: appStyle.text,
                      border: `1px solid ${appStyle.border}`,
                    }}
                  >
                    <AppWindow className="h-3 w-3" />
                    {photo.appName}
                  </div>

                  {/* Category Pill Overlay */}
                  <div
                    className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-md"
                    style={{
                      backgroundColor: catStyle.bg,
                      color: catStyle.text,
                      border: `1px solid ${catStyle.border}`,
                    }}
                  >
                    {photo.category}
                  </div>

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-semibold text-white px-3.5 py-2 rounded-xl bg-black/70 backdrop-blur-sm flex items-center gap-2 border border-white/20">
                      <ExternalLink className="h-3.5 w-3.5" /> View Metadata
                    </span>
                  </div>
                </div>

                {/* Photo Details Footer */}
                <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate flex items-center gap-2">
                      <Store className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="truncate">{photo.outlet}</span>
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[var(--text-muted)] flex-shrink-0" />
                      <span>
                        User: <strong className="text-[var(--text-primary)]">{photo.supervisor}</strong> ({photo.manager})
                      </span>
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[var(--border-soft)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Route: {photo.route || 'N/A'}
                    </span>
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
          <p className="text-xs text-[var(--text-muted)]">
            Showing Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalCount} total photos)
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--border-soft)] transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>

            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage === pagination.totalPages}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--border-soft)] transition-colors cursor-pointer"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Metadata Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedPhoto(null)}
          />

          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-slide-up flex flex-col md:flex-row max-h-[90vh]">
            {/* Image Box */}
            <div className="flex-1 bg-black flex items-center justify-center p-4 min-h-[300px] max-h-[60vh] md:max-h-[90vh]">
              <img
                src={selectedPhoto.cloudinaryUrl}
                alt={selectedPhoto.category}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* Detailed Sidebar Metadata Panel */}
            <div className="w-full md:w-80 p-6 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col justify-between space-y-6 text-white">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    {selectedPhoto.category || 'Audit Photo'}
                  </span>
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Application</label>
                    <p className="text-sm font-semibold text-sky-400 flex items-center gap-1.5 mt-0.5">
                      <AppWindow className="h-4 w-4" /> {selectedPhoto.appName}
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Outlet Name</label>
                    <p className="text-sm font-semibold text-white mt-0.5">{selectedPhoto.outlet}</p>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Supervisor & Manager</label>
                    <p className="text-xs font-medium text-slate-300 mt-0.5">
                      {selectedPhoto.supervisor} <span className="text-slate-500">({selectedPhoto.manager})</span>
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Route & Channel</label>
                    <p className="text-xs font-medium text-slate-300 mt-0.5">
                      {selectedPhoto.route || 'N/A'} • {selectedPhoto.channel}
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Captured At</label>
                    <p className="text-xs font-mono text-slate-300 mt-0.5">
                      {new Date(selectedPhoto.uploadedAt).toLocaleString('en-US')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Visit ID: #{selectedPhoto.visitId.slice(-6)}</span>
                <a
                  href={selectedPhoto.cloudinaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1"
                >
                  Open Original <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
