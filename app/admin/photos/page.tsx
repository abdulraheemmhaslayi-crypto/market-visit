'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  Calendar,
  Layers,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  Tag,
  AppWindow,
  Download,
  Store,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Search,
  Filter,
  Flag,
  AlertTriangle,
  Upload,
  Check,
  Sparkles,
  Clock,
  Eye,
  RotateCcw,
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

export default function AuditPhotoGalleryPage() {
  // Today's date YYYY-MM-DD by default
  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(12);

  // GM Action Tracking State
  const [actionItemsMap, setActionItemsMap] = useState<Record<string, AuditActionItem>>({});
  const [actionFilter, setActionFilter] = useState<'all' | 'PENDING' | 'SUBMITTED' | 'RESOLVED'>('all');
  const [isActionDrawerOpen, setIsActionDrawerOpen] = useState<boolean>(false);

  const [photos, setPhotos] = useState<AuditPhoto[]>([]);
  const [applications, setApplications] = useState<string[]>([]);
  const [supervisors, setSupervisors] = useState<string[]>([]);
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

  // Fetch GM Action Items
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
      console.error('Failed to load audit action items:', err);
    }
  }, []);

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
    fetchActionItems();
  }, [fetchPhotos, fetchActionItems]);

  const handleResetFilters = () => {
    setSelectedDate(getTodayStr());
    setSelectedApp('all');
    setSelectedSupervisor('all');
    setSelectedRoute('all');
    setSelectedOutlet('all');
    setSearchQuery('');
    setActionFilter('all');
    setCurrentPage(1);
  };

  const handleExportPhotos = () => {
    exportToExcel({
      filename: `photo_audits_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Photo Audits',
      title: 'Audit Photo Gallery Metadata Log',
      filterSummary: `Date: ${selectedDate || 'All'} | App: ${selectedApp} | Supervisor: ${selectedSupervisor} | Route: ${selectedRoute} | Outlet: ${selectedOutlet} | Search: "${searchQuery}"`,
      columns: [
        { header: 'Date', key: 'uploadedAt', formatter: (val: any) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Channel', key: 'channel', formatter: (val: any) => val || 'GT' },
        { header: 'Manager', key: 'manager', formatter: (val: any) => val || '—' },
        { header: 'Supervisor', key: 'supervisor', formatter: (val: any) => val || '—' },
        { header: 'Route Code', key: 'route', formatter: (val: any) => val || '—' },
        { header: 'Outlet Name', key: 'outlet', formatter: (val: any) => val || '—' },
        { header: 'Category / Asset', key: 'category' },
        { header: 'Application', key: 'appName' },
        { header: 'Action Status', key: 'photoId', formatter: (val: any) => actionItemsMap[val]?.actionStatus || 'None' },
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

  // Action Items KPI Calculations filtered by active dropdown selections
  const filteredActionItems = useMemo(() => {
    return Object.values(actionItemsMap).filter((item) => {
      if (selectedSupervisor !== 'all' && (item.supervisor || '').toLowerCase() !== selectedSupervisor.toLowerCase()) {
        return false;
      }
      if (selectedRoute !== 'all' && (item.route || '').toLowerCase() !== selectedRoute.toLowerCase()) {
        return false;
      }
      if (selectedOutlet !== 'all' && (item.outlet || '').toLowerCase() !== selectedOutlet.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          (item.outlet || '').toLowerCase().includes(q) ||
          (item.supervisor || '').toLowerCase().includes(q) ||
          (item.manager || '').toLowerCase().includes(q) ||
          (item.route || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [actionItemsMap, selectedSupervisor, selectedRoute, selectedOutlet, searchQuery]);

  const pendingActionItems = useMemo(
    () => filteredActionItems.filter((a) => a.actionStatus === 'PENDING'),
    [filteredActionItems]
  );
  const submittedActionItems = useMemo(
    () => filteredActionItems.filter((a) => a.actionStatus === 'SUBMITTED'),
    [filteredActionItems]
  );
  const resolvedActionItems = useMemo(
    () => filteredActionItems.filter((a) => a.actionStatus === 'RESOLVED'),
    [filteredActionItems]
  );

  const pendingCount = pendingActionItems.length;
  const submittedCount = submittedActionItems.length;
  const resolvedCount = resolvedActionItems.length;

  // Accurately display photos matching the selected GM action status
  const displayedPhotos = useMemo(() => {
    if (actionFilter === 'all') return photos;

    const targetActionItems =
      actionFilter === 'PENDING'
        ? pendingActionItems
        : actionFilter === 'SUBMITTED'
        ? submittedActionItems
        : resolvedActionItems;

    return targetActionItems.map((item) => {
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
  }, [actionFilter, photos, pendingActionItems, submittedActionItems, resolvedActionItems]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-800 p-2 flex items-center justify-center shadow-md border border-slate-200/80 dark:border-slate-700/80 flex-shrink-0">
            <img src="/images/dandy-logo.png" alt="Dandy Logo" className="h-full w-auto object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Audit Photo Gallery
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live DB Stream
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Review field audit photos, assign GM corrective directives, and verify supervisor resolution proof.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {/* GM Action Tracker Trigger */}
          <button
            type="button"
            onClick={() => setIsActionDrawerOpen(true)}
            className="flex items-center gap-2 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Flag className="h-4 w-4 text-amber-500" />
            <span>Action Tracker</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              pendingCount + submittedCount > 0
                ? 'bg-amber-500 text-slate-950 shadow-xs animate-pulse'
                : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
            }`}>
              {pendingCount + submittedCount}
            </span>
          </button>

          <ExportButton onClick={handleExportPhotos} label="Export Log" variant="outline" />

          <button
            onClick={() => {
              fetchPhotos(true);
              fetchActionItems();
            }}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>

          <div className="text-xs font-bold px-3.5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>{pagination.totalCount} Photo{pagination.totalCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {/* GM Directive Quick Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs pt-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1 flex-shrink-0">
          <Flag className="h-3.5 w-3.5 text-amber-500" /> Filter by GM Action:
        </span>
        <button
          onClick={() => setActionFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
            actionFilter === 'all'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 font-black'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60 shadow-xs'
          }`}
        >
          <span>All Photos</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            actionFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}>
            {pagination.totalCount || photos.length}
          </span>
        </button>
        <button
          onClick={() => setActionFilter('PENDING')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 ${
            actionFilter === 'PENDING'
              ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-600 font-black'
              : 'bg-amber-50/80 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 shadow-xs'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span>Action Pending</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            actionFilter === 'PENDING' ? 'bg-black/20 text-black' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
          }`}>
            {pendingCount}
          </span>
        </button>
        <button
          onClick={() => setActionFilter('SUBMITTED')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 ${
            actionFilter === 'SUBMITTED'
              ? 'bg-sky-600 text-white shadow-md border border-sky-700 font-black'
              : 'bg-sky-50/80 hover:bg-sky-100 text-sky-800 dark:bg-sky-950/30 dark:hover:bg-sky-900/40 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80 shadow-xs'
          }`}
        >
          <Upload className="h-3.5 w-3.5 text-sky-500" />
          <span>Proof Submitted</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            actionFilter === 'SUBMITTED' ? 'bg-white/20 text-white' : 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300'
          }`}>
            {submittedCount}
          </span>
        </button>
        <button
          onClick={() => setActionFilter('RESOLVED')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 ${
            actionFilter === 'RESOLVED'
              ? 'bg-emerald-600 text-white shadow-md border border-emerald-700 font-black'
              : 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Verified Closed</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            actionFilter === 'RESOLVED' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
          }`}>
            {resolvedCount}
          </span>
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="p-4.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </div>
            Filter Gallery
          </div>
          {(selectedDate || selectedApp !== 'all' || selectedSupervisor !== 'all' || selectedRoute !== 'all' || selectedOutlet !== 'all' || searchQuery || actionFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Date Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-indigo-500" />
              Visit Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Supervisor Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <User className="h-3 w-3 text-indigo-500" />
              Supervisor
            </label>
            <select
              value={selectedSupervisor}
              onChange={(e) => {
                setSelectedSupervisor(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Supervisors</option>
              {supervisors.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </div>

          {/* Route Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-indigo-500" />
              Route
            </label>
            <select
              value={selectedRoute}
              onChange={(e) => {
                setSelectedRoute(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Routes</option>
              {routes.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>

          {/* Outlet Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Store className="h-3 w-3 text-indigo-500" />
              Customer / Outlet
            </label>
            <select
              value={selectedOutlet}
              onChange={(e) => {
                setSelectedOutlet(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Outlets</option>
              {outlets.map((ot) => (
                <option key={ot} value={ot}>
                  {ot}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Search className="h-3 w-3 text-indigo-500" />
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Outlet, supervisor, route..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs font-semibold py-2 pl-8 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Date Shortcuts */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Viewing records for{' '}
            <strong className="text-slate-900 dark:text-white font-bold">
              {selectedDate || 'All Available Dates'}
            </strong>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setSelectedDate(getTodayStr());
                setCurrentPage(1);
              }}
              className={`text-[11px] font-bold py-1 px-3 rounded-lg border transition-all cursor-pointer ${
                selectedDate === getTodayStr()
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                setSelectedDate('');
                setCurrentPage(1);
              }}
              className={`text-[11px] font-bold py-1 px-3 rounded-lg border transition-all cursor-pointer ${
                !selectedDate
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              All Dates
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin text-accent" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">Loading Audit Photos from Database...</p>
        </div>
      ) : displayedPhotos.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-3 shadow-sm">
          <ImageIcon className="h-12 w-12 mx-auto text-[var(--text-muted)] opacity-50" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            No audit photos found matching the selected filters.
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
            Try adjusting your date, GM action status, or search filters.
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-2 text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {displayedPhotos.map((photo) => {
            const catStyle = getCategoryStyle(photo.category);
            const appStyle = getAppBadgeStyle(photo.appName);
            const action = actionItemsMap[photo.photoId];
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
                className={`group relative rounded-2xl border bg-[var(--surface)] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col ${
                  action?.actionStatus === 'PENDING'
                    ? 'border-amber-500/50 ring-1 ring-amber-500/20 hover:border-amber-400'
                    : action?.actionStatus === 'SUBMITTED'
                    ? 'border-sky-500/50 ring-1 ring-sky-500/20 hover:border-sky-400'
                    : action?.actionStatus === 'RESOLVED'
                    ? 'border-emerald-500/50 ring-1 ring-emerald-500/20 hover:border-emerald-400'
                    : 'border-[var(--border)] hover:border-accent/50'
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

                  {/* GM Action Status Overlay Badge */}
                  {action && (
                    <div
                      className={`absolute bottom-2.5 left-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center justify-between shadow-lg backdrop-blur-md border ${
                        action.actionStatus === 'RESOLVED'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                          : action.actionStatus === 'SUBMITTED'
                          ? 'bg-sky-950/80 text-sky-300 border-sky-500/40'
                          : 'bg-amber-950/85 text-amber-300 border-amber-500/40 animate-pulse'
                      }`}
                    >
                      <span className="flex items-center gap-1 truncate">
                        <Flag className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {action.actionStatus === 'RESOLVED'
                            ? 'Verified Closed'
                            : action.actionStatus === 'SUBMITTED'
                            ? 'Proof Uploaded (Review)'
                            : `Action Required (${action.supervisor})`}
                        </span>
                      </span>
                      {action.actionStatus === 'PENDING' && (
                        <span className="font-mono text-[9px] uppercase px-1 rounded bg-black/40">
                          {action.priority}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-semibold text-white px-3.5 py-2 rounded-xl bg-black/70 backdrop-blur-sm flex items-center gap-2 border border-white/20">
                      <ExternalLink className="h-3.5 w-3.5" /> Inspect & GM Remarks
                    </span>
                  </div>
                </div>

                {/* Photo Details Footer */}
                <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate flex items-center gap-2">
                      <Store className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="truncate">
                        {photo.outletCode ? <span className="font-mono text-sky-400 font-bold mr-1">[{photo.outletCode}]</span> : null}
                        {photo.outlet}
                      </span>
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[var(--text-muted)] flex-shrink-0" />
                      <span>
                        Supervisor: <strong className="text-[var(--text-primary)]">{photo.supervisor}</strong>
                      </span>
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[var(--border-soft)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {photo.route || 'N/A'}
                      </span>
                      {photo.channel && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/10 text-accent border border-accent/20">
                          {photo.channel}
                        </span>
                      )}
                    </div>
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
      {actionFilter === 'all' && pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
          <p>
            Showing Page <strong className="text-[var(--text-primary)]">{pagination.currentPage}</strong> of{' '}
            <strong className="text-[var(--text-primary)]">{pagination.totalPages}</strong> (
            <strong className="text-[var(--text-primary)]">{pagination.totalCount}</strong> total items)
          </p>

          <div className="flex items-center gap-1.5">
            <button
              title="First Page"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="h-8 w-8 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--border-soft)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>

            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 text-xs font-semibold rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--border-soft)] transition-colors cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Prev</span>
            </button>

            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pNum = currentPage;
                if (pagination.totalPages <= 5) pNum = i + 1;
                else if (currentPage <= 3) pNum = i + 1;
                else if (currentPage >= pagination.totalPages - 2) pNum = pagination.totalPages - 4 + i;
                else pNum = currentPage - 2 + i;

                const isActive = pNum === currentPage;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setCurrentPage(pNum)}
                    className={`h-8 min-w-[32px] px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-105'
                        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--border-soft)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage === pagination.totalPages}
              className="h-8 px-3 text-xs font-semibold rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--border-soft)] transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="hidden sm:inline">Next</span> <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <button
              title="Last Page"
              onClick={() => setCurrentPage(pagination.totalPages)}
              disabled={currentPage === pagination.totalPages}
              className="h-8 w-8 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--border-soft)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* EXECUTIVE GM ACTION TRACKER DRAWER */}
      {isActionDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsActionDrawerOpen(false)}
          />
          <div className="relative w-full max-w-xl bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl h-full flex flex-col z-10 p-6 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Flag className="h-4 w-4 text-amber-500" /> GM Corrective Action Items Tracker
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Track supervisor rectifications and photographic proof of resolution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActionDrawerOpen(false)}
                className="p-1.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* KPI Counts Bar */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-lg font-extrabold text-amber-400">{pendingCount}</p>
                <p className="text-[10px] font-semibold text-amber-300 uppercase">Pending Action</p>
              </div>
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <p className="text-lg font-extrabold text-sky-400">{submittedCount}</p>
                <p className="text-[10px] font-semibold text-sky-300 uppercase">Proof Uploaded</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-lg font-extrabold text-emerald-400">{resolvedCount}</p>
                <p className="text-[10px] font-semibold text-emerald-300 uppercase">Verified Closed</p>
              </div>
            </div>

            {/* List of Action Items */}
            <div className="space-y-3">
              {filteredActionItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                  <Flag className="h-8 w-8 mx-auto opacity-30 mb-2" />
                  No action directives assigned yet. Click on any photo in the gallery to flag an issue!
                </div>
              ) : (
                filteredActionItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.actionStatus === 'RESOLVED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : item.actionStatus === 'SUBMITTED'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                        }`}
                      >
                        {item.actionStatus === 'RESOLVED' ? 'Verified' : item.actionStatus === 'SUBMITTED' ? 'Proof Ready for Review' : 'Action Pending'}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{item.outlet}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Supervisor: <strong className="text-[var(--text-secondary)]">{item.supervisor}</strong> · Route: {item.route}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border-soft)]">
                      <p className="text-[10px] text-amber-400 font-bold">GM Directive:</p>
                      <p className="text-[11px] text-[var(--text-secondary)] italic">"{item.gmComment}"</p>
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
                      onClick={() => {
                        setIsActionDrawerOpen(false);
                        const existingIdx = photos.findIndex((p) => p.photoId === item.photoId);
                        if (existingIdx !== -1) {
                          setLightboxIndex(existingIdx);
                        } else {
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
                            supervisor: item.supervisor,
                            manager: item.manager || '',
                            channel: item.channel || 'GT',
                          };
                          setPhotos((prev) => [syntheticPhoto, ...prev.filter((p) => p.photoId !== item.photoId)]);
                          setLightboxIndex(0);
                        }
                      }}
                      className="w-full py-1.5 rounded-lg text-xs font-bold bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" /> Inspect Audit & Resolution Photo
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Metadata Modal with GM Directive & Proof Verification */}
      <ImageLightboxModal
        photos={displayedPhotos}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
        title="Admin Audit Photo Gallery"
        userRole="Admin"
        actionItems={actionItemsMap}
        onActionUpdated={() => {
          fetchActionItems();
          fetchPhotos(true);
        }}
      />
    </div>
  );
}
