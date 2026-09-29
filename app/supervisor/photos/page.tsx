'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  Calendar,
  User,
  MapPin,
  Store,
  ExternalLink,
  Image as ImageIcon,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AppWindow,
  CheckCircle2,
  SlidersHorizontal,
  FileCheck,
  Maximize2,
  Flag,
  AlertTriangle,
  Clock,
  Eye,
  X,
} from 'lucide-react';
import ImageLightboxModal from '@/components/ui/ImageLightboxModal';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';
import { AuditActionItem } from '@/lib/audit-actions';

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
  outletCode?: string;
  route: string;
  channel: string;
}

export default function SupervisorAuditPhotoGalleryPage() {
  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(12);

  // GM / Admin Action Tracking State
  const [actionItemsMap, setActionItemsMap] = useState<Record<string, AuditActionItem>>({});
  const [actionFilter, setActionFilter] = useState<'all' | 'PENDING'>('all');
  const [isActionDrawerOpen, setIsActionDrawerOpen] = useState<boolean>(false);

  const [photos, setPhotos] = useState<AuditPhoto[]>([]);
  const [applications, setApplications] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [outlets, setOutlets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  // Fetch GM / Admin Action Directives
  const fetchActionItems = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audit-actions');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        const map: Record<string, AuditActionItem> = {};
        data.items.forEach((item: AuditActionItem) => {
          map[item.photoId] = item;
        });
        setActionItemsMap(map);
      }
    } catch (err) {
      console.error('Failed to load supervisor audit action items:', err);
    }
  }, []);

  useEffect(() => {
    fetchPhotos(false);
    fetchActionItems();
  }, [fetchPhotos, fetchActionItems]);

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
        { header: 'Date', key: 'uploadedAt', formatter: (val: any) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Channel', key: 'channel', formatter: (val: any) => val || 'GT' },
        { header: 'Route Code', key: 'route', formatter: (val: any) => val || '—' },
        { header: 'Outlet Name', key: 'outlet', formatter: (val: any) => val || '—' },
        { header: 'Category / Asset', key: 'category' },
        { header: 'Application', key: 'appName' },
        { header: 'Image URL', key: 'cloudinaryUrl' },
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

  const pendingActionItems = useMemo(
    () => Object.values(actionItemsMap).filter((a) => a.actionStatus === 'PENDING'),
    [actionItemsMap]
  );
  const pendingActionCount = pendingActionItems.length;

  const displayedPhotos = useMemo(() => {
    if (actionFilter !== 'PENDING') return photos;
    return pendingActionItems.map((item) => {
      const existing = photos.find((p) => p.photoId === item.photoId);
      if (existing) return existing;
      const syntheticPhoto: AuditPhoto = {
        photoId: item.photoId,
        visitId: item.visitId || 'VISIT-REF',
        category: (item.category as any) || 'Audit Photo',
        cloudinaryUrl: item.originalPhotoUrl,
        publicId: item.photoId,
        uploadedAt: item.createdAt || new Date().toISOString(),
        appName: 'Field Audit',
        outlet: item.outlet,
        outletCode: item.outletCode || '',
        route: item.route,
        supervisor: item.supervisor || 'Field Supervisor',
        manager: item.manager || '',
        channel: item.channel || 'GT',
      };
      return syntheticPhoto;
    });
  }, [actionFilter, photos, pendingActionItems]);

  const handleInspectAction = (item: AuditActionItem) => {
    setIsActionDrawerOpen(false);
    const existingIdx = displayedPhotos.findIndex((p) => p.photoId === item.photoId);
    if (existingIdx !== -1) {
      setLightboxIndex(existingIdx);
    } else {
      const syntheticPhoto: AuditPhoto = {
        photoId: item.photoId,
        visitId: item.visitId || 'VISIT-REF',
        category: item.category || 'Audit Photo',
        cloudinaryUrl: item.originalPhotoUrl,
        publicId: item.photoId,
        uploadedAt: item.createdAt || new Date().toISOString(),
        appName: 'Field Audit',
        outlet: item.outlet,
        outletCode: item.outletCode || '',
        route: item.route,
        supervisor: item.supervisor || 'Field Supervisor',
        manager: item.manager || '',
        channel: item.channel || 'GT',
      };
      setPhotos((prev) => [syntheticPhoto, ...prev.filter((p) => p.photoId !== item.photoId)]);
      setLightboxIndex(0);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-white dark:bg-slate-800 p-1 flex items-center justify-center shadow-xs border border-[var(--border)] flex-shrink-0">
            <img src="/images/dandy-logo.png" alt="Dandy Logo" className="h-full w-auto object-contain" />
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

      {/* Management Action Directives Alert Banner for Supervisor */}
      {pendingActionCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-200 flex items-center gap-2">
                Management Directives Awaiting Corrective Action ({pendingActionCount})
              </h4>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                Admin or Sub-Admin has flagged {pendingActionCount} audit {pendingActionCount === 1 ? 'photo' : 'photos'} for action. Click flagged photos to review directives and submit resolution proof.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setIsActionDrawerOpen(true)}
              className="text-xs font-extrabold px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black border border-amber-400 shadow-md transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <Eye className="h-3.5 w-3.5" /> Review Directives ({pendingActionCount})
            </button>
            <button
              type="button"
              onClick={() => setActionFilter(actionFilter === 'PENDING' ? 'all' : 'PENDING')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                actionFilter === 'PENDING'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md font-extrabold'
                  : 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30'
              }`}
            >
              {actionFilter === 'PENDING' ? 'Show All Photos' : 'Filter Directives'}
            </button>
          </div>
        </div>
      )}

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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
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
          {displayedPhotos.map((photo) => {
            const catStyle = getCategoryStyle(photo.category);
            const actionItem = actionItemsMap[photo.photoId];
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
                onClick={() => {
                  const idx = displayedPhotos.findIndex((p) => p.photoId === photo.photoId);
                  setLightboxIndex(idx !== -1 ? idx : 0);
                }}
                className={`group relative rounded-xl border bg-[var(--surface)] overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col ${
                  actionItem?.actionStatus === 'PENDING'
                    ? 'border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'border-[var(--border)]'
                }`}
              >
                {/* Image Frame */}
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  <img
                    src={photo.cloudinaryUrl}
                    alt={photo.category}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Management Directive Badge Overlay */}
                  {actionItem && (
                    <div
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9.5px] font-bold shadow-md flex items-center gap-1 z-10 ${
                        actionItem.actionStatus === 'RESOLVED'
                          ? 'bg-emerald-500 text-white'
                          : actionItem.actionStatus === 'SUBMITTED'
                          ? 'bg-sky-500 text-white'
                          : 'bg-amber-500 text-black animate-pulse'
                      }`}
                    >
                      <Flag className="h-3 w-3" />
                      {actionItem.actionStatus === 'RESOLVED'
                        ? 'Resolved'
                        : actionItem.actionStatus === 'SUBMITTED'
                        ? 'Proof Sent'
                        : 'Action Required'}
                    </div>
                  )}

                  {/* Image Spec Badge Overlay */}
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-black/70 text-white/90 backdrop-blur-sm border border-white/20 flex items-center gap-1">
                    <FileCheck className="h-3 w-3 text-emerald-400" /> Optimized HD (~350 KB)
                  </div>

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-bold text-white px-3 py-1.5 rounded-xl bg-accent backdrop-blur-sm flex items-center gap-1.5 shadow-lg">
                      <Maximize2 className="h-3.5 w-3.5" /> Click to Expand & Review
                    </span>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                      <span className="truncate">
                        {photo.outletCode ? <span className="font-mono text-sky-400 font-bold mr-1">[{photo.outletCode}]</span> : null}
                        {photo.outlet}
                      </span>
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[var(--text-muted)] flex-shrink-0" />
                      <span>Route: {photo.route || 'N/A'} ({photo.channel})</span>
                    </p>
                  </div>

                  {/* GM Directive Remark Banner */}
                  {actionItem && actionItem.gmComment && (
                    <div className="mt-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] space-y-0.5">
                      <p className="font-bold text-amber-400 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                        <AlertTriangle className="h-3 w-3" /> Management Directive:
                      </p>
                      <p className="text-[11px] text-amber-200 italic line-clamp-2">
                        "{actionItem.gmComment}"
                      </p>
                    </div>
                  )}

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
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--border-soft)]">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>
              Showing <strong className="text-[var(--text-primary)]">{(pagination.currentPage - 1) * pagination.limit + 1}</strong> –{' '}
              <strong className="text-[var(--text-primary)]">{Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}</strong> of{' '}
              <strong className="text-[var(--text-primary)]">{pagination.totalCount.toLocaleString()}</strong> photos
            </span>
            <span className="hidden sm:inline px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--border-soft)] font-mono text-[11px]">
              Page {pagination.currentPage} / {pagination.totalPages}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              title="First Page"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="h-8 w-8 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--border-soft)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>

            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 text-xs font-semibold rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--border-soft)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Smart Windowed Page Pills */}
            <div className="flex items-center gap-1">
              {((): (number | 'ellipsis')[] => {
                const total = pagination.totalPages;
                const cur = pagination.currentPage;
                if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
                if (cur <= 4) return [1, 2, 3, 4, 5, 'ellipsis', total];
                if (cur >= total - 3) return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
                return [1, 'ellipsis', cur - 1, cur, cur + 1, 'ellipsis', total];
              })().map((item, idx) => {
                if (item === 'ellipsis') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-[var(--text-muted)] select-none">
                      …
                    </span>
                  );
                }
                const pNum = item as number;
                const isActive = pagination.currentPage === pNum;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setCurrentPage(pNum)}
                    className={`h-8 min-w-[32px] px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-accent text-white shadow-md shadow-accent/20 scale-105'
                        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--border-soft)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage >= pagination.totalPages}
              className="h-8 px-3 text-xs font-semibold rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--border-soft)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="hidden sm:inline">Next</span> <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <button
              title="Last Page"
              onClick={() => setCurrentPage(pagination.totalPages)}
              disabled={currentPage >= pagination.totalPages}
              className="h-8 w-8 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--border-soft)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Management Action Directives Drawer for Supervisor */}
      {isActionDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsActionDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                      <Flag className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[var(--text-primary)]">
                        Action Directives
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        Assigned corrective actions awaiting resolution
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActionDrawerOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {Object.values(actionItemsMap).length === 0 ? (
                    <div className="py-12 text-center text-[var(--text-muted)] space-y-2">
                      <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 opacity-60" />
                      <p className="text-sm font-semibold">No action directives</p>
                      <p className="text-xs opacity-75">All audit photos are in good standing.</p>
                    </div>
                  ) : (
                    Object.values(actionItemsMap).map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border space-y-3 transition-all ${
                          item.actionStatus === 'PENDING'
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : item.actionStatus === 'SUBMITTED'
                            ? 'bg-sky-500/5 border-sky-500/30'
                            : 'bg-emerald-500/5 border-emerald-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                item.priority === 'Urgent'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-slate-700/50 text-slate-300'
                              }`}
                            >
                              {item.priority} Priority
                            </span>
                            <h4 className="text-xs font-bold text-[var(--text-primary)] mt-1.5">
                              {item.outlet}
                            </h4>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              Route: {item.route || 'N/A'} • {item.category}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.actionStatus === 'RESOLVED'
                                ? 'bg-emerald-500 text-white'
                                : item.actionStatus === 'SUBMITTED'
                                ? 'bg-sky-500 text-white'
                                : 'bg-amber-500 text-black font-extrabold animate-pulse'
                            }`}
                          >
                            {item.actionStatus === 'RESOLVED'
                              ? 'Verified'
                              : item.actionStatus === 'SUBMITTED'
                              ? 'Submitted'
                              : 'Pending Action'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            Directive from {item.gmName}:
                          </p>
                          <p className="text-[var(--text-primary)] italic">"{item.gmComment}"</p>
                        </div>

                        {item.proofPhotoUrl && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                            <img
                              src={item.proofPhotoUrl}
                              alt="Proof Thumbnail"
                              className="h-10 w-14 object-cover rounded"
                            />
                            <div className="text-[10px] truncate">
                              <p className="font-bold text-emerald-400">Resolution Proof Attached</p>
                              <p className="text-slate-300 truncate">"{item.supervisorComment}"</p>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleInspectAction(item)}
                          className="w-full py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm font-semibold"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          {item.actionStatus === 'PENDING' ? 'Take Corrective Action & Submit Proof' : 'View Corrective Action'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Dialog Modal with Next/Prev Navigation */}
      <ImageLightboxModal
        photos={displayedPhotos}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
        title="Supervisor Audit Photo Gallery"
        userRole="Supervisor"
        actionItems={actionItemsMap}
        onActionUpdated={() => {
          fetchActionItems();
          fetchPhotos(true);
        }}
      />
    </div>
  );
}
