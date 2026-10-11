'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getVisitsAction, deleteVisitAction, getVisitDetailsAction } from '@/actions/visit-actions';
import { useToast } from '@/components/ui/toast';
import { ConfirmationDialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Trash2, Eye, MapPin, Calendar, X,
  AlertTriangle, FileText, Thermometer,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  CheckCircle2, Clock, Filter, SlidersHorizontal,
  RotateCcw, Navigation, Store, Building, UserCheck, Check
} from 'lucide-react';
import { Visit, VisitPhoto, NPDResponse, VisitAsset, VisitPowerSkuResult } from '@/types';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';
import ImageLightboxModal from '@/components/ui/ImageLightboxModal';

// ─── Shared table helpers ────────────────────────────────────
function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-3.5 ${right ? 'text-right' : 'text-left'} text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/90 dark:border-slate-800 select-none whitespace-nowrap`}
    >
      {children}
    </th>
  );
}

function PageHeader({ title, sub, count }: { title: string; sub: string; count?: number }) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-500/10 to-violet-500/20 dark:bg-slate-800 p-1.5 flex items-center justify-center shadow-xs border border-indigo-200/60 dark:border-indigo-800/60 flex-shrink-0">
        <img src="/images/dandy-logo.png" alt="Dandy Logo" className="h-full w-auto object-contain" />
      </div>
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          {count !== undefined && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shadow-xs">
              {count}
            </span>
          )}
        </div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function Pagination({ current, total, filtered, onChange }: {
  current: number; total: number; filtered: number; onChange: (p: number) => void;
}) {
  if (total <= 1) return null;
  const btn = (onClick: () => void, disabled: boolean, children: React.ReactNode) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-ghost"
      style={{ height: '32px', padding: '0 10px', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  );
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        Page {current} of {total} · {filtered} records
      </span>
      <div className="flex items-center gap-1">
        {btn(() => onChange(1), current === 1, <ChevronsLeft className="h-3.5 w-3.5" />)}
        {btn(() => onChange(current - 1), current === 1, <ChevronLeft className="h-3.5 w-3.5" />)}
        {btn(() => onChange(current + 1), current === total, <ChevronRight className="h-3.5 w-3.5" />)}
        {btn(() => onChange(total), current === total, <ChevronsRight className="h-3.5 w-3.5" />)}
      </div>
    </div>
  );
}

function getVisitDateString(v: Visit): string {
  const raw = v.visit_datetime || v.createdAt;
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Main Page ────────────────────────────────────────────────
export default function VisitLogsPage() {
  const { showToast } = useToast();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  // General controls
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // ─── 5 Required Admin Slicers ─────────────────────────────────
  // 1. Dates Slicer (From and To date)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // 2. Route Code Slicer
  const [selectedRoute, setSelectedRoute] = useState('');

  // 3. Customer Code Slicer
  const [customerCodeFilter, setCustomerCodeFilter] = useState('');

  // 4. Customer Name Slicer
  const [customerNameFilter, setCustomerNameFilter] = useState('');

  // 5. Supervisor Slicer
  const [selectedSupervisor, setSelectedSupervisor] = useState('');

  // Modals & detail view
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewData, setReviewData] = useState<{
    visit: Visit;
    assets: VisitAsset[];
    photos: VisitPhoto[];
    powerSkuResults?: VisitPowerSkuResult[];
    npdResponses: NPDResponse[];
  } | null>(null);
  const [visitPhotoIndex, setVisitPhotoIndex] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });

  const fetchVisits = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsSyncing(true);
    try {
      const data = await getVisitsAction();
      setVisits((data as Visit[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLastUpdated(new Date());
    } catch (err: any) {
      showToast(err.message || 'Failed to load visits.', 'error');
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const getVisitDisplay = (v: Visit) => {
    const isNoVisit = v.visit_type === 'No Visit';
    const isBreach = !v.tempInRange && !isNoVisit;
    return {
      isNoVisit,
      isBreach,
      typeLabel: isNoVisit ? 'No Visit' : 'Visit',
      typeClass: isNoVisit ? 'badge-warning' : 'badge-success',
      routeLabel: isNoVisit ? '—' : (v.routeCode || '—'),
      customerLabel: isNoVisit ? 'No outlet selected' : (v.customerCode || '—'),
      customerName: v.customerName || '',
      supervisorName: v.supervisorName || v.supervisorId,
      tempLabel: isNoVisit ? 'N/A' : `${v.temperature ?? 0}°C`,
      tempClass: isNoVisit ? 'badge-info' : (v.tempInRange ? 'badge-success' : 'badge-danger'),
    };
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (active) await fetchVisits(false);
    };
    load();

    const interval = setInterval(async () => {
      if (active && typeof document !== 'undefined' && !document.hidden) {
        await fetchVisits(true);
      }
    }, 180000);

    const handleFocus = () => {
      if (active) fetchVisits(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleOpenReview = async (id: string) => {
    setReviewId(id);
    setDetailLoading(true);
    try {
      setReviewData(await getVisitDetailsAction(id) as any);
    } catch (error: any) {
      showToast(error.message || 'Failed to load visit details.', 'error');
      setReviewId(null);
    } finally { setDetailLoading(false); }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteVisitAction(deleteDialog.id);
      showToast('Visit deleted.', 'success');
      setDeleteDialog({ open: false, id: '' });
      if (reviewId === deleteDialog.id) { setReviewId(null); setReviewData(null); }
      fetchVisits();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete.', 'error');
    }
  };

  // ─── Extract Unique Slicer Dropdown Options ───────────────────
  const routeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of visits) {
      if (v.routeCode) {
        counts.set(v.routeCode, (counts.get(v.routeCode) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [visits]);

  const supervisorOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const v of visits) {
      const id = v.supervisorId || v.createdBy;
      if (!id) continue;
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
        if ((!existing.name || existing.name === existing.id) && v.supervisorName) {
          existing.name = v.supervisorName;
        }
      } else {
        map.set(id, {
          id,
          name: v.supervisorName || id,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [visits]);

  const customerCodeSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const v of visits) {
      if (v.customerCode) set.add(v.customerCode.trim());
    }
    return Array.from(set).sort().slice(0, 150);
  }, [visits]);

  const customerNameSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const v of visits) {
      if (v.customerName) set.add(v.customerName.trim());
    }
    return Array.from(set).sort().slice(0, 150);
  }, [visits]);

  // Quick date presets
  const setQuickDate = (preset: 'today' | 'yesterday' | 'last7' | 'mtd' | 'clear') => {
    const now = new Date();
    const toYMD = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (preset === 'today') {
      const str = toYMD(now);
      setFromDate(str);
      setToDate(str);
    } else if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const str = toYMD(yest);
      setFromDate(str);
      setToDate(str);
    } else if (preset === 'last7') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      setFromDate(toYMD(past));
      setToDate(toYMD(now));
    } else if (preset === 'mtd') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toYMD(start));
      setToDate(toYMD(now));
    } else if (preset === 'clear') {
      setFromDate('');
      setToDate('');
    }
  };

  const resetAllSlicers = () => {
    setFromDate('');
    setToDate('');
    setSelectedRoute('');
    setCustomerCodeFilter('');
    setCustomerNameFilter('');
    setSelectedSupervisor('');
    setSearch('');
    setStatusFilter('All');
    setCurrentPage(1);
  };

  const activeSlicersCount = [
    Boolean(fromDate || toDate),
    Boolean(selectedRoute),
    Boolean(customerCodeFilter.trim()),
    Boolean(customerNameFilter.trim()),
    Boolean(selectedSupervisor),
  ].filter(Boolean).length;

  const draftCount = useMemo(() => visits.filter((v) => v.status === 'Draft').length, [visits]);
  const submittedCount = useMemo(() => visits.filter((v) => v.status === 'Submitted').length, [visits]);

  // ─── Filter Logic Applying All 5 Slicers ─────────────────────
  const filtered = useMemo(() => {
    return visits.filter((v) => {
      // 1. Status Filter
      if (statusFilter !== 'All' && v.status !== statusFilter) {
        return false;
      }

      // 2. Dates Slicer (From and To date)
      const vDateStr = getVisitDateString(v);
      if (fromDate && vDateStr && vDateStr < fromDate) {
        return false;
      }
      if (toDate && vDateStr && vDateStr > toDate) {
        return false;
      }

      // 3. Route Code Slicer
      if (selectedRoute && v.routeCode !== selectedRoute) {
        return false;
      }

      // 4. Customer Code Slicer
      if (customerCodeFilter.trim()) {
        const cFilter = customerCodeFilter.trim().toLowerCase();
        const code = (v.customerCode || '').toLowerCase();
        if (!code.includes(cFilter)) {
          return false;
        }
      }

      // 5. Customer Name Slicer
      if (customerNameFilter.trim()) {
        const nFilter = customerNameFilter.trim().toLowerCase();
        const name = (v.customerName || '').toLowerCase();
        if (!name.includes(nFilter)) {
          return false;
        }
      }

      // 6. Supervisor Slicer
      if (selectedSupervisor) {
        const sMatch =
          v.supervisorId === selectedSupervisor ||
          v.createdBy === selectedSupervisor ||
          v.supervisorName === selectedSupervisor;
        if (!sMatch) {
          return false;
        }
      }

      // 7. General search bar
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match =
          v.visitId.toLowerCase().includes(q) ||
          v.supervisorId.toLowerCase().includes(q) ||
          (v.supervisorName || '').toLowerCase().includes(q) ||
          v.routeCode.toLowerCase().includes(q) ||
          v.customerCode.toLowerCase().includes(q) ||
          (v.customerName || '').toLowerCase().includes(q) ||
          (v.visit_type || '').toLowerCase().includes(q) ||
          (v.reason_category || '').toLowerCase().includes(q) ||
          (v.reason || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [
    visits,
    statusFilter,
    fromDate,
    toDate,
    selectedRoute,
    customerCodeFilter,
    customerNameFilter,
    selectedSupervisor,
    search,
  ]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    statusFilter,
    fromDate,
    toDate,
    selectedRoute,
    customerCodeFilter,
    customerNameFilter,
    selectedSupervisor,
  ]);

  const handleExportVisits = () => {
    const filterParts: string[] = [];
    if (fromDate || toDate) filterParts.push(`Date: ${fromDate || 'Start'} to ${toDate || 'Now'}`);
    if (selectedRoute) filterParts.push(`Route: ${selectedRoute}`);
    if (customerCodeFilter) filterParts.push(`Cust Code: ${customerCodeFilter}`);
    if (customerNameFilter) filterParts.push(`Cust Name: ${customerNameFilter}`);
    if (selectedSupervisor) filterParts.push(`Supervisor: ${selectedSupervisor}`);
    if (statusFilter !== 'All') filterParts.push(`Status: ${statusFilter}`);
    if (search) filterParts.push(`Search: "${search}"`);

    exportToExcel({
      filename: `visit_logs_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Visit Logs',
      title: 'Field Visit Audit Logs Report',
      filterSummary: filterParts.length > 0 ? filterParts.join(' | ') : 'All Visits (No Filter)',
      columns: [
        { header: 'Visit Date', key: 'visit_datetime', formatter: (val: any, row: any) => val ? new Date(val).toLocaleString() : (row.createdAt ? new Date(row.createdAt).toLocaleString() : '—') },
        { header: 'Supervisor Name', key: 'supervisorName', formatter: (val: any, row: any) => val || row.supervisorId || '—' },
        { header: 'Supervisor ID', key: 'supervisorId' },
        { header: 'Route Code', key: 'routeCode' },
        { header: 'Customer Code', key: 'customerCode' },
        { header: 'Customer Name', key: 'customerName', formatter: (val: any) => val || '—' },
        { header: 'Visit Type', key: 'visit_type', formatter: (val: any) => val || 'Standard Visit' },
        { header: 'Reason / Category', key: 'reason_category', formatter: (val: any, row: any) => val || row.reason || '—' },
        { header: 'Temperature (°C)', key: 'temperature', formatter: (val: any) => val !== undefined && val !== null ? `${val}°C` : '—' },
        { header: 'Temp In Range', key: 'tempInRange', formatter: (val: any) => val ? 'Yes' : 'No' },
        { header: 'Status', key: 'status' },
        { header: 'Latitude', key: 'latitude' },
        { header: 'Longitude', key: 'longitude' },
      ],
      data: filtered,
    });
  };

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Visit Logs" sub="Browse, inspect and audit supervisor field visit entries." count={filtered.length} />
        <ExportButton onClick={handleExportVisits} label="Export Visit Logs" variant="default" />
      </div>

      {/* ── 5 Required Admin Slicers Panel ─────────────────────── */}
      <div
        className="rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-5 space-y-4 transition-all"
        style={{
          borderColor: activeSlicersCount > 0 ? 'var(--accent)' : undefined,
          boxShadow: activeSlicersCount > 0 ? '0 10px 25px -5px rgba(37,99,235,0.15)' : undefined,
        }}
      >
        {/* Slicers Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-black tracking-tight text-slate-900 dark:text-white">
                  Admin Slicers
                </span>
                {activeSlicersCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500 text-white shadow-xs animate-pulse">
                    {activeSlicersCount} active
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    Filter across 5 dimensions
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Live reactive multi-criteria cross filtering for field audit visits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Live sync capsule */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black font-mono text-slate-600 dark:text-slate-300 h-8 shadow-xs">
              <span
                className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`}
                style={{
                  boxShadow: isSyncing ? '0 0 8px rgba(99,102,241,0.8)' : '0 0 8px rgba(16,185,129,0.8)',
                }}
              />
              <span className="tracking-wider">{isSyncing ? 'SYNCING...' : 'LIVE SYNC'}</span>
              <span className="opacity-30">|</span>
              <span className="text-slate-400 dark:text-slate-500" suppressHydrationWarning>
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Reset Slicers Button */}
            <button
              onClick={resetAllSlicers}
              disabled={activeSlicersCount === 0 && !search && statusFilter === 'All'}
              className="flex items-center gap-1.5 px-3.5 h-8 rounded-xl text-[11px] font-black transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs border"
              style={{
                background: activeSlicersCount > 0 ? 'rgba(99,102,241,0.12)' : 'var(--surface-2)',
                color: activeSlicersCount > 0 ? 'var(--accent)' : 'var(--text-muted)',
                borderColor: activeSlicersCount > 0 ? 'var(--accent)' : 'var(--border)',
              }}
              title="Reset all filters and slicers"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Slicers
            </button>
          </div>
        </div>

        {/* 5 Slicers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Slicer 1: Dates Slicer */}
          <div
            className="p-3 rounded-xl flex flex-col justify-between transition-all bg-slate-50/70 dark:bg-slate-800/50 border"
            style={{
              borderColor: (fromDate || toDate) ? 'var(--accent)' : 'var(--border-soft)',
              boxShadow: (fromDate || toDate) ? '0 0 10px -2px rgba(99,102,241,0.15)' : 'none',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Calendar className="h-3 w-3" />
                  </span>
                  1. Dates (From - To)
                </span>
                {(fromDate || toDate) && (
                  <button onClick={() => setQuickDate('clear')} className="text-[10px] font-bold text-rose-500 hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full text-[11px] font-semibold h-7 px-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-[11px] font-semibold h-7 px-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
            {/* Quick date presets */}
            <div className="flex items-center gap-1 mt-2.5 flex-wrap">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yest' },
                { id: 'last7', label: '7D' },
                { id: 'mtd', label: 'MTD' },
                { id: 'clear', label: 'All' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setQuickDate(p.id as any)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 shadow-xs"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slicer 2: Route Code */}
          <div
            className="p-3 rounded-xl flex flex-col justify-between transition-all bg-slate-50/70 dark:bg-slate-800/50 border"
            style={{
              borderColor: selectedRoute ? 'var(--accent)' : 'var(--border-soft)',
              boxShadow: selectedRoute ? '0 0 10px -2px rgba(99,102,241,0.15)' : 'none',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Navigation className="h-3 w-3" />
                  </span>
                  2. Route Code
                </span>
                {selectedRoute && (
                  <button onClick={() => setSelectedRoute('')} className="text-[10px] font-bold text-rose-500 hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Select Route</label>
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="w-full text-[12px] font-bold font-mono h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Routes ({routeOptions.length})</option>
                {routeOptions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} ({r.count})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] font-semibold mt-2 truncate text-slate-400 dark:text-slate-500">
              {selectedRoute ? `Active: Route ${selectedRoute}` : `${routeOptions.length} distinct routes`}
            </p>
          </div>

          {/* Slicer 3: Customer Code */}
          <div
            className="p-3 rounded-xl flex flex-col justify-between transition-all bg-slate-50/70 dark:bg-slate-800/50 border"
            style={{
              borderColor: customerCodeFilter ? 'var(--accent)' : 'var(--border-soft)',
              boxShadow: customerCodeFilter ? '0 0 10px -2px rgba(99,102,241,0.15)' : 'none',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Store className="h-3 w-3" />
                  </span>
                  3. Customer Code
                </span>
                {customerCodeFilter && (
                  <button onClick={() => setCustomerCodeFilter('')} className="text-[10px] font-bold text-rose-500 hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Search / Pick Code</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. C41884..."
                  value={customerCodeFilter}
                  onChange={(e) => setCustomerCodeFilter(e.target.value)}
                  list="customer-code-slicer-list"
                  className="w-full text-[12px] font-bold font-mono h-8 pl-2 pr-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {customerCodeFilter && (
                  <button
                    onClick={() => setCustomerCodeFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <datalist id="customer-code-slicer-list">
                  {customerCodeSuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <p className="text-[10px] font-semibold mt-2 truncate text-slate-400 dark:text-slate-500">
              {customerCodeFilter ? `Filter: "${customerCodeFilter}"` : 'Type or select customer code'}
            </p>
          </div>

          {/* Slicer 4: Customer Name */}
          <div
            className="p-3 rounded-xl flex flex-col justify-between transition-all bg-slate-50/70 dark:bg-slate-800/50 border"
            style={{
              borderColor: customerNameFilter ? 'var(--accent)' : 'var(--border-soft)',
              boxShadow: customerNameFilter ? '0 0 10px -2px rgba(99,102,241,0.15)' : 'none',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Building className="h-3 w-3" />
                  </span>
                  4. Customer Name
                </span>
                {customerNameFilter && (
                  <button onClick={() => setCustomerNameFilter('')} className="text-[10px] font-bold text-rose-500 hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Search / Pick Name</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Al Meera, Lulu..."
                  value={customerNameFilter}
                  onChange={(e) => setCustomerNameFilter(e.target.value)}
                  list="customer-name-slicer-list"
                  className="w-full text-[12px] font-semibold h-8 pl-2 pr-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {customerNameFilter && (
                  <button
                    onClick={() => setCustomerNameFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <datalist id="customer-name-slicer-list">
                  {customerNameSuggestions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
            </div>
            <p className="text-[10px] font-semibold mt-2 truncate text-slate-400 dark:text-slate-500">
              {customerNameFilter ? `Filter: "${customerNameFilter}"` : 'Type outlet or supermarket'}
            </p>
          </div>

          {/* Slicer 5: Supervisor */}
          <div
            className="p-3 rounded-xl flex flex-col justify-between transition-all bg-slate-50/70 dark:bg-slate-800/50 border"
            style={{
              borderColor: selectedSupervisor ? 'var(--accent)' : 'var(--border-soft)',
              boxShadow: selectedSupervisor ? '0 0 10px -2px rgba(99,102,241,0.15)' : 'none',
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <UserCheck className="h-3 w-3" />
                  </span>
                  5. Supervisor
                </span>
                {selectedSupervisor && (
                  <button onClick={() => setSelectedSupervisor('')} className="text-[10px] font-bold text-rose-500 hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Select Supervisor</label>
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="w-full text-[12px] font-bold h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Supervisors ({supervisorOptions.length})</option>
                {supervisorOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.count})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] font-semibold mt-2 truncate text-slate-400 dark:text-slate-500">
              {selectedSupervisor ? `Supervisor: ${supervisorOptions.find(o => o.id === selectedSupervisor)?.name || selectedSupervisor}` : `${supervisorOptions.length} active supervisors`}
            </p>
          </div>
        </div>

        {/* Active Slicers Removable Chips */}
        {activeSlicersCount > 0 && (
          <div className="flex items-center gap-2 pt-2 flex-wrap text-[11px] border-t border-slate-200/60 dark:border-slate-800/60">
            <span className="font-extrabold text-slate-400 dark:text-slate-500">Active Filters:</span>
            {(fromDate || toDate) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/30">
                Dates: {fromDate || 'Start'} to {toDate || 'Now'}
                <button onClick={() => { setFromDate(''); setToDate(''); }} className="hover:opacity-70 ml-1"><X className="h-3 w-3" /></button>
              </span>
            )}
            {selectedRoute && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/30">
                Route: {selectedRoute}
                <button onClick={() => setSelectedRoute('')} className="hover:opacity-70 ml-1"><X className="h-3 w-3" /></button>
              </span>
            )}
            {customerCodeFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/30">
                Code: {customerCodeFilter}
                <button onClick={() => setCustomerCodeFilter('')} className="hover:opacity-70 ml-1"><X className="h-3 w-3" /></button>
              </span>
            )}
            {customerNameFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                Customer: {customerNameFilter}
                <button onClick={() => setCustomerNameFilter('')} className="hover:opacity-70 ml-1"><X className="h-3 w-3" /></button>
              </span>
            )}
            {selectedSupervisor && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30">
                Supervisor: {supervisorOptions.find(o => o.id === selectedSupervisor)?.name || selectedSupervisor}
                <button onClick={() => setSelectedSupervisor('')} className="hover:opacity-70 ml-1"><X className="h-3 w-3" /></button>
              </span>
            )}
            <span className="text-slate-400 dark:text-slate-500 ml-auto font-mono text-[10px] font-bold">
              Showing {filtered.length} of {visits.length} records
            </span>
          </div>
        )}
      </div>

      {/* ── Toolbar: Search & Status Pills ─────────────────────── */}
      <div className="rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500" />
          <input
            type="text"
            placeholder="Search by ID, reason, observation, route…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs font-semibold pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick status pills with live counts */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex-shrink-0">
          {[
            { id: 'All', label: 'All', count: visits.length },
            { id: 'Draft', label: 'Draft', count: draftCount },
            { id: 'Submitted', label: 'Submitted', count: submittedCount },
          ].map((s) => {
            const isActive = statusFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{s.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {s.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Visits Table ───────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <TH>Supervisor</TH>
                <TH>Route</TH>
                <TH>Type</TH>
                <TH>Customer / Outlet</TH>
                <TH>Temperature</TH>
                <TH>Status</TH>
                <TH>Date & Time</TH>
                <TH right>Actions</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-1">
                        <Filter className="h-6 w-6" />
                      </div>
                      <p className="font-extrabold text-sm text-slate-900 dark:text-white">No visit records match the selected slicers</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Try adjusting your date range, route, customer, or supervisor slicers.</p>
                      {activeSlicersCount > 0 && (
                        <button
                          onClick={resetAllSlicers}
                          className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-500 text-white shadow-md hover:bg-indigo-600 transition-colors"
                        >
                          Clear All Slicers
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((v) => {
                  const display = getVisitDisplay(v);
                  const initials = (display.supervisorName || 'SUP')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={v.visitId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Supervisor: Name + ID + Initials Avatar */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-[11px] flex items-center justify-center shadow-xs flex-shrink-0">
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-black text-slate-900 dark:text-white leading-tight">
                              {display.supervisorName}
                            </span>
                            {v.supervisorName && (
                              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                {v.supervisorId}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Route Code */}
                      <td className="px-5 py-3.5">
                        <span className="inline-block px-2.5 py-1 rounded-lg font-mono font-bold text-[12px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-xs">
                          {display.routeLabel}
                        </span>
                      </td>

                      {/* Visit Type */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                              display.isNoVisit
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${display.isNoVisit ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            {display.typeLabel}
                          </span>
                          {display.isNoVisit && v.reason_category && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[120px]">{v.reason_category}</p>
                          )}
                        </div>
                      </td>

                      {/* Customer: Code + Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col max-w-[240px]">
                          <span className="font-mono text-[12px] font-black text-indigo-600 dark:text-indigo-400">
                            {display.customerLabel}
                          </span>
                          {display.customerName && (
                            <span
                              className="text-[12px] font-bold text-slate-800 dark:text-slate-200 truncate"
                              title={display.customerName}
                            >
                              {display.customerName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Temperature */}
                      <td className="px-5 py-3.5">
                        {v.status === 'Submitted' ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
                              display.isBreach
                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {display.isBreach ? '⚠' : '✓'} {display.tempLabel}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            v.status === 'Submitted'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'Submitted' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {v.status}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-slate-900 dark:text-white leading-tight">
                            {new Date(v.visit_datetime || v.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            {new Date(v.visit_datetime || v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenReview(v.visitId)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 shadow-xs transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteDialog({ open: true, id: v.visitId })}
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 hover:border-rose-300 shadow-xs transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination current={currentPage} total={totalPages} filtered={filtered.length} onChange={setCurrentPage} />
      </div>

      {/* ── Detail Modal ──────────────────────────────────────── */}
      {reviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setReviewId(null); setReviewData(null); }} />
          <div
            className="relative w-full max-w-3xl flex flex-col max-h-[88vh] animate-slide-up overflow-hidden"
            style={{
              background: 'var(--surface)', borderRadius: '16px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-dropdown)',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <div>
                  <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Visit Audit Details</p>
                  <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{reviewId}</p>
                </div>
              </div>
              <button
                onClick={() => { setReviewId(null); setReviewData(null); }}
                className="btn-ghost"
                style={{ height: '32px', width: '32px', padding: 0, justifyContent: 'center' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-grow overflow-y-auto p-6 space-y-5">
              {detailLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : reviewData ? (
                <>
                  {/* Info grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        label: 'Supervisor', children: (
                          <>
                            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {reviewData.visit.supervisorName || reviewData.visit.supervisorId}
                            </p>
                            {reviewData.visit.supervisorName && (
                              <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                ID: {reviewData.visit.supervisorId}
                              </p>
                            )}
                            <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <Clock className="h-3 w-3" />
                              {new Date(reviewData.visit.visit_datetime || reviewData.visit.createdAt).toLocaleString()}
                            </p>
                          </>
                        )
                      },
                      {
                        label: 'Customer / Outlet', children: (
                          <>
                            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {reviewData.visit.customerCode}
                            </p>
                            {reviewData.visit.customerName && (
                              <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {reviewData.visit.customerName}
                              </p>
                            )}
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Route: {reviewData.visit.routeCode}</p>
                          </>
                        )
                      },
                      {
                        label: 'GPS Location', children: (
                          <>
                            <p className="text-[12px] font-mono font-semibold flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                              <MapPin className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                              {reviewData.visit.latitude.toFixed(4)}, {reviewData.visit.longitude.toFixed(4)}
                            </p>
                            <a
                              href={`https://www.google.com/maps?q=${reviewData.visit.latitude},${reviewData.visit.longitude}`}
                              target="_blank" rel="noreferrer"
                              className="text-[11px] font-semibold mt-1 block hover:underline"
                              style={{ color: 'var(--accent)' }}
                            >
                              Open in Maps (±{reviewData.visit.accuracy.toFixed(0)}m)
                            </a>
                          </>
                        )
                      },
                    ].map(({ label, children }) => (
                      <div key={label} className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                        <p className="form-label mb-2">{label}</p>
                        {children}
                      </div>
                    ))}
                  </div>

                  {/* Assets and Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(reviewData.assets || []).map((ast, index) => (
                      <div key={ast.assetId} className="p-4 rounded-xl space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold uppercase" style={{ color: 'var(--text-primary)' }}>
                            {ast.assetType} #{index + 1}
                          </span>
                          <span className={`badge ${ast.tempInRange ? 'badge-success' : 'badge-danger'}`}>
                            {ast.temperature}°C {ast.tempInRange ? '✓ In Range' : '⚠ Breach'}
                          </span>
                        </div>
                        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          Action Required: <span className="font-semibold text-[var(--accent)]">{ast.actionRequired}</span>
                        </p>
                        {ast.observation && (
                          <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>
                            &ldquo;{ast.observation}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {reviewData.visit.sosAsPerBda !== null && reviewData.visit.sosAsPerBda !== undefined && (
                    <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                      <p className="form-label mb-1">Share of Shelf (SOS)</p>
                      <span className={`badge ${reviewData.visit.sosAsPerBda ? 'badge-success' : 'badge-danger'}`}>
                        {reviewData.visit.sosAsPerBda ? 'Compliant ✓' : 'Non-Compliant ⚠'}
                      </span>
                    </div>
                  )}

                  {/* Photos */}
                  <div>
                    <p className="form-label mb-3">Audit Attachments ({reviewData.photos.length})</p>
                    {reviewData.photos.length === 0 ? (
                      <p className="text-[12px] italic" style={{ color: 'var(--text-muted)' }}>No photos attached.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {reviewData.photos.map((photo, i) => (
                          <div
                            key={photo.photoId}
                            onClick={() => setVisitPhotoIndex(i)}
                            className="block rounded-xl overflow-hidden cursor-pointer group relative shadow-xs hover:shadow-md transition-all"
                            style={{ border: '1px solid var(--border)', aspectRatio: '1' }}
                          >
                            <img src={photo.cloudinaryUrl} alt={photo.category} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                            <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] font-bold text-white uppercase">
                              {photo.category || 'Photo'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* NPD */}
                  <div>
                    <p className="form-label mb-3">NPD SKU Checklist ({reviewData.npdResponses.length})</p>
                    {reviewData.npdResponses.length === 0 ? (
                      <p className="text-[12px] italic" style={{ color: 'var(--text-muted)' }}>No SKU responses recorded.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {reviewData.npdResponses.map((npd) => (
                          <div
                            key={npd.responseId}
                            className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}
                          >
                            <span className="font-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{npd.skuCode}</span>
                            <span className={`badge ${npd.status === 'Available' ? 'badge-success' : npd.status === 'Not Available' ? 'badge-danger' : 'badge-warning'}`}>
                              {npd.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>Failed to load visit data.</div>
              )}
            </div>

            <div className="px-6 py-4 flex justify-end flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { setReviewId(null); setReviewData(null); }}
                className="btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Visit Log"
        description="Permanently delete this visit log and all related photos and NPD responses. This cannot be undone."
        confirmText="Delete permanently"
        variant="danger"
      />

      {/* Visit Review Lightbox Modal */}
      {reviewData && (
        <ImageLightboxModal
          photos={reviewData.photos.map((p) => ({
            ...p,
            outlet: reviewData.visit.customerName || reviewData.visit.customerCode || 'Visit Attachment',
            supervisor: reviewData.visit.supervisorName || reviewData.visit.supervisorId,
            route: reviewData.visit.routeCode,
            uploadedAt: p.uploadedAt || reviewData.visit.createdAt,
          }))}
          currentIndex={visitPhotoIndex ?? 0}
          isOpen={visitPhotoIndex !== null}
          onClose={() => setVisitPhotoIndex(null)}
          onNavigate={(idx) => setVisitPhotoIndex(idx)}
          title={`Visit #${reviewData.visit.visitId.slice(-6)} Attachments`}
        />
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
