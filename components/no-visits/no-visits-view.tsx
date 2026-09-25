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
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days'>('all');
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
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

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
      if (dateRangeFilter !== 'all') {
        const itemDateStr = item.date.split('T')[0];
        const itemDate = new Date(item.date);

        if (dateRangeFilter === 'today' && itemDateStr !== todayStr) return false;
        if (dateRangeFilter === 'yesterday' && itemDateStr !== yesterdayStr) return false;
        if (dateRangeFilter === '7days' && itemDate < sevenDaysAgo) return false;
        if (dateRangeFilter === '30days' && itemDate < thirtyDaysAgo) return false;
      }

      return true;
    });
  }, [visits, search, categoryFilter, supervisorFilter, dateRangeFilter, role]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, supervisorFilter, dateRangeFilter, pageSize]);

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
  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedVisits = filteredVisits.slice(startIndex, startIndex + pageSize);

  // Clear filters
  const isFiltered = search !== '' || categoryFilter !== 'All' || supervisorFilter !== 'All' || dateRangeFilter !== 'all';
  const handleClearFilters = () => {
    setSearch('');
    setCategoryFilter('All');
    setSupervisorFilter('All');
    setDateRangeFilter('all');
  };

  // Export to Excel
  const handleExport = () => {
    if (filteredVisits.length === 0) {
      showToast('No records available to export.', 'warning');
      return;
    }

    const columns = [
      { header: 'Visit ID', key: 'visitId' },
      {
        header: 'Visit Date & Time',
        key: 'date',
        formatter: (val: string) => (val ? new Date(val).toLocaleString('en-IN') : '—'),
      },
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
      { header: 'Channel', key: 'channel' },
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              No Visit Records
            </h1>
            <span className="badge badge-accent">
              {metrics.total} {metrics.total === 1 ? 'record' : 'records'}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Outlet visits skipped with recorded reasons, supervisor notes, and photo proofs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNoVisits(true)}
            disabled={refreshing || loading}
            className="btn-ghost flex items-center gap-1.5"
            style={{ height: '36px', padding: '0 12px', fontSize: '12px' }}
            title="Refresh records"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <ExportButton onClick={handleExport} label="Export Excel" variant="default" />
        </div>
      </div>

      {/* ─── KPI Metrics Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="panel p-3.5 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Total Skipped
            </div>
            <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {loading ? <Skeleton className="h-6 w-12" /> : metrics.total}
            </div>
          </div>
        </div>

        <div className="panel p-3.5 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6' }}
          >
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Today's Skipped
            </div>
            <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {loading ? <Skeleton className="h-6 w-12" /> : metrics.todayCount}
            </div>
          </div>
        </div>

        <div className="panel p-3.5 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#CA8A04' }}
          >
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Outlets Affected
            </div>
            <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {loading ? <Skeleton className="h-6 w-12" /> : metrics.uniqueOutlets}
            </div>
          </div>
        </div>

        <div className="panel p-3.5 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#A855F7' }}
          >
            <Tag className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Top Reason
            </div>
            <div className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }} title={metrics.topReason}>
              {loading ? <Skeleton className="h-6 w-24" /> : metrics.topReason}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ─── */}
      <div className="panel p-3.5">
        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search outlet, supervisor, route, reason..."
              className="form-input pl-9 pr-8 text-[12px] h-9 w-full"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] hidden sm:inline">Reason:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="form-input text-[12px] h-9 py-1 px-2.5"
              >
                <option value="All">All Reasons</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Supervisor Filter (Admin Only) */}
            {role === 'admin' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] hidden sm:inline">Supervisor:</span>
                <select
                  value={supervisorFilter}
                  onChange={(e) => setSupervisorFilter(e.target.value)}
                  className="form-input text-[12px] h-9 py-1 px-2.5 max-w-[160px]"
                >
                  <option value="All">All Supervisors</option>
                  {availableSupervisors.map((sup) => (
                    <option key={sup} value={sup}>
                      {sup}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range Preset */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] hidden sm:inline">Date:</span>
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as any)}
                className="form-input text-[12px] h-9 py-1 px-2.5"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>

            {/* Clear Filters */}
            {isFiltered && (
              <button
                onClick={handleClearFilters}
                className="btn-ghost text-[11px] h-9 px-2 flex items-center gap-1 text-[var(--danger)]"
                title="Reset all filters"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Table Section ─── */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Date & Time
                </th>
                {role === 'admin' && (
                  <th className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    Supervisor
                  </th>
                )}
                <th className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Route
                </th>
                <th className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Outlet
                </th>
                <th className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Reason Category
                </th>
                <th className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Remarks / Note
                </th>
                <th className="px-4 py-3 text-center font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Proof
                </th>
                <th className="px-4 py-3 text-right font-bold text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    {role === 'admin' && <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>}
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-7 w-16 ml-auto rounded" /></td>
                  </tr>
                ))
              ) : paginatedVisits.length === 0 ? (
                <tr>
                  <td colSpan={role === 'admin' ? 8 : 7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                      >
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-[13px] text-[var(--text-primary)]">No skipped visits found</p>
                      <p className="text-[12px] text-[var(--text-muted)] mt-1">
                        {isFiltered
                          ? 'No records match the current filters. Try changing or resetting your search filters.'
                          : 'There are currently no recorded No Visit audit logs.'}
                      </p>
                      {isFiltered && (
                        <button onClick={handleClearFilters} className="btn-secondary mt-3 text-[12px] py-1 px-3">
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
                    className="hover:bg-[var(--surface-2)] transition-colors"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-[var(--text-primary)]">
                        {new Date(row.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {new Date(row.date).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Supervisor (Admin Only) */}
                    {role === 'admin' && (
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--text-primary)] truncate max-w-[140px]" title={row.supervisorName}>
                          {row.supervisorName}
                        </div>
                        {row.supervisorCode && (
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">{row.supervisorCode}</div>
                        )}
                      </td>
                    )}

                    {/* Route */}
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-[var(--text-primary)]">{row.routeCode || '—'}</div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[120px]" title={row.routeName}>
                        {row.routeName || '—'}
                      </div>
                    </td>

                    {/* Outlet */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--text-primary)] truncate max-w-[160px]" title={row.customerName}>
                        {row.customerName || '—'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {row.customerCode && (
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">{row.customerCode}</span>
                        )}
                        {row.channel && (
                          <span className="text-[9px] px-1 rounded bg-[var(--surface-2)] text-[var(--text-secondary)] font-medium">
                            {row.channel}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Reason Category */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`badge ${getCategoryBadgeClass(row.reasonCategory)}`}>
                        {row.reasonCategory || 'Other'}
                      </span>
                    </td>

                    {/* Reason / Remarks */}
                    <td className="px-4 py-3">
                      <p className="text-[var(--text-secondary)] line-clamp-2 max-w-xs" title={row.reason || '—'}>
                        {row.reason || '—'}
                      </p>
                    </td>

                    {/* Photos Count */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.photos && row.photos.length > 0 ? (
                        <button
                          onClick={() => setSelectedVisit(row)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                          title="View attached photo proof"
                        >
                          <Camera className="h-3 w-3" />
                          <span>{row.photos.length}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedVisit(row)}
                        className="btn-ghost inline-flex items-center gap-1 text-[11px] py-1 px-2.5"
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
                {filteredVisits.length === 0 ? 0 : startIndex + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-[var(--text-primary)]">
                {Math.min(startIndex + pageSize, filteredVisits.length)}
              </strong>{' '}
              of <strong className="text-[var(--text-primary)]">{filteredVisits.length}</strong> records
            </span>

            <div className="flex items-center gap-1.5 pl-2" style={{ borderLeft: '1px solid var(--border)' }}>
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="form-input text-[11px] h-7 py-0 px-2"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          {totalPages > 1 && (
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
