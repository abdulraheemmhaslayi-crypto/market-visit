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
      className={`px-5 py-3 text-left ${right ? 'text-right' : ''}`}
      style={{
        fontSize: '10px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--text-muted)', whiteSpace: 'nowrap',
        background: 'var(--surface-2)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {children}
    </th>
  );
}

function PageHeader({ title, sub, count }: { title: string; sub: string; count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 p-1 flex items-center justify-center shadow-xs border border-[var(--border)] flex-shrink-0">
        <img src="/images/dandy-logo.png" alt="Dandy Logo" className="h-full w-auto object-contain" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          {count !== undefined && (
            <span className="badge badge-accent">{count}</span>
          )}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</p>
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
    return {
      isNoVisit,
      typeLabel: isNoVisit ? 'No Visit' : 'Visit',
      typeClass: isNoVisit ? 'badge-warning' : 'badge-success',
      routeLabel: isNoVisit ? '—' : (v.routeCode || '—'),
      customerLabel: isNoVisit ? 'No outlet selected' : (v.customerCode || '—'),
      customerName: v.customerName || '',
      supervisorName: v.supervisorName || v.supervisorId,
      tempLabel: isNoVisit ? 'N/A' : `${v.temperature ?? 0}°C ${v.tempInRange ? '✓' : '⚠'}`,
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
        className="card p-4 space-y-3.5"
        style={{
          border: activeSlicersCount > 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
          boxShadow: activeSlicersCount > 0 ? '0 0 12px -3px rgba(37,99,235,0.12)' : 'none',
        }}
      >
        {/* Slicers Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Admin Slicers
            </span>
            {activeSlicersCount > 0 ? (
              <span className="badge badge-accent text-[10px] font-bold">
                {activeSlicersCount} active
              </span>
            ) : (
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Filter across 5 dimensions
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Live sync indicator */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-solid border-[var(--border-soft)] bg-[var(--surface-2)] text-[10px] font-bold font-mono text-[var(--text-muted)] h-7">
              <span 
                className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--success)] animate-pulse'}`} 
                style={{
                  boxShadow: isSyncing ? '0 0 8px var(--accent)' : '0 0 8px var(--success)'
                }}
              />
              <span>{isSyncing ? 'SYNCING...' : 'LIVE SYNC'}</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            {/* Reset Slicers Button */}
            <button
              onClick={resetAllSlicers}
              disabled={activeSlicersCount === 0 && !search && statusFilter === 'All'}
              className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: activeSlicersCount > 0 ? 'var(--accent-light, rgba(37,99,235,0.1))' : 'var(--surface-2)',
                color: activeSlicersCount > 0 ? 'var(--accent)' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
              title="Reset all filters and slicers"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Slicers
            </button>
          </div>
        </div>

        {/* 5 Slicers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Slicer 1: Dates Slicer (From & To Date) */}
          <div className="p-2.5 rounded-xl flex flex-col justify-between" style={{ background: 'var(--surface-2)', border: (fromDate || toDate) ? '1px solid var(--accent)' : '1px solid var(--border-soft)' }}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Calendar className="h-3.5 w-3.5 text-[var(--accent)]" />
                  1. Dates (From - To)
                </span>
                {(fromDate || toDate) && (
                  <button onClick={() => setQuickDate('clear')} className="text-[10px] text-[var(--danger)] hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-muted)' }}>From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="form-input text-[11px] h-7 px-1.5 w-full bg-[var(--surface)]"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-muted)' }}>To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="form-input text-[11px] h-7 px-1.5 w-full bg-[var(--surface)]"
                  />
                </div>
              </div>
            </div>
            {/* Quick date presets */}
            <div className="flex items-center gap-1 mt-2 flex-wrap">
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
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slicer 2: Route Code */}
          <div className="p-2.5 rounded-xl flex flex-col justify-between" style={{ background: 'var(--surface-2)', border: selectedRoute ? '1px solid var(--accent)' : '1px solid var(--border-soft)' }}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Navigation className="h-3.5 w-3.5 text-[var(--accent)]" />
                  2. Route Code
                </span>
                {selectedRoute && (
                  <button onClick={() => setSelectedRoute('')} className="text-[10px] text-[var(--danger)] hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <label className="text-[9px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-muted)' }}>Select Route</label>
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="form-input text-[12px] h-8 px-2 w-full bg-[var(--surface)] font-mono"
              >
                <option value="">All Routes ({routeOptions.length})</option>
                {routeOptions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} ({r.count})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] mt-1.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {selectedRoute ? `Active: Route ${selectedRoute}` : `${routeOptions.length} distinct routes`}
            </p>
          </div>

          {/* Slicer 3: Customer Code */}
          <div className="p-2.5 rounded-xl flex flex-col justify-between" style={{ background: 'var(--surface-2)', border: customerCodeFilter ? '1px solid var(--accent)' : '1px solid var(--border-soft)' }}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Store className="h-3.5 w-3.5 text-[var(--accent)]" />
                  3. Customer Code
                </span>
                {customerCodeFilter && (
                  <button onClick={() => setCustomerCodeFilter('')} className="text-[10px] text-[var(--danger)] hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <label className="text-[9px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-muted)' }}>Search / Pick Code</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. C41884..."
                  value={customerCodeFilter}
                  onChange={(e) => setCustomerCodeFilter(e.target.value)}
                  list="customer-code-slicer-list"
                  className="form-input text-[12px] h-8 pl-2 pr-7 w-full bg-[var(--surface)] font-mono"
                />
                {customerCodeFilter && (
                  <button
                    onClick={() => setCustomerCodeFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--danger)]"
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
            <p className="text-[10px] mt-1.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {customerCodeFilter ? `Filter: "${customerCodeFilter}"` : 'Type or select customer code'}
            </p>
          </div>

          {/* Slicer 4: Customer Name */}
          <div className="p-2.5 rounded-xl flex flex-col justify-between" style={{ background: 'var(--surface-2)', border: customerNameFilter ? '1px solid var(--accent)' : '1px solid var(--border-soft)' }}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Building className="h-3.5 w-3.5 text-[var(--accent)]" />
                  4. Customer Name
                </span>
                {customerNameFilter && (
                  <button onClick={() => setCustomerNameFilter('')} className="text-[10px] text-[var(--danger)] hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <label className="text-[9px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-muted)' }}>Search / Pick Name</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Al Meera, Lulu..."
                  value={customerNameFilter}
                  onChange={(e) => setCustomerNameFilter(e.target.value)}
                  list="customer-name-slicer-list"
                  className="form-input text-[12px] h-8 pl-2 pr-7 w-full bg-[var(--surface)]"
                />
                {customerNameFilter && (
                  <button
                    onClick={() => setCustomerNameFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--danger)]"
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
            <p className="text-[10px] mt-1.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {customerNameFilter ? `Filter: "${customerNameFilter}"` : 'Type outlet or supermarket'}
            </p>
          </div>

          {/* Slicer 5: Supervisor */}
          <div className="p-2.5 rounded-xl flex flex-col justify-between" style={{ background: 'var(--surface-2)', border: selectedSupervisor ? '1px solid var(--accent)' : '1px solid var(--border-soft)' }}>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <UserCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                  5. Supervisor
                </span>
                {selectedSupervisor && (
                  <button onClick={() => setSelectedSupervisor('')} className="text-[10px] text-[var(--danger)] hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <label className="text-[9px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-muted)' }}>Select Supervisor</label>
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="form-input text-[12px] h-8 px-2 w-full bg-[var(--surface)]"
              >
                <option value="">All Supervisors ({supervisorOptions.length})</option>
                {supervisorOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.count})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] mt-1.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {selectedSupervisor ? `Supervisor: ${supervisorOptions.find(o => o.id === selectedSupervisor)?.name || selectedSupervisor}` : `${supervisorOptions.length} active supervisors`}
            </p>
          </div>
        </div>

        {/* Active Slicers Removable Chips */}
        {activeSlicersCount > 0 && (
          <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
            <span className="font-semibold text-[var(--text-muted)]">Active Slicers:</span>
            {(fromDate || toDate) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-light,rgba(37,99,235,0.1))] text-[var(--accent)] font-medium border border-[var(--accent)]/20">
                Dates: {fromDate || 'Start'} to {toDate || 'Now'}
                <button onClick={() => { setFromDate(''); setToDate(''); }} className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            )}
            {selectedRoute && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-light,rgba(37,99,235,0.1))] text-[var(--accent)] font-medium border border-[var(--accent)]/20">
                Route: {selectedRoute}
                <button onClick={() => setSelectedRoute('')} className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            )}
            {customerCodeFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-light,rgba(37,99,235,0.1))] text-[var(--accent)] font-medium border border-[var(--accent)]/20">
                Code: {customerCodeFilter}
                <button onClick={() => setCustomerCodeFilter('')} className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            )}
            {customerNameFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-light,rgba(37,99,235,0.1))] text-[var(--accent)] font-medium border border-[var(--accent)]/20">
                Customer: {customerNameFilter}
                <button onClick={() => setCustomerNameFilter('')} className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            )}
            {selectedSupervisor && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-light,rgba(37,99,235,0.1))] text-[var(--accent)] font-medium border border-[var(--accent)]/20">
                Supervisor: {supervisorOptions.find(o => o.id === selectedSupervisor)?.name || selectedSupervisor}
                <button onClick={() => setSelectedSupervisor('')} className="hover:opacity-70"><X className="h-3 w-3" /></button>
              </span>
            )}
            <span className="text-[var(--text-muted)] ml-auto font-mono text-[10px]">
              Showing {filtered.length} of {visits.length} records
            </span>
          </div>
        )}
      </div>

      {/* ── Toolbar: Search & Status Pills ─────────────────────── */}
      <div className="card p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by ID, reason, observation, route…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9 text-[12px] h-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--danger)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick status pills */}
        <div
          className="flex items-center gap-1 p-1 rounded-lg flex-shrink-0"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          {['All', 'Draft', 'Submitted'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 h-7 rounded-md text-[12px] font-semibold transition-all cursor-pointer"
              style={{
                background: statusFilter === s ? 'var(--surface)' : 'transparent',
                color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: statusFilter === s ? 'var(--shadow-card)' : 'none',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Visits Table ───────────────────────────────────────── */}
      <div className="card overflow-hidden">
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
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter className="h-8 w-8 opacity-40 text-[var(--accent)]" />
                      <p className="font-semibold text-[var(--text-primary)]">No visit records match the selected slicers</p>
                      <p className="text-[12px]">Try adjusting your date range, route, customer, or supervisor slicers.</p>
                      {activeSlicersCount > 0 && (
                        <button
                          onClick={resetAllSlicers}
                          className="btn-secondary text-[11px] mt-2"
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
                  return (
                    <tr
                      key={v.visitId}
                      style={{ borderBottom: '1px solid var(--border-soft)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      className="transition-colors"
                    >
                      {/* Supervisor: Name + ID */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {display.supervisorName}
                          </span>
                          {v.supervisorName && (
                            <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {v.supervisorId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Route Code */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[12px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                          {display.routeLabel}
                        </span>
                      </td>

                      {/* Visit Type */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <span className={`badge ${display.typeClass}`}>{display.typeLabel}</span>
                          {display.isNoVisit && v.reason_category && (
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{v.reason_category}</p>
                          )}
                        </div>
                      </td>

                      {/* Customer: Code + Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col max-w-[240px]">
                          <span className="font-mono text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                            {display.customerLabel}
                          </span>
                          {display.customerName && (
                            <span
                              className="text-[11px] truncate text-ellipsis"
                              style={{ color: 'var(--text-muted)' }}
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
                          <span className={`badge ${display.tempClass}`}>
                            {display.tempLabel}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`badge ${v.status === 'Submitted' ? 'badge-success' : 'badge-warning'}`}>
                          {v.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                            {new Date(v.visit_datetime || v.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                            {new Date(v.visit_datetime || v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenReview(v.visitId)}
                            className="btn-ghost"
                            style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteDialog({ open: true, id: v.visitId })}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              height: '30px', padding: '0 10px',
                              background: 'var(--danger-light)', color: 'var(--danger)',
                              border: '1px solid rgba(220,38,38,0.15)', borderRadius: '6px',
                              fontSize: '12px', cursor: 'pointer',
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
