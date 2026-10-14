'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Calendar,
  AlertTriangle,
  FileText,
  MapPin,
  Clock,
  Store,
  RefreshCw,
  Eye,
  X,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Filter,
  Camera,
  ExternalLink,
  Tag,
  User,
  RotateCcw,
} from 'lucide-react';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import ImageLightboxModal from '@/components/ui/ImageLightboxModal';

export interface NoVisitPhoto {
  photoId: string;
  category?: string;
  cloudinaryUrl: string;
  uploadedAt?: string;
}

export interface NoVisitItem {
  visitId: string;
  date: string;
  createdAt: string;
  supervisorId: string;
  supervisorName: string;
  supervisorCode: string;
  routeCode: string;
  routeName: string;
  customerCode: string;
  customerName: string;
  channel: string;
  reasonCategory: string;
  reason: string;
  observation?: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  photos: NoVisitPhoto[];
}

interface NoVisitsViewProps {
  role: 'admin' | 'supervisor';
}

export default function NoVisitsView({ role }: NoVisitsViewProps) {
  const { showToast } = useToast();
  const [visits, setVisits] = useState<NoVisitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [supervisorFilter, setSupervisorFilter] = useState('All');

  const getMinusOneDayStr = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getTodayStr = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getNDaysAgoStr = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getFirstDayOfMonthStr = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const defaultMinusOne = getMinusOneDayStr();
  const [fromDate, setFromDate] = useState<string>(defaultMinusOne);
  const [toDate, setToDate] = useState<string>(defaultMinusOne);

  const setQuickDate = (preset: 'minus1' | 'today' | '7d' | 'mtd' | 'all') => {
    if (preset === 'minus1') {
      const d = getMinusOneDayStr();
      setFromDate(d);
      setToDate(d);
    } else if (preset === 'today') {
      const today = getTodayStr();
      setFromDate(today);
      setToDate(today);
    } else if (preset === '7d') {
      setFromDate(getNDaysAgoStr(7));
      setToDate(getTodayStr());
    } else if (preset === 'mtd') {
      setFromDate(getFirstDayOfMonthStr());
      setToDate(getTodayStr());
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
    setCurrentPage(1);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedVisit, setSelectedVisit] = useState<NoVisitItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Distinct filters available from loaded data
  const [availableSupervisors, setAvailableSupervisors] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  const fetchNoVisits = async (isSilent = false) => {
    if (isSilent) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/no-visits');
      const data = await res.json();
      if (data?.success) {
        setVisits(data.visits || []);
        if (data.supervisors) setAvailableSupervisors(data.supervisors);
        if (data.reasonCategories) setAvailableCategories(data.reasonCategories);
      } else {
        throw new Error(data?.error || 'Failed to load records');
      }
    } catch (err: any) {
      showToast(err.message || 'Error fetching no-visit details.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNoVisits();
  }, []);

  // Filter logic
  const filteredVisits = useMemo(() => {
    return visits.filter((item) => {
      // 1. Text search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesSearch =
          item.visitId.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.customerCode.toLowerCase().includes(q) ||
          item.supervisorName.toLowerCase().includes(q) ||
          item.supervisorCode.toLowerCase().includes(q) ||
          item.routeCode.toLowerCase().includes(q) ||
          item.routeName.toLowerCase().includes(q) ||
          item.reasonCategory.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q) ||
          (item.channel && item.channel.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Reason Category Filter
      if (categoryFilter !== 'All' && item.reasonCategory !== categoryFilter) {
        return false;
      }

      // 3. Supervisor Filter (admin only)
      if (role === 'admin' && supervisorFilter !== 'All' && item.supervisorName !== supervisorFilter) {
        return false;
      }

      // 4. Date Range Filter
      if (fromDate || toDate) {
        const itemDay = item.date ? item.date.split('T')[0] : '';
        if (itemDay) {
          if (fromDate && itemDay < fromDate) return false;
          if (toDate && itemDay > toDate) return false;
        }
      }

      return true;
    });
  }, [visits, search, categoryFilter, supervisorFilter, fromDate, toDate, role]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, supervisorFilter, fromDate, toDate, pageSize]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = filteredVisits.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = filteredVisits.filter((v) => v.date.startsWith(todayStr)).length;
    const uniqueOutlets = new Set(filteredVisits.map((v) => v.customerCode || v.customerName)).size;

    const reasonCounts: Record<string, number> = {};
    filteredVisits.forEach((v) => {
      const cat = v.reasonCategory || 'Other';
      reasonCounts[cat] = (reasonCounts[cat] || 0) + 1;
    });

    let topReason = '—';
    let maxCount = 0;
    Object.entries(reasonCounts).forEach(([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topReason = `${cat} (${count})`;
      }
    });

    return { total, todayCount, uniqueOutlets, topReason };
  }, [filteredVisits]);

  // Pagination slice
  const isAll = pageSize === -1;
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(filteredVisits.length / pageSize));
  const currentPageClamped = isAll ? 1 : Math.min(currentPage, totalPages);
  const startIndex = isAll ? 0 : (currentPageClamped - 1) * pageSize;
  const paginatedVisits = isAll ? filteredVisits : filteredVisits.slice(startIndex, startIndex + pageSize);

  // Clear filters
  const isFiltered = search !== '' || categoryFilter !== 'All' || supervisorFilter !== 'All' || fromDate !== defaultMinusOne || toDate !== defaultMinusOne;
  const handleClearFilters = () => {
    setSearch('');
    setCategoryFilter('All');
    setSupervisorFilter('All');
    setFromDate(defaultMinusOne);
    setToDate(defaultMinusOne);
    setCurrentPage(1);
  };

  // Export to Excel
  const handleExport = () => {
    if (filteredVisits.length === 0) {
      showToast('No records available to export.', 'warning');
      return;
    }

    const columns = [
      {
        header: 'Visit Date & Time',
        key: 'date',
        formatter: (val: string) => (val ? new Date(val).toLocaleString('en-IN') : '—'),
      },
      { header: 'Channel', key: 'channel', formatter: (val: any) => val || 'GT' },
      ...(role === 'admin'
        ? [
            { header: 'Supervisor Name', key: 'supervisorName' },
            { header: 'Supervisor Code', key: 'supervisorCode' },
          ]
        : []),
      { header: 'Route Code', key: 'routeCode' },
      { header: 'Route Name', key: 'routeName' },
      { header: 'Outlet Code', key: 'customerCode' },
      { header: 'Outlet Name', key: 'customerName' },
      { header: 'Reason Category', key: 'reasonCategory' },
      { header: 'Reason Details / Notes', key: 'reason' },
      { header: 'Photos Count', key: 'photos', formatter: (p: any[]) => p?.length || 0 },
      {
        header: 'GPS Coordinates',
        key: 'latitude',
        formatter: (_: any, row: NoVisitItem) =>
          row.latitude && row.longitude ? `${row.latitude}, ${row.longitude}` : 'N/A',
      },
    ];

    exportToExcel({
      filename: `No_Visits_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'No Visits',
      columns,
      data: filteredVisits,
    });

    showToast(`Exported ${filteredVisits.length} No Visit records.`, 'success');
  };

  // Helper for Category badge colors
  const getCategoryBadgeClass = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('closed')) return 'badge-danger';
    if (cat.includes('permission') || cat.includes('refused')) return 'badge-warning';
    if (cat.includes('absent') || cat.includes('not available')) return 'badge-info';
    if (cat.includes('safety')) return 'badge-danger';
    return 'badge-accent';
  };

  return (
    <div className="space-y-4">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-800 p-2 flex items-center justify-center shadow-md border border-slate-200/80 dark:border-slate-700/80 flex-shrink-0">
            <img src="/images/dandy-logo.png" alt="Dandy Logo" className="h-full w-auto object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                No Visit Records
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                {metrics.total} {metrics.total === 1 ? 'record' : 'records'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Outlet visits bypassed with supervisor audit justification, GPS, and photo proof verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchNoVisits(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Refresh records"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <ExportButton onClick={handleExport} label="Export Excel" variant="default" />
        </div>
      </div>

      {/* ─── KPI Metrics Cards (4 Designer Cards) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Skipped */}
        <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-4.5 shadow-sm hover:shadow-md transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Skipped
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-500/25 group-hover:scale-105 transition-transform">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : metrics.total}
            </span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">bypasses</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
            Cumulative logged skips
          </p>
        </div>

        {/* Today's Skipped */}
        <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-4.5 shadow-sm hover:shadow-md transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Today's Skipped
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : metrics.todayCount}
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">today</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
            Occurred in past 24 hours
          </p>
        </div>

        {/* Outlets Affected */}
        <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-4.5 shadow-sm hover:shadow-md transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Outlets Affected
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/25 group-hover:scale-105 transition-transform">
              <Store className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {loading ? <Skeleton className="h-8 w-16" /> : metrics.uniqueOutlets}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">unique POS</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
            Distinct retail touchpoints
          </p>
        </div>

        {/* Top Reason */}
        <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-4.5 shadow-sm hover:shadow-md transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Top Reason
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/25 group-hover:scale-105 transition-transform">
              <Tag className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white truncate" title={metrics.topReason}>
              {loading ? <Skeleton className="h-8 w-24" /> : metrics.topReason}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
            Leading skip justification
          </p>
        </div>
      </div>

      {/* ─── Search & Filters Bar ─── */}
      <div className="rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-4 shadow-sm space-y-3.5">
        {/* Quick Date Presets Strip matching Management Dashboard & Photo Audit Gallery */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1 flex-shrink-0">
            <span>Date Presets:</span>
          </span>
          <button
            type="button"
            onClick={() => setQuickDate('minus1')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
              fromDate === defaultMinusOne && toDate === defaultMinusOne
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>⚡ -1 Day (Yesterday)</span>
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('today')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex-shrink-0 ${
              fromDate === getTodayStr() && toDate === getTodayStr()
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('7d')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex-shrink-0 ${
              fromDate === getNDaysAgoStr(7) && toDate === getTodayStr()
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('mtd')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex-shrink-0 ${
              fromDate === getFirstDayOfMonthStr() && toDate === getTodayStr()
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('all')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex-shrink-0 ${
              !fromDate && !toDate
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All Dates
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {/* Search box */}
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search outlet name, supervisor, route code, reason notes..."
              className="w-full text-xs font-semibold pl-10 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Slicers & Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* From Date Slicer */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-indigo-500" /> From:
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none py-1 cursor-pointer"
              />
            </div>

            {/* To Date Slicer */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-indigo-500" /> To:
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none py-1 cursor-pointer"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Tag className="h-3 w-3 text-indigo-500" /> Reason:
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none py-1 pr-1 cursor-pointer"
              >
                <option value="All" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Reasons</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Supervisor Filter (Admin Only) */}
            {role === 'admin' && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <User className="h-3 w-3 text-indigo-500" /> Supervisor:
                </span>
                <select
                  value={supervisorFilter}
                  onChange={(e) => setSupervisorFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none py-1 pr-1 max-w-[140px] cursor-pointer"
                >
                  <option value="All" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Supervisors</option>
                  {availableSupervisors.map((sup) => (
                    <option key={sup} value={sup} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      {sup}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear Filters */}
            {isFiltered && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer shadow-xs"
                title="Reset all filters"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Range & Count Subtitle */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1 pt-0.5">
          <div>
            Viewing records: {fromDate && toDate ? (
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`}
              </span>
            ) : fromDate ? (
              <span className="font-semibold text-slate-700 dark:text-slate-300">From {fromDate}</span>
            ) : toDate ? (
              <span className="font-semibold text-slate-700 dark:text-slate-300">Up to {toDate}</span>
            ) : (
              <span className="font-semibold text-slate-700 dark:text-slate-300">All Dates</span>
            )}
            {categoryFilter !== 'All' && <span> · Reason: <b className="text-slate-700 dark:text-slate-300">{categoryFilter}</b></span>}
            {role === 'admin' && supervisorFilter !== 'All' && <span> · Supervisor: <b className="text-slate-700 dark:text-slate-300">{supervisorFilter}</b></span>}
          </div>
          <span className="font-bold text-slate-600 dark:text-slate-400">
            {filteredVisits.length} record{filteredVisits.length === 1 ? '' : 's'} found
          </span>
        </div>
      </div>

      {/* ─── Table Section ─── */}
      <div className="rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Date & Time
                </th>
                {role === 'admin' && (
                  <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Supervisor
                  </th>
                )}
                <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Route
                </th>
                <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Outlet
                </th>
                <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Reason Category
                </th>
                <th className="px-4 py-3.5 text-left font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Remarks / Note
                </th>
                <th className="px-4 py-3.5 text-center font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Proof
                </th>
                <th className="px-4 py-3.5 text-right font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-24" /></td>
                    {role === 'admin' && <td className="px-4 py-3.5"><Skeleton className="h-4 w-28" /></td>}
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-6 w-24 rounded-full" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3.5 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><Skeleton className="h-7 w-16 ml-auto rounded-xl" /></td>
                  </tr>
                ))
              ) : paginatedVisits.length === 0 ? (
                <tr>
                  <td colSpan={role === 'admin' ? 8 : 7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shadow-sm">
                        <AlertTriangle className="h-7 w-7" />
                      </div>
                      <p className="font-extrabold text-sm text-slate-900 dark:text-white">No skipped visits found</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {isFiltered
                          ? 'No records match the active filters. Try adjusting your search query or reset filters.'
                          : 'There are currently no recorded No Visit audit logs in the system.'}
                      </p>
                      {isFiltered && (
                        <button onClick={handleClearFilters} className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md cursor-pointer transition-all">
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedVisits.map((row) => (
                  <tr
                    key={row.visitId}
                    className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {new Date(row.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 pl-4.5">
                        {new Date(row.date).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Supervisor (Admin Only) */}
                    {role === 'admin' && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-extrabold flex-shrink-0 shadow-xs">
                            {row.supervisorName ? row.supervisorName.slice(0, 2).toUpperCase() : 'SP'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 dark:text-white truncate max-w-[140px]" title={row.supervisorName}>
                              {row.supervisorName}
                            </div>
                            {row.supervisorCode && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{row.supervisorCode}</div>
                            )}
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Route */}
                    <td className="px-4 py-3.5">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold text-xs border border-slate-200 dark:border-slate-700">
                        {row.routeCode || '—'}
                      </span>
                      {row.routeName && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px] mt-0.5" title={row.routeName}>
                          {row.routeName}
                        </div>
                      )}
                    </td>

                    {/* Outlet */}
                    <td className="px-4 py-3.5">
                      <div className="font-extrabold text-slate-900 dark:text-white truncate max-w-[180px]" title={row.customerName}>
                        {row.customerName || 'Unknown Outlet'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {row.customerCode && (
                          <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.customerCode}</span>
                        )}
                        {row.channel && (
                          <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {row.channel}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Reason Category */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-xs ${
                        (row.reasonCategory || '').toLowerCase().includes('closed')
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          : (row.reasonCategory || '').toLowerCase().includes('permission') || (row.reasonCategory || '').toLowerCase().includes('refused')
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : (row.reasonCategory || '').toLowerCase().includes('absent')
                          ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                          : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                      }`}>
                        {row.reasonCategory || 'Other'}
                      </span>
                    </td>

                    {/* Reason / Remarks */}
                    <td className="px-4 py-3.5">
                      <p className="text-slate-600 dark:text-slate-300 line-clamp-2 max-w-xs font-medium text-xs leading-relaxed" title={row.reason || '—'}>
                        {row.reason || '—'}
                      </p>
                    </td>

                    {/* Photos Count */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {row.photos && row.photos.length > 0 ? (
                        <button
                          onClick={() => setSelectedVisit(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-xs group"
                          title="View attached photo proof"
                        >
                          <Camera className="h-3.5 w-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
                          <span>{row.photos.length}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedVisit(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-950/40 dark:text-slate-300 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
                        title="View details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination Section ─── */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          {/* Records Counter & Page Size */}
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
            <span>
              Showing{' '}
              <strong className="text-[var(--text-primary)]">
                {filteredVisits.length === 0 ? 0 : isAll ? 1 : startIndex + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-[var(--text-primary)]">
                {isAll ? filteredVisits.length : Math.min(startIndex + pageSize, filteredVisits.length)}
              </strong>{' '}
              of <strong className="text-[var(--text-primary)]">{filteredVisits.length}</strong> records
            </span>

            <div className="flex items-center gap-1.5 pl-2" style={{ borderLeft: '1px solid var(--border)' }}>
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="form-input text-[11px] h-7 py-0 px-2"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>All</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          {totalPages > 1 && !isAll && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="btn-ghost p-1.5 h-8 w-8 flex items-center justify-center rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-ghost p-1.5 h-8 w-8 flex items-center justify-center rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-2 text-[11px] font-semibold text-[var(--text-primary)]">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-ghost p-1.5 h-8 w-8 flex items-center justify-center rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="btn-ghost p-1.5 h-8 w-8 flex items-center justify-center rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Details Modal ─── */}
      {selectedVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedVisit(null)}
        >
          <div
            className="panel w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200"
            style={{ background: 'var(--surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                >
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[var(--text-primary)]">Skipped Visit Details</h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono">{selectedVisit.visitId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVisit(null)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 text-[12px]">
              {/* Reason Highlight Banner */}
              <div
                className="p-3.5 rounded-lg flex items-start gap-3"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div className="flex-grow space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Reason Category:</span>
                    <span className={`badge ${getCategoryBadgeClass(selectedVisit.reasonCategory)}`}>
                      {selectedVisit.reasonCategory || 'Other'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Supervisor Remarks:</span>
                    <p className="text-[13px] font-medium text-[var(--text-primary)] mt-0.5">
                      {selectedVisit.reason || selectedVisit.observation || 'No additional remarks provided.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid 1: Outlet & Route Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-[var(--border)] space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)]">
                    <Store className="h-3.5 w-3.5" />
                    <span>Outlet Details</span>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)]">Outlet Name:</span>
                      <p className="font-semibold text-[var(--text-primary)]">{selectedVisit.customerName}</p>
                    </div>
                    <div className="flex justify-between">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)]">Outlet Code:</span>
                        <p className="font-mono text-[var(--text-secondary)]">{selectedVisit.customerCode || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)]">Channel:</span>
                        <p className="text-[var(--text-secondary)]">{selectedVisit.channel || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border)] space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)]">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Route & Location</span>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)]">Route:</span>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {selectedVisit.routeCode} – {selectedVisit.routeName}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)]">GPS Coordinates:</span>
                      {selectedVisit.latitude && selectedVisit.longitude ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                            {selectedVisit.latitude.toFixed(6)}, {selectedVisit.longitude.toFixed(6)}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${selectedVisit.latitude},${selectedVisit.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] text-[var(--accent)] hover:underline"
                          >
                            <span>Open Map</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      ) : (
                        <p className="text-[var(--text-muted)]">GPS location not captured</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid 2: Supervisor & Timestamp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-[var(--border)] space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)]">
                    <User className="h-3.5 w-3.5" />
                    <span>Supervisor Info</span>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)]">Supervisor Name:</span>
                      <p className="font-semibold text-[var(--text-primary)]">{selectedVisit.supervisorName}</p>
                    </div>
                    {selectedVisit.supervisorCode && (
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)]">Employee Code:</span>
                        <p className="font-mono text-[var(--text-secondary)]">{selectedVisit.supervisorCode}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border)] space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)]">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Timestamp</span>
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)]">Date & Time Logged:</span>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {new Date(selectedVisit.date).toLocaleString('en-IN', {
                          dateStyle: 'full',
                          timeStyle: 'medium',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attached Photos Section */}
              <div className="p-3 rounded-lg border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)]">
                    <Camera className="h-3.5 w-3.5" />
                    <span>Attached Photos ({selectedVisit.photos?.length || 0})</span>
                  </div>
                </div>

                {selectedVisit.photos && selectedVisit.photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {selectedVisit.photos.map((photo, idx) => (
                      <div
                        key={photo.photoId || idx}
                        onClick={() => setLightboxIndex(idx)}
                        className="group relative rounded-lg overflow-hidden border border-[var(--border)] bg-black/20 aspect-video cursor-pointer hover:border-[var(--accent)] transition-all"
                      >
                        <img
                          src={photo.cloudinaryUrl}
                          alt={photo.category || 'No Visit Proof'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <span className="text-[10px] text-white font-medium truncate">
                            {photo.category || 'Proof Photo'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--text-muted)] py-2">
                    No proof photos were captured for this skipped visit.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[var(--border)] flex justify-end">
              <button onClick={() => setSelectedVisit(null)} className="btn-secondary text-[12px] py-1.5 px-4">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Lightbox Modal for Photo Inspection ─── */}
      {selectedVisit && selectedVisit.photos && selectedVisit.photos.length > 0 && lightboxIndex !== null && (
        <ImageLightboxModal
          photos={selectedVisit.photos.map((p) => ({
            photoId: p.photoId,
            cloudinaryUrl: p.cloudinaryUrl,
            category: p.category || selectedVisit.reasonCategory,
            outlet: selectedVisit.customerName,
            supervisor: selectedVisit.supervisorName,
            route: selectedVisit.routeCode,
            channel: selectedVisit.channel,
            uploadedAt: p.uploadedAt || selectedVisit.date,
            visitId: selectedVisit.visitId,
            observation: selectedVisit.observation || selectedVisit.reason,
            visitObservation: selectedVisit.observation,
            visitReason: selectedVisit.reason,
          }))}
          currentIndex={lightboxIndex}
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
          title={`Proof Photo: ${selectedVisit.customerName}`}
        />
      )}
    </div>
  );
}
