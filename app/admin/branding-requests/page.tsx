'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';
import { AssetBrandingRequest } from '@/lib/asset-branding';
import { isFullAccessRole, isSupervisorRole } from '@/lib/roles';

export default function AssetBrandingRequestsPage() {
  const { data: session } = useSession();
  const userRole = String((session?.user as any)?.role || '');
  const canAcknowledge = !isSupervisorRole(userRole) && isFullAccessRole(userRole);

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
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Details Modal
  const [activeRequest, setActiveRequest] = useState<AssetBrandingRequest | null>(null);
  const [outletHistory, setOutletHistory] = useState<AssetBrandingRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [isAcknowledging, setIsAcknowledging] = useState<boolean>(false);

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter === 'pending') params.set('status', 'Pending Acknowledgement');
      if (statusFilter === 'acknowledged') params.set('status', 'Acknowledged');
      if (selectedRoute !== 'all') params.set('routeCode', selectedRoute);
      if (selectedSupervisor !== 'all') params.set('supervisorName', selectedSupervisor);
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
  }, [statusFilter, selectedRoute, selectedSupervisor, searchQuery, fromDate, toDate]);

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

  const availableSupervisors = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.supervisorName) set.add(r.supervisorName);
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

  const handleAcknowledge = async (id: string) => {
    if (!canAcknowledge) {
      alert('You are not authorized to acknowledge branding requests.');
      return;
    }
    if (!confirm('Acknowledge this Asset Branding Request? This confirms administrative receipt of the requirement.')) {
      return;
    }

    setIsAcknowledging(true);
    try {
      const res = await fetch('/api/branding-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to acknowledge request');
      }

      // Update in-memory lists
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data.request } : r))
      );
      if (activeRequest && activeRequest.id === id) {
        setActiveRequest({ ...activeRequest, ...data.request });
      }

      // Refresh counts
      fetchRequests(true);
      alert('Asset Branding Request acknowledged successfully.');
    } catch (err: any) {
      alert(err.message || 'Error acknowledging request');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleExportExcel = () => {
    exportToExcel({
      filename: `asset_branding_requests_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Branding Requests',
      title: 'Asset Branding Requirements Log',
      filterSummary: `Status: ${statusFilter} | Route: ${selectedRoute} | Supervisor: ${selectedSupervisor} | Search: "${searchQuery}"`,
      columns: [
        { header: 'Request ID', key: 'requestNumber' },
        { header: 'Outlet Code', key: 'outletCode' },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Route Code', key: 'routeCode' },
        { header: 'Supervisor Name', key: 'supervisorName' },
        { header: 'Branding Scope', key: 'brandingScope' },
        { header: 'Status', key: 'status' },
        { header: 'Request Date', key: 'createdAt', formatter: (val) => (val ? new Date(val).toLocaleString() : '—') },
        { header: 'Acknowledged By', key: 'acknowledgedByName', formatter: (val) => val || '—' },
        { header: 'Acknowledged Date', key: 'acknowledgedAt', formatter: (val) => (val ? new Date(val).toLocaleString() : '—') },
      ],
      data: requests,
    });
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    setSelectedRoute('all');
    setSelectedSupervisor('all');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-white dark:bg-slate-800 p-1 flex items-center justify-center shadow-xs border border-[var(--border)] flex-shrink-0">
            <img src="/images/dandy-logo.png" alt="Dandy Logo" className="h-full w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              Asset Branding Requests
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Official Module
              </span>
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Review field asset branding requirements submitted by supervisors and record administrative acknowledgements.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <ExportButton onClick={handleExportExcel} label="Export Log" variant="outline" />
          <button
            onClick={() => fetchRequests(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] border border-[var(--border)] transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Requests</p>
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

        {/* Detailed Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search outlet, code, ID..."
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
                  Supervisor: {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]"
              title="From Date"
            />
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

      {/* Main Requests Table */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[var(--accent)]" />
            <p className="text-xs text-[var(--text-muted)]">Loading asset branding requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Tag className="h-8 w-8 mx-auto text-[var(--text-muted)] opacity-50" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">No asset branding requests found</p>
            <p className="text-xs text-[var(--text-muted)]">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Outlet Name & Code</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Supervisor</th>
                  <th className="py-3 px-4">Branding Scope</th>
                  <th className="py-3 px-4">Requested Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Acknowledgement</th>
                  <th className="py-3 px-4 text-right">Actions</th>
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
                      <td className="py-3 px-4 font-semibold text-[var(--text-secondary)]">{r.supervisorName}</td>
                      <td className="py-3 px-4 max-w-xs truncate text-[var(--text-secondary)]">{r.brandingScope || 'General Asset'}</td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">
                        {new Date(r.createdAt).toLocaleDateString()}
                        <div className="text-[10px]">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="py-3 px-4">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending
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
                            <span className="font-semibold text-[var(--text-primary)]">{r.acknowledgedByName}</span>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleDateString() : '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] italic">Awaiting Admin</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(r)}
                            className="p-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                            title="View Request Details & Outlet History"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {isPending && canAcknowledge && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(r.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                              title="Acknowledge Request"
                            >
                              <Check className="h-3 w-3" />
                              Acknowledge
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

      {/* Request Details & History Modal */}
      {activeRequest && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--border-soft)] pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wider">
                  Request {activeRequest.requestNumber}
                </span>
                <h3 className="text-base font-bold text-[var(--text-primary)] mt-1.5 flex items-center gap-2">
                  <Store className="h-4 w-4 text-amber-500" />
                  {activeRequest.outletName}
                </h3>
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  Outlet Code: {activeRequest.outletCode} • Route: {activeRequest.routeCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRequest(null)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Request Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Request Date & Time</span>
                <span className="font-semibold text-[var(--text-primary)] mt-0.5 block">
                  {new Date(activeRequest.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Requesting Supervisor</span>
                <span className="font-semibold text-[var(--text-primary)] mt-0.5 block flex items-center gap-1">
                  <User className="h-3 w-3 text-sky-400" />
                  {activeRequest.supervisorName}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Branding Requirement</span>
                <span className="font-bold text-amber-500 mt-0.5 block">YES</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] col-span-2 sm:col-span-3">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Branding Scope & Notes</span>
                <p className="text-[var(--text-primary)] mt-0.5 italic">
                  "{activeRequest.brandingScope || 'General Asset Branding Requirement'}"
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] col-span-2 sm:col-span-3">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">Current Status</span>
                <div className="mt-1 flex items-center justify-between">
                  {activeRequest.status === 'Pending Acknowledgement' ? (
                    <span className="text-amber-500 font-bold flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> Pending Administrative Acknowledgement
                    </span>
                  ) : (
                    <div className="text-emerald-500 font-bold space-y-0.5">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Acknowledged by {activeRequest.acknowledgedByName}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-normal block">
                        Acknowledged on: {activeRequest.acknowledgedAt ? new Date(activeRequest.acknowledgedAt).toLocaleString() : '—'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Previous Request History for this Outlet (Section 8) */}
            <div className="space-y-2 border-t border-[var(--border-soft)] pt-4">
              <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 uppercase tracking-wider">
                <History className="h-3.5 w-3.5 text-amber-500" /> Outlet Branding History
              </h4>
              {loadingHistory ? (
                <div className="py-4 text-center text-xs text-[var(--text-muted)]">Loading history...</div>
              ) : outletHistory.length <= 1 ? (
                <p className="text-[11px] text-[var(--text-muted)] italic">
                  This is the first asset branding request logged for this outlet.
                </p>
              ) : (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[var(--surface-2)] text-[10px] uppercase font-bold text-[var(--text-muted)]">
                      <tr>
                        <th className="py-2 px-3">Req ID</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Scope</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Acknowledged By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)]">
                      {outletHistory.map((h) => (
                        <tr key={h.id} className={h.id === activeRequest.id ? 'bg-amber-500/10' : ''}>
                          <td className="py-2 px-3 font-mono font-bold">{h.requestNumber}</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">{new Date(h.createdAt).toLocaleDateString()}</td>
                          <td className="py-2 px-3 truncate max-w-[150px]">{h.brandingScope}</td>
                          <td className="py-2 px-3">
                            <span className={h.status === 'Acknowledged' ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                              {h.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">{h.acknowledgedByName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
              <button
                type="button"
                onClick={() => setActiveRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] transition-all cursor-pointer"
              >
                Close
              </button>

              {activeRequest.status === 'Pending Acknowledgement' && canAcknowledge && (
                <button
                  type="button"
                  disabled={isAcknowledging}
                  onClick={() => handleAcknowledge(activeRequest.id)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {isAcknowledging ? 'Acknowledging...' : 'Acknowledge Request'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

