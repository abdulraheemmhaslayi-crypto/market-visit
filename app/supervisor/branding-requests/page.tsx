'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Tag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  Store,
  Camera,
  X,
  History,
  User,
  ShieldCheck,
  Maximize2,
  Layers,
  ChevronDown,
  Download,
  Presentation,
  FileSpreadsheet,
} from 'lucide-react';
import { exportToExcel } from '@/utils/excelExport';
import {
  exportBrandingToExcelWithPhotos,
  exportBrandingToPowerPoint,
} from '@/utils/brandingExport';
import { AssetBrandingRequest } from '@/lib/asset-branding';

export default function SupervisorBrandingRequestsPage() {
  const { data: session } = useSession();
  const currentSupervisorName = session?.user?.name || '';

  const [requests, setRequests] = useState<AssetBrandingRequest[]>([]);
  const [counts, setCounts] = useState<{ total: number; pending: number; acknowledged: number }>({
    total: 0,
    pending: 0,
    acknowledged: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'acknowledged'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedClassification, setSelectedClassification] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Export State & Progress
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    isExporting: boolean;
    message: string;
    current: number;
    total: number;
  } | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Details Modal
  const [activeRequest, setActiveRequest] = useState<AssetBrandingRequest | null>(null);
  const [outletHistory, setOutletHistory] = useState<AssetBrandingRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [fullPhotoViewer, setFullPhotoViewer] = useState<string | null>(null);

  // Close export dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      params.set('portal', 'supervisor');
      if (currentSupervisorName) params.set('supervisorName', currentSupervisorName);
      if (statusFilter === 'pending') params.set('status', 'Pending Acknowledgement');
      if (statusFilter === 'acknowledged') params.set('status', 'Acknowledged');
      if (selectedRoute !== 'all') params.set('routeCode', selectedRoute);
      if (selectedClassification !== 'all') params.set('classification', selectedClassification);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await fetch(`/api/branding-requests?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
        if (data.counts) setCounts(data.counts);
      }
    } catch (err) {
      console.error('Error loading branding requests:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentSupervisorName, statusFilter, selectedRoute, selectedClassification, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchRequests(false);
  }, [fetchRequests]);

  const availableRoutes = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.routeCode && r.routeCode !== 'N/A') set.add(r.routeCode);
    });
    return Array.from(set).sort();
  }, [requests]);

  const handleOpenDetails = async (reqItem: AssetBrandingRequest) => {
    setActiveRequest(reqItem);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/branding-requests?outletCode=${encodeURIComponent(reqItem.outletCode)}&history=true`);
      if (res.ok) {
        const data = await res.json();
        setOutletHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load outlet branding history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setSelectedRoute('all');
    setSelectedClassification('all');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
  };

  // Standard Excel (Table Only)
  const handleExportExcelTable = () => {
    exportToExcel({
      filename: `My_Asset_Branding_Requests_${new Date().toISOString().split('T')[0]}`,
      title: 'My Asset Branding Requests Log',
      filterSummary: `Status: ${statusFilter} | Classification: ${selectedClassification} | Route: ${selectedRoute} | Search: "${searchQuery}"`,
      columns: [
        { header: 'Request ID', key: 'requestNumber' },
        { header: 'Outlet Code', key: 'outletCode' },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Route', key: 'routeCode' },
        { header: 'Classification', key: 'classification', formatter: (val: any) => val ? `Class ${val}` : 'Class C' },
        { header: 'Supervisor Notes', key: 'notes', formatter: (val: any, row: any) => val || row.brandingScope || '—' },
        { header: 'Requested Date', key: 'createdAt', formatter: (val: any) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Status', key: 'status' },
        { header: 'Acknowledged By', key: 'acknowledgedByName', formatter: (val: any) => val || '—' },
        { header: 'Acknowledged Date', key: 'acknowledgedAt', formatter: (val: any) => val ? new Date(val).toLocaleString() : '—' },
      ],
      data: requests,
    });
  };

  // Export With Photos (Excel or PPT)
  const handleExportWithPhotos = async (type: 'excel' | 'pptx') => {
    setExportMenuOpen(false);
    if (requests.length === 0) return;

    setExportProgress({
      isExporting: true,
      message: type === 'excel' ? 'Preparing Excel workbook with embedded photos...' : 'Generating PowerPoint presentation deck...',
      current: 0,
      total: requests.length,
    });

    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const filterSummary = `Supervisor: ${currentSupervisorName} | Status: ${statusFilter} | Classification: ${selectedClassification} | Route: ${selectedRoute} | Total Records: ${requests.length}`;

      if (type === 'excel') {
        await exportBrandingToExcelWithPhotos(requests, {
          filename: `My_Asset_Branding_Requests_With_Photos_${dateStr}.xlsx`,
          filterSummary,
          onProgress: (current, total, message) => {
            setExportProgress({ isExporting: true, current, total, message });
          },
        });
      } else {
        await exportBrandingToPowerPoint(requests, {
          filename: `My_Asset_Branding_Report_${dateStr}.pptx`,
          filterSummary,
          onProgress: (current, total, message) => {
            setExportProgress({ isExporting: true, current, total, message });
          },
        });
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Failed to generate export file: ' + (err.message || 'Unknown error'));
    } finally {
      setTimeout(() => setExportProgress(null), 800);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent-soft)]">
            <Tag className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-[var(--text-primary)]">My Asset Branding Requests</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent-soft)]">
                Supervisor Portal
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Track asset branding requests raised during your visits and check management acknowledgement status.
            </p>
          </div>
        </div>

        {/* Export & Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap relative" ref={exportMenuRef}>
          {/* Export Dropdown with Excel & PPT Options */}
          <div className="relative">
            <button
              type="button"
              disabled={requests.length === 0}
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              <span>Export Report</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu Popover */}
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-2 z-40 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  type="button"
                  onClick={() => handleExportWithPhotos('excel')}
                  className="w-full p-2.5 rounded-xl hover:bg-[var(--surface-2)] text-left transition-colors flex items-start gap-3 cursor-pointer group"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      Excel (.xlsx) with Photos
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                      Spreadsheet with photos embedded in each row
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportWithPhotos('pptx')}
                  className="w-full p-2.5 rounded-xl hover:bg-[var(--surface-2)] text-left transition-colors flex items-start gap-3 cursor-pointer group"
                >
                  <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 group-hover:scale-105 transition-transform">
                    <Presentation className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      PowerPoint (.pptx) with Photos
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                      Executive slide deck with full photos & shop profile
                    </span>
                  </div>
                </button>

                <div className="border-t border-[var(--border-soft)] my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExportExcelTable();
                  }}
                  className="w-full p-2 rounded-xl hover:bg-[var(--surface-2)] text-left transition-colors flex items-center gap-3 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <div className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold">
                    Excel Table Only (No Photos)
                  </span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchRequests(true)}
            disabled={isRefreshing}
            className="btn-ghost flex items-center gap-1.5 text-xs py-2 px-3 rounded-xl border border-[var(--border)] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">My Total Requests</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{counts.total}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center">
            <Tag className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-amber-500/30 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Pending Acknowledgement</p>
            <p className="text-2xl font-black text-amber-500 mt-1">{counts.pending}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-emerald-500/30 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Acknowledged</p>
            <p className="text-2xl font-black text-emerald-500 mt-1">{counts.acknowledged}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-3">
        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-soft)] pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            All Requests ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-black shadow-xs font-extrabold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Pending Acknowledgement ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('acknowledged')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'acknowledged'
                ? 'bg-emerald-500 text-white shadow-xs font-extrabold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Acknowledged ({counts.acknowledged})
          </button>
        </div>

        {/* Classification Slicer */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 pb-1">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mr-1 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-[var(--accent)]" /> Classification Slicer:
          </span>
          {['all', 'A', 'B', 'C', 'D', 'E'].map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => setSelectedClassification(cls)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedClassification === cls
                  ? 'bg-purple-600 text-white shadow-xs font-extrabold'
                  : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-purple-400 border border-[var(--border)]'
              }`}
            >
              {cls === 'all' ? 'All Classes' : `Class ${cls}`}
            </button>
          ))}
        </div>

        {/* Detailed Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search outlet, code, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All Routes</option>
              {availableRoutes.map((r) => (
                <option key={r} value={r}>
                  Route: {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]"
              title="From Date"
            />
            <span className="text-[var(--text-muted)] text-xs">-</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]"
              title="To Date"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] border border-[var(--border)] transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[var(--accent)]" />
            <p className="text-xs text-[var(--text-muted)]">Loading your branding requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Tag className="h-8 w-8 mx-auto text-[var(--text-muted)] opacity-50" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">No asset branding requests found</p>
            <p className="text-xs text-[var(--text-muted)]">You have not raised any branding requests matching these filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Outlet Name & Code</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Condition Photo</th>
                  <th className="py-3 px-4">My Notes</th>
                  <th className="py-3 px-4">Requested Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Acknowledgement</th>
                  <th className="py-3 px-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {requests.map((r) => {
                  const isPending = r.status === 'Pending Acknowledgement';
                  return (
                    <tr key={r.id} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[var(--accent)]">{r.requestNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--text-primary)]">{r.outletName}</div>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">{r.outletCode}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">{r.routeCode}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Class {r.classification || 'C'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {r.photoUrl ? (
                          <div
                            onClick={() => handleOpenDetails(r)}
                            className="relative h-11 w-16 rounded-lg overflow-hidden border border-[var(--border)] bg-black cursor-pointer group shadow-xs"
                            title="Click to view full photo and shop details"
                          >
                            <img src={r.photoUrl} alt="Asset condition" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="h-3.5 w-3.5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] italic">No Photo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-[var(--text-secondary)]" title={r.notes || r.brandingScope}>
                        {r.notes || r.brandingScope || '—'}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">
                        {new Date(r.createdAt).toLocaleDateString()}
                        <div className="text-[10px]">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="py-3 px-4">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Acknowledged
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {r.acknowledgedByName ? (
                          <div>
                            <span className="font-semibold text-emerald-500">{r.acknowledgedByName}</span>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleDateString() : '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] italic">Pending Review</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(r)}
                          className="p-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
                          title="View Full Shop Details & Submitted Photo"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full-Page Shop Details & Photo Modal */}
      {activeRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-5xl bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-soft)] bg-[var(--surface-2)]/60">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-black px-3 py-1 rounded-full bg-[var(--accent)] text-white shadow-xs uppercase tracking-wider">
                  {activeRequest.requestNumber}
                </span>
                <div>
                  <h3 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                    <Store className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    <span>{activeRequest.outletName}</span>
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono mt-0.5 flex-wrap">
                    <span>Outlet: <strong className="text-[var(--text-primary)]">{activeRequest.outletCode}</strong></span>
                    <span>•</span>
                    <span>Route: <strong className="text-[var(--text-primary)]">{activeRequest.routeCode}</strong></span>
                    <span>•</span>
                    <span className="px-1.5 py-0.2 rounded font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20">
                      Class {activeRequest.classification || 'C'}
                    </span>
                    <span>•</span>
                    <span>Channel: {activeRequest.channel || 'GT'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeRequest.status === 'Pending Acknowledgement' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Pending Acknowledgement
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Acknowledged by Admin
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setActiveRequest(null)}
                  className="p-2 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  title="Close Dialog"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Asset Condition Photo */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Camera className="h-4 w-4 text-[var(--accent)]" />
                      <span>My Submitted Asset Photo</span>
                    </h4>
                    {activeRequest.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setFullPhotoViewer(activeRequest.photoUrl || null)}
                        className="text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Maximize2 className="h-3 w-3" /> Full Size
                      </button>
                    )}
                  </div>

                  {activeRequest.photoUrl ? (
                    <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden border-2 border-[var(--border)] bg-black shadow-lg group">
                      <img
                        src={activeRequest.photoUrl}
                        alt="Asset condition"
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-102"
                        onClick={() => setFullPhotoViewer(activeRequest.photoUrl || null)}
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white text-xs">
                        <p className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          Photo Captured on {new Date(activeRequest.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-4/3 w-full rounded-2xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center p-6 text-center space-y-2 bg-[var(--surface-2)]">
                      <Camera className="h-10 w-10 text-[var(--text-muted)] opacity-40" />
                      <p className="text-xs font-bold text-[var(--text-primary)]">No Condition Photo Attached</p>
                    </div>
                  )}
                </div>

                {/* Right Column: Shop & Status Details */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Shop Details */}
                  <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                      <Store className="h-4 w-4 text-amber-500" />
                      <span>Shop & Outlet Information</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Outlet Name</span>
                        <span className="font-bold text-[var(--text-primary)] block mt-0.5">{activeRequest.outletName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Outlet Code</span>
                        <span className="font-mono font-bold text-[var(--accent)] block mt-0.5">{activeRequest.outletCode}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Assigned Route</span>
                        <span className="font-mono font-semibold text-[var(--text-primary)] block mt-0.5">{activeRequest.routeCode}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Classification & Channel</span>
                        <span className="font-semibold text-[var(--text-primary)] block mt-0.5">
                          Class {activeRequest.classification || 'C'} • {activeRequest.channel || 'GT'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* My Notes */}
                  <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                      <User className="h-4 w-4 text-sky-400" />
                      <span>My Submitted Notes</span>
                    </h4>
                    <div className="text-xs space-y-2">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Submitted At</span>
                        <span className="font-semibold text-[var(--text-primary)] block mt-0.5">
                          {new Date(activeRequest.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Comments / Notes</span>
                        <p className="text-xs text-[var(--text-primary)] bg-[var(--surface)] p-3 rounded-xl border border-[var(--border-soft)] mt-1 italic">
                          "{activeRequest.notes || activeRequest.brandingScope || 'Asset branding required'}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Acknowledgement Status */}
                  <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span>Admin Acknowledgement Status</span>
                    </h4>
                    {activeRequest.status === 'Pending Acknowledgement' ? (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <Clock className="h-4 w-4" /> Pending Administrative Acknowledgement
                        </p>
                        <p className="text-[11px] text-amber-300/80">
                          Your request is currently in the Admin review queue. You will see the acknowledging manager and date once reviewed.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Acknowledged by {activeRequest.acknowledgedByName}
                        </p>
                        <p className="text-[11px] text-emerald-300/80">
                          Acknowledged on: {activeRequest.acknowledgedAt ? new Date(activeRequest.acknowledgedAt).toLocaleString() : '—'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Outlet Branding History */}
              <div className="space-y-3 border-t border-[var(--border-soft)] pt-5">
                <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                  <History className="h-4 w-4 text-amber-500" /> Outlet History ({activeRequest.outletName})
                </h4>
                {loadingHistory ? (
                  <div className="py-4 text-center text-xs text-[var(--text-muted)]">Loading history...</div>
                ) : outletHistory.length <= 1 ? (
                  <p className="text-xs text-[var(--text-muted)] italic">
                    This is the first asset branding request logged for this outlet.
                  </p>
                ) : (
                  <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--surface-2)] text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        <tr>
                          <th className="py-2.5 px-3">Req ID</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Notes</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Acknowledged By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-soft)]">
                        {outletHistory.map((h) => (
                          <tr key={h.id} className={h.id === activeRequest.id ? 'bg-amber-500/10 font-semibold' : ''}>
                            <td className="py-2.5 px-3 font-mono font-bold text-[var(--accent)]">{h.requestNumber}</td>
                            <td className="py-2.5 px-3 text-[var(--text-muted)]">{new Date(h.createdAt).toLocaleDateString()}</td>
                            <td className="py-2.5 px-3 truncate max-w-xs">{h.notes || h.brandingScope || '—'}</td>
                            <td className="py-2.5 px-3">
                              <span className={h.status === 'Acknowledged' ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                                {h.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[var(--text-muted)]">{h.acknowledgedByName || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-soft)] bg-[var(--surface-2)]/60">
              <span className="text-xs font-mono text-[var(--text-muted)]">
                Record ID: {activeRequest.id}
              </span>
              <button
                type="button"
                onClick={() => setActiveRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] border border-[var(--border)] transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Size Image Viewer */}
      {fullPhotoViewer && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
          onClick={() => setFullPhotoViewer(null)}
        >
          <button
            type="button"
            onClick={() => setFullPhotoViewer(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={fullPhotoViewer}
            alt="Asset condition full size"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}

      {/* Export Progress Notification Modal */}
      {exportProgress && exportProgress.isExporting && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center mx-auto animate-pulse">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                Exporting Report with Photos
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {exportProgress.message}
              </p>
            </div>
            {exportProgress.total > 0 && (
              <div className="space-y-1.5">
                <div className="w-full bg-[var(--surface-2)] h-2 rounded-full overflow-hidden border border-[var(--border-soft)]">
                  <div
                    className="bg-[var(--accent)] h-full transition-all duration-300"
                    style={{
                      width: `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                  <span>Record {exportProgress.current} of {exportProgress.total}</span>
                  <span>{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
                </div>
              </div>
            )}
            <p className="text-[10px] text-[var(--text-muted)] italic">
              Embedding photos into document... your download will start automatically once ready.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
