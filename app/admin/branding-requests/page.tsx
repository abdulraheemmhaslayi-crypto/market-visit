'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Tag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  Calendar,
  MapPin,
  User,
  ShieldCheck,
  X,
  History,
  Store,
  Check,
  Camera,
  ExternalLink,
  Layers,
  Maximize2,
  ChevronDown,
  Download,
  Presentation,
  FileSpreadsheet,
  Trash2,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { exportToExcel } from '@/utils/excelExport';
import {
  exportBrandingToExcelWithPhotos,
  exportBrandingToPowerPoint,
} from '@/utils/brandingExport';
import { AssetBrandingRequest } from '@/lib/asset-branding';
import { isFullAccessRole, isSupervisorRole } from '@/lib/roles';

export default function AssetBrandingRequestsPage() {
  const { data: session } = useSession();
  const userRole = String((session?.user as any)?.role || '');
  const canAcknowledge = !isSupervisorRole(userRole) && isFullAccessRole(userRole);

  const [requests, setRequests] = useState<AssetBrandingRequest[]>([]);
  const [counts, setCounts] = useState<{
    total: number;
    pending: number;
    acknowledged: number;
    approved?: number;
    rejected?: number;
  }>({
    total: 0,
    pending: 0,
    acknowledged: 0,
    approved: 0,
    rejected: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'acknowledged' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
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
  const [isAcknowledging, setIsAcknowledging] = useState<boolean>(false);
  const [fullPhotoViewer, setFullPhotoViewer] = useState<string | null>(null);

  // Decision Modal State (Approve / Reject with Comments)
  const [decisionModalRequest, setDecisionModalRequest] = useState<AssetBrandingRequest | null>(null);
  const [decisionType, setDecisionType] = useState<'Approved' | 'Rejected'>('Approved');
  const [decisionComment, setDecisionComment] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [deleteConfirmRequest, setDeleteConfirmRequest] = useState<AssetBrandingRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

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
      if (statusFilter === 'pending') params.set('status', 'Pending Acknowledgement');
      if (statusFilter === 'acknowledged') params.set('status', 'Acknowledged');
      if (statusFilter === 'approved') params.set('status', 'Approved');
      if (statusFilter === 'rejected') params.set('status', 'Rejected');
      if (selectedRoute !== 'all') params.set('routeCode', selectedRoute);
      if (selectedSupervisor !== 'all') params.set('supervisorName', selectedSupervisor);
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
  }, [statusFilter, selectedRoute, selectedSupervisor, selectedClassification, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchRequests(false);
  }, [fetchRequests]);

  // Distinct Route and Supervisor lists for filters
  const availableRoutes = useMemo(() => {
    const s = new Set<string>();
    requests.forEach((r) => {
      if (r.routeCode && r.routeCode !== 'N/A') s.add(r.routeCode);
    });
    return Array.from(s).sort();
  }, [requests]);

  const availableSupervisors = useMemo(() => {
    const s = new Set<string>();
    requests.forEach((r) => {
      if (r.supervisorName) s.add(r.supervisorName);
    });
    return Array.from(s).sort();
  }, [requests]);

  const handleOpenDetails = async (reqItem: AssetBrandingRequest) => {
    setActiveRequest(reqItem);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/branding-requests?outletCode=${encodeURIComponent(reqItem.outletCode)}&history=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setOutletHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load outlet history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenDecisionModal = (reqItem: AssetBrandingRequest) => {
    setDecisionModalRequest(reqItem);
    setDecisionType(reqItem.decision || (reqItem.status === 'Approved' ? 'Approved' : reqItem.status === 'Rejected' ? 'Rejected' : 'Approved'));
    setDecisionComment(reqItem.adminComment || '');
  };

  const handleSubmitDecision = async () => {
    if (!decisionModalRequest) return;
    if (decisionType === 'Rejected' && !decisionComment.trim()) {
      alert('Please write the reason for rejecting this branding request.');
      return;
    }
    setIsSubmittingDecision(true);
    try {
      const res = await fetch('/api/branding-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: decisionModalRequest.id,
          action: 'decision',
          decision: decisionType,
          adminComment: decisionComment.trim(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit decision');
      }
      const data = await res.json();
      if (data.success) {
        if (activeRequest && (activeRequest.id === decisionModalRequest.id || activeRequest.requestNumber === decisionModalRequest.requestNumber)) {
          setActiveRequest(data.request);
        }
        setDecisionModalRequest(null);
        await fetchRequests(true);
      }
    } catch (err: any) {
      alert(err.message || 'Error recording decision');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    if (!canAcknowledge) return;
    setIsAcknowledging(true);
    try {
      const res = await fetch('/api/branding-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to acknowledge');
      }
      const data = await res.json();
      if (data.success) {
        if (activeRequest && activeRequest.id === id) {
          setActiveRequest(data.request);
        }
        await fetchRequests(true);
      }
    } catch (err: any) {
      alert(err.message || 'Error acknowledging request');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!deleteConfirmRequest) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/branding-requests?id=${encodeURIComponent(deleteConfirmRequest.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete branding request');
      }
      const data = await res.json();
      if (data.success) {
        if (activeRequest && (activeRequest.id === deleteConfirmRequest.id || activeRequest.requestNumber === deleteConfirmRequest.requestNumber)) {
          setActiveRequest(null);
        }
        setDeleteConfirmRequest(null);
        await fetchRequests(true);
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting request');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Handlers
  const handleExportExcelWithPhotos = async () => {
    setExportMenuOpen(false);
    try {
      setExportProgress({
        isExporting: true,
        message: 'Initializing Excel Export...',
        current: 0,
        total: requests.length,
      });

      await exportBrandingToExcelWithPhotos(requests, {
        filename: `Asset_Branding_Requests_With_Photos_${new Date().toISOString().split('T')[0]}.xlsx`,
        filterSummary: `Dandy Field Visit System • Generated: ${new Date().toLocaleString()} • Filter: ${statusFilter.toUpperCase()} • Classification: ${selectedClassification.toUpperCase()} • Records: ${requests.length}`,
        onProgress: (current, total, message) => {
          setExportProgress({ isExporting: true, message, current, total });
        },
      });
    } catch (err: any) {
      console.error('Excel Export Failed:', err);
      alert('Failed to generate Excel file with photos: ' + (err.message || 'Unknown error'));
    } finally {
      setExportProgress(null);
    }
  };

  const handleExportPowerPoint = async () => {
    setExportMenuOpen(false);
    try {
      setExportProgress({
        isExporting: true,
        message: 'Initializing PowerPoint Slides...',
        current: 0,
        total: requests.length,
      });

      await exportBrandingToPowerPoint(requests, {
        filename: `Asset_Branding_Presentation_${new Date().toISOString().split('T')[0]}.pptx`,
        onProgress: (current, total, message) => {
          setExportProgress({ isExporting: true, message, current, total });
        },
      });
    } catch (err: any) {
      console.error('PowerPoint Export Failed:', err);
      alert('Failed to generate PowerPoint presentation: ' + (err.message || 'Unknown error'));
    } finally {
      setExportProgress(null);
    }
  };

  const handleExportFastTable = () => {
    setExportMenuOpen(false);
    exportToExcel({
      filename: `Asset_Branding_Requests_Table_${new Date().toISOString().split('T')[0]}`,
      sheetName: 'Branding Requests',
      columns: [
        { header: 'Request ID', key: 'requestNumber' },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Outlet Code', key: 'outletCode' },
        { header: 'Route', key: 'routeCode' },
        { header: 'Classification', key: 'classification', formatter: (val) => val ? `Class ${val}` : 'Class C' },
        { header: 'Channel', key: 'channel' },
        { header: 'Supervisor', key: 'supervisorName' },
        { header: 'Condition Photo URL', key: 'photoUrl', formatter: (val) => val || 'No Photo' },
        { header: 'Supervisor Notes', key: 'notes', formatter: (val, row) => val || row.brandingScope || '—' },
        { header: 'Requested Date', key: 'createdAt', formatter: (val) => new Date(val).toLocaleString() },
        { header: 'Status', key: 'status' },
        { header: 'Acknowledged By', key: 'acknowledgedByName', formatter: (val) => val || 'Awaiting Admin' },
        { header: 'Acknowledged Date', key: 'acknowledgedAt', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Admin Decision', key: 'decision', formatter: (val, row) => val || (row.status === 'Approved' ? 'Approved' : row.status === 'Rejected' ? 'Rejected' : row.status === 'Pending Acknowledgement' ? 'Pending' : 'Under Review') },
        { header: 'Admin Comments / Reason', key: 'adminComment', formatter: (val) => val || '—' },
      ],
      data: requests,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-[var(--text-primary)]">
              Asset Branding Requests
            </h2>
            <span className="badge badge-accent">Official Module</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Review field asset branding requirements, manage administrative acknowledgements, approve or reject with comments, and export reports.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Report Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="btn-primary flex items-center gap-2 text-xs py-2 px-3.5 rounded-xl shadow-xs cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export Report</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                <button
                  type="button"
                  onClick={handleExportExcelWithPhotos}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[var(--surface-2)] flex items-start gap-3 transition-colors cursor-pointer group"
                >
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      Excel (.xlsx) with Photos
                    </span>
                    <span className="text-[10.5px] text-[var(--text-muted)] block mt-0.5">
                      Formatted spreadsheet with condition photos embedded in cells.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportPowerPoint}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[var(--surface-2)] flex items-start gap-3 transition-colors cursor-pointer group"
                >
                  <div className="h-9 w-9 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Presentation className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      PowerPoint (.pptx) with Photos
                    </span>
                    <span className="text-[10.5px] text-[var(--text-muted)] block mt-0.5">
                      16:9 executive deck with shop cards, large photos, and status.
                    </span>
                  </div>
                </button>

                <div className="border-t border-[var(--border-soft)] my-1" />

                <button
                  type="button"
                  onClick={handleExportFastTable}
                  className="w-full text-left p-2 rounded-xl hover:bg-[var(--surface-2)] flex items-center gap-2.5 transition-colors cursor-pointer text-xs text-[var(--text-secondary)]"
                >
                  <Download className="h-4 w-4 text-[var(--text-muted)]" />
                  <span>Excel Table Only (No Photos)</span>
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Requests</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{counts.total}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center">
            <Tag className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-amber-500/30 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Pending</p>
            <p className="text-2xl font-black text-amber-500 mt-1">{counts.pending}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-teal-500/30 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-400">Acknowledged</p>
            <p className="text-2xl font-black text-teal-400 mt-1">{counts.acknowledged}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-emerald-500/30 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Approved</p>
            <p className="text-2xl font-black text-emerald-500 mt-1">{counts.approved || 0}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-rose-500/30 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Rejected</p>
            <p className="text-2xl font-black text-rose-500 mt-1">{counts.rejected || 0}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <XCircle className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
            Pending ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('acknowledged')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'acknowledged'
                ? 'bg-teal-600 text-white shadow-xs font-extrabold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Acknowledged ({counts.acknowledged})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approved ({counts.approved || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs font-extrabold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            Rejected ({counts.rejected || 0})
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

        {/* Detailed Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search outlet, code, ID, notes, comments..."
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

          <div>
            <select
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All Supervisors</option>
              {availableSupervisors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              title="From date"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              title="To date"
            />
            {(searchQuery || selectedRoute !== 'all' || selectedSupervisor !== 'all' || selectedClassification !== 'all' || fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRoute('all');
                  setSelectedSupervisor('all');
                  setSelectedClassification('all');
                  setFromDate('');
                  setToDate('');
                  setStatusFilter('all');
                }}
                className="px-2.5 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Branding Requests Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[var(--accent)]" />
            <p className="text-xs text-[var(--text-muted)]">Loading asset branding requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Tag className="h-8 w-8 mx-auto text-[var(--text-muted)] opacity-50" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">No asset branding requests found</p>
            <p className="text-xs text-[var(--text-muted)]">Try adjusting your classification, route, or search filters.</p>
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
                  <th className="py-3 px-4">Supervisor</th>
                  <th className="py-3 px-4">Asset Photo</th>
                  <th className="py-3 px-4">Supervisor Notes</th>
                  <th className="py-3 px-4">Requested Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Acknowledgement</th>
                  <th className="py-3 px-4">Admin Remarks & Decision</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {requests.map((r) => {
                  const isPending = r.status === 'Pending Acknowledgement';
                  const isApproved = r.decision === 'Approved' || r.status === 'Approved';
                  const isRejected = r.decision === 'Rejected' || r.status === 'Rejected';
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
                      <td className="py-3 px-4 font-semibold text-[var(--text-secondary)]">{r.supervisorName}</td>
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
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Approved
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30">
                            <XCircle className="h-3 w-3" />
                            Rejected
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
                            <ShieldCheck className="h-3 w-3" />
                            Acknowledged
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {r.acknowledgedByName ? (
                          <div>
                            <span className="font-semibold text-[var(--text-primary)]">{r.acknowledgedByName}</span>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleDateString() : '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] italic">Awaiting Admin</span>
                        )}
                      </td>
                      {/* Admin Remarks & Decision Column */}
                      <td className="py-3 px-4">
                        {r.decision || r.adminComment ? (
                          <div className="space-y-1 max-w-xs">
                            {r.decision && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  r.decision === 'Approved'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {r.decision === 'Approved' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                {r.decision}
                              </span>
                            )}
                            {r.adminComment ? (
                              <p className="text-[11px] text-[var(--text-primary)] italic truncate" title={r.adminComment}>
                                "{r.adminComment}"
                              </p>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)] italic">No comments</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] italic">—</span>
                        )}
                      </td>
                      {/* Actions Column */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* 1. View Details Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(r)}
                            className="p-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
                            title="View Full Shop Details & Submitted Photo"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* 2. Acknowledge Button (if pending) */}
                          {isPending && canAcknowledge && (
                            <button
                              type="button"
                              disabled={isAcknowledging}
                              onClick={() => handleAcknowledge(r.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Acknowledge Request"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Acknowledge</span>
                            </button>
                          )}

                          {/* 3. Decision Button: Request Approved Or Rejected (Once acknowledged or to edit decision) */}
                          {!isPending && canAcknowledge && (
                            <button
                              type="button"
                              onClick={() => handleOpenDecisionModal(r)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer ${
                                r.decision === 'Approved'
                                  ? 'bg-emerald-700/80 hover:bg-emerald-600 text-white'
                                  : r.decision === 'Rejected'
                                  ? 'bg-rose-700/80 hover:bg-rose-600 text-white'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              }`}
                              title="Request Approved Or Rejected"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>{r.decision ? `${r.decision} (Edit)` : 'Approve / Reject'}</span>
                            </button>
                          )}

                          {/* 4. Delete Entry Button (Admin Only) */}
                          {canAcknowledge && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmRequest(r)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 border border-rose-500/20 transition-all cursor-pointer shadow-xs"
                              title="Delete Asset Branding Request"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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
                {activeRequest.decision === 'Approved' || activeRequest.status === 'Approved' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approved
                  </span>
                ) : activeRequest.decision === 'Rejected' || activeRequest.status === 'Rejected' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    Rejected
                  </span>
                ) : activeRequest.status === 'Pending Acknowledgement' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Pending Acknowledgement
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Acknowledged
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
                {/* Left Column: Submitted Photo */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Camera className="h-4 w-4 text-[var(--accent)]" />
                      <span>Asset Condition Photo Submitted by Supervisor</span>
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
                          Photo Captured by {activeRequest.supervisorName}
                        </p>
                        <p className="text-[10px] text-slate-300">
                          {new Date(activeRequest.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-4/3 w-full rounded-2xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center p-6 text-center space-y-2 bg-[var(--surface-2)]">
                      <Camera className="h-10 w-10 text-[var(--text-muted)] opacity-40" />
                      <p className="text-xs font-bold text-[var(--text-primary)]">No Condition Photo Attached</p>
                      <p className="text-[11px] text-[var(--text-muted)] max-w-xs">
                        This request was submitted without an attached condition photo.
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Column: Comprehensive Shop & Request Details */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Shop Details Card */}
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

                  {/* Supervisor Submission Details */}
                  <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                      <User className="h-4 w-4 text-sky-400" />
                      <span>Supervisor Submission</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Requesting Supervisor</span>
                        <span className="font-semibold text-[var(--text-primary)] block mt-0.5">{activeRequest.supervisorName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Submission Date & Time</span>
                        <span className="font-semibold text-[var(--text-primary)] block mt-0.5">
                          {new Date(activeRequest.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Supervisor Comments / Notes</span>
                        <p className="text-xs text-[var(--text-primary)] bg-[var(--surface)] p-3 rounded-xl border border-[var(--border-soft)] mt-1 italic">
                          "{activeRequest.notes || activeRequest.brandingScope || 'Asset branding required'}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Management Decision & Comments Card */}
                  <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                      <span>Management Decision & Administrative Review</span>
                    </h4>

                    {activeRequest.decision ? (
                      <div
                        className={`p-3.5 rounded-xl border space-y-2 ${
                          activeRequest.decision === 'Approved'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5 text-xs">
                            {activeRequest.decision === 'Approved' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <XCircle className="h-4 w-4 text-rose-400" />
                            )}
                            Decision: {activeRequest.decision.toUpperCase()}
                          </span>
                          <span className="text-[10px] opacity-80">
                            {activeRequest.decisionAt ? new Date(activeRequest.decisionAt).toLocaleString() : ''}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-90">
                          Decided by: <strong>{activeRequest.decisionByName || activeRequest.acknowledgedByName || 'Admin'}</strong>
                        </p>
                        {activeRequest.adminComment && (
                          <div className="bg-[var(--surface)]/80 p-2.5 rounded-lg border border-[var(--border-soft)] mt-1">
                            <span className="text-[9.5px] uppercase font-bold text-[var(--text-muted)] block">Admin Remarks:</span>
                            <p className="text-xs text-[var(--text-primary)] italic mt-0.5">
                              "{activeRequest.adminComment}"
                            </p>
                          </div>
                        )}
                      </div>
                    ) : activeRequest.status === 'Acknowledged' ? (
                      <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs text-teal-400 space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Acknowledged by {activeRequest.acknowledgedByName}
                        </p>
                        <p className="text-[11px] text-teal-300/80">
                          Confirmed on: {activeRequest.acknowledgedAt ? new Date(activeRequest.acknowledgedAt).toLocaleString() : '—'}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] italic">
                          Awaiting formal approval or rejection decision from Admin/Sub-Admin.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <Clock className="h-4 w-4" /> Status: Pending Administrative Acknowledgement
                        </p>
                        <p className="text-[11px] text-amber-300/80">
                          This request has not yet been acknowledged. Admin or Sub-Admin can click "Acknowledge Request" below.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Outlet Branding History */}
              <div className="space-y-3 border-t border-[var(--border-soft)] pt-5">
                <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                  <History className="h-4 w-4 text-amber-500" /> Outlet Branding History ({activeRequest.outletName})
                </h4>
                {loadingHistory ? (
                  <div className="py-4 text-center text-xs text-[var(--text-muted)]">Loading outlet history...</div>
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
                          <th className="py-2.5 px-3">Photo</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Decision / Remarks</th>
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
                              {h.photoUrl ? (
                                <span className="text-[10px] text-emerald-400 font-bold">Attached</span>
                              ) : (
                                <span className="text-[10px] text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={
                                  h.decision === 'Approved' || h.status === 'Approved'
                                    ? 'text-emerald-500 font-bold'
                                    : h.decision === 'Rejected' || h.status === 'Rejected'
                                    ? 'text-rose-500 font-bold'
                                    : h.status === 'Acknowledged'
                                    ? 'text-teal-400 font-bold'
                                    : 'text-amber-500 font-bold'
                                }
                              >
                                {h.decision || h.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 truncate max-w-xs text-[var(--text-secondary)] italic">
                              {h.adminComment || '—'}
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
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  Record ID: {activeRequest.id}
                </span>

                {canAcknowledge && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmRequest(activeRequest);
                    }}
                    className="text-xs font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Entry</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveRequest(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] border border-[var(--border)] transition-all cursor-pointer"
                >
                  Close
                </button>

                {activeRequest.status === 'Pending Acknowledgement' && canAcknowledge && (
                  <button
                    type="button"
                    disabled={isAcknowledging}
                    onClick={() => handleAcknowledge(activeRequest.id)}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {isAcknowledging ? 'Acknowledging...' : 'Acknowledge Request'}
                  </button>
                )}

                {activeRequest.status !== 'Pending Acknowledgement' && canAcknowledge && (
                  <button
                    type="button"
                    onClick={() => handleOpenDecisionModal(activeRequest)}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer text-white ${
                      activeRequest.decision === 'Approved'
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : activeRequest.decision === 'Rejected'
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Request Approved Or Rejected</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Approved Or Rejected Decision Modal */}
      {decisionModalRequest && (
        <div className="fixed inset-0 z-60 overflow-y-auto flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-soft)] bg-[var(--surface-2)]/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-base font-black text-[var(--text-primary)]">
                  Request Approved Or Rejected
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDecisionModalRequest(null)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-muted)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Outlet details banner */}
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-soft)] space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[var(--accent)]">{decisionModalRequest.requestNumber}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                    Class {decisionModalRequest.classification || 'C'}
                  </span>
                </div>
                <p className="font-bold text-[var(--text-primary)]">{decisionModalRequest.outletName}</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Code: <strong className="text-[var(--text-secondary)]">{decisionModalRequest.outletCode}</strong> • Route: {decisionModalRequest.routeCode} • Supervisor: {decisionModalRequest.supervisorName}
                </p>
                {decisionModalRequest.notes && (
                  <p className="text-[11px] text-[var(--text-secondary)] italic pt-1 border-t border-[var(--border-soft)]">
                    Supervisor Note: "{decisionModalRequest.notes}"
                  </p>
                )}
              </div>

              {/* Decision Selector */}
              <div>
                <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block mb-2">
                  Select Decision:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecisionType('Approved')}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      decisionType === 'Approved'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-[1.02]'
                        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:border-emerald-500/50'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Approve Request</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionType('Rejected')}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                      decisionType === 'Rejected'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md scale-[1.02]'
                        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:border-rose-500/50'
                    }`}
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Reject Request</span>
                  </button>
                </div>
              </div>

              {/* Comments / Reason Textarea */}
              <div>
                <label className="text-xs font-bold text-[var(--text-primary)] block mb-1">
                  Reason & Administrative Comments {decisionType === 'Rejected' ? <span className="text-rose-500 font-bold">* (Required for rejection)</span> : <span className="text-[var(--text-muted)] font-normal">(Optional remarks)</span>}:
                </label>
                <textarea
                  rows={3}
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder={
                    decisionType === 'Rejected'
                      ? 'Write the exact reason for rejecting this request (e.g. Chiller already branded in Q3, outlet scheduled for relocation)...'
                      : 'Add comments (e.g. Approved for door decals and canopy replacement in next branding schedule)...'
                  }
                  className="w-full text-xs p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-soft)] bg-[var(--surface-2)]/60">
              <button
                type="button"
                onClick={() => setDecisionModalRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] border border-[var(--border)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingDecision || (decisionType === 'Rejected' && !decisionComment.trim())}
                onClick={handleSubmitDecision}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  decisionType === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                <Check className="h-4 w-4" />
                <span>{isSubmittingDecision ? 'Submitting...' : `Confirm ${decisionType}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmRequest && (
        <div className="fixed inset-0 z-60 overflow-y-auto flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[var(--surface)] border border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-soft)] bg-rose-500/10">
              <div className="flex items-center gap-2 text-rose-500">
                <Trash2 className="h-5 w-5" />
                <h3 className="text-base font-black">Delete Branding Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmRequest(null)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-muted)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-xs text-[var(--text-primary)]">
                Are you sure you want to permanently delete branding request <strong className="font-mono text-rose-400">{deleteConfirmRequest.requestNumber}</strong>?
              </p>
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-soft)] text-xs space-y-1">
                <p className="font-bold text-[var(--text-primary)]">{deleteConfirmRequest.outletName}</p>
                <p className="text-[11px] text-[var(--text-muted)]">Code: {deleteConfirmRequest.outletCode} • Supervisor: {deleteConfirmRequest.supervisorName}</p>
              </div>
              <p className="text-[11px] text-rose-400 font-semibold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                ⚠ This entry will be permanently removed from both the Admin Console and the Supervisor Portal.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-soft)] bg-[var(--surface-2)]/60">
              <button
                type="button"
                onClick={() => setDeleteConfirmRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] border border-[var(--border)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteRequest}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Size Image Lightbox Modal */}
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

            {/* Progress Bar */}
            <div className="w-full bg-[var(--surface-2)] rounded-full h-2.5 overflow-hidden border border-[var(--border)]">
              <div
                className="bg-[var(--accent)] h-full transition-all duration-200 rounded-full"
                style={{
                  width: `${
                    exportProgress.total > 0
                      ? Math.min(100, Math.round((exportProgress.current / exportProgress.total) * 100))
                      : 10
                  }%`,
                }}
              />
            </div>
            <p className="text-[11px] font-mono text-[var(--text-muted)]">
              {exportProgress.current} / {exportProgress.total} records processed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
