'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Flag,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Store,
  MapPin,
  User,
  Users,
  Briefcase,
  Layers,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  ExternalLink,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { AuditActionItem } from '@/lib/audit-actions';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';
import ImageLightboxModal from '@/components/ui/ImageLightboxModal';

interface AuditActionsTrackerSummaryProps {
  selectedManager?: string;
  selectedSupervisor?: string;
  selectedRtm?: string;
  userRole?: string;
  title?: string;
  subtitle?: string;
}

export default function AuditActionsTrackerSummary({
  selectedManager = 'all',
  selectedSupervisor = 'all',
  selectedRtm = 'all',
  userRole = 'Admin',
  title = 'Directives & Corrective Actions Tracker',
  subtitle = 'Manager & Supervisor accountability sheet: Track audit issues flagged, proof submissions, open directives, and resolution compliance.',
}: AuditActionsTrackerSummaryProps) {
  const [items, setItems] = useState<AuditActionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'supervisors' | 'managers' | 'details'>('supervisors');
  
  // Detailed log filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'SUBMITTED' | 'RESOLVED'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'Urgent' | 'Normal'>('all');
  const [ackFilter, setAckFilter] = useState<'all' | 'acknowledged' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredSupName, setFilteredSupName] = useState<string>('all');
  const [quickAckingId, setQuickAckingId] = useState<string | null>(null);

  // Lightbox modal state
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/audit-actions');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load audit action items for tracker summary:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleQuickAcknowledge = async (item: AuditActionItem) => {
    setQuickAckingId(item.id);
    try {
      const res = await fetch('/api/admin/audit-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          photoId: item.photoId,
          acknowledged: true,
          acknowledgedAt: new Date().toISOString(),
          acknowledgedBy: item.supervisor || 'Supervisor',
        }),
      });
      if (res.ok) {
        await fetchItems(true);
      }
    } catch (err) {
      console.error('Failed to quick acknowledge:', err);
    } finally {
      setQuickAckingId(null);
    }
  };

  useEffect(() => {
    fetchItems(false);
  }, [fetchItems]);

  // Global filters (respecting active dashboard manager / supervisor / RTM)
  const scopedItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedManager !== 'all' && (item.manager || '').toUpperCase() !== selectedManager.toUpperCase()) {
        return false;
      }
      if (selectedSupervisor !== 'all' && (item.supervisor || '').toLowerCase() !== selectedSupervisor.toLowerCase()) {
        return false;
      }
      if (selectedRtm !== 'all' && (item.channel || '').toUpperCase() !== selectedRtm.toUpperCase()) {
        return false;
      }
      return true;
    });
  }, [items, selectedManager, selectedSupervisor, selectedRtm]);

  // Overall KPI Counts
  const kpis = useMemo(() => {
    const total = scopedItems.length;
    const acknowledged = scopedItems.filter((i) => i.acknowledged).length;
    const pending = scopedItems.filter((i) => i.actionStatus === 'PENDING').length;
    const submitted = scopedItems.filter((i) => i.actionStatus === 'SUBMITTED').length;
    const resolved = scopedItems.filter((i) => i.actionStatus === 'RESOLVED').length;
    const urgent = scopedItems.filter((i) => i.priority === 'Urgent').length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;
    const ackRate = total > 0 ? Math.round((acknowledged / total) * 100) : 100;

    return { total, acknowledged, pending, submitted, resolved, urgent, resolutionRate, ackRate };
  }, [scopedItems]);

  // Supervisor Rollup Breakdown
  const supervisorRollup = useMemo(() => {
    const map = new Map<string, {
      supervisor: string;
      manager: string;
      channel: string;
      total: number;
      acknowledged: number;
      pending: number;
      submitted: number;
      resolved: number;
      urgent: number;
    }>();

    scopedItems.forEach((i) => {
      const sup = (i.supervisor || 'UNASSIGNED').trim().toUpperCase();
      const current = map.get(sup) || {
        supervisor: sup,
        manager: i.manager || '—',
        channel: i.channel || 'GT',
        total: 0,
        acknowledged: 0,
        pending: 0,
        submitted: 0,
        resolved: 0,
        urgent: 0,
      };

      current.total += 1;
      if (i.acknowledged) current.acknowledged += 1;
      if (i.actionStatus === 'PENDING') current.pending += 1;
      else if (i.actionStatus === 'SUBMITTED') current.submitted += 1;
      else if (i.actionStatus === 'RESOLVED') current.resolved += 1;

      if (i.priority === 'Urgent') current.urgent += 1;

      map.set(sup, current);
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        ackRate: row.total > 0 ? Math.round((row.acknowledged / row.total) * 100) : 100,
        resolutionRate: row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 100,
      }))
      .sort((a, b) => b.pending - a.pending || b.total - a.total);
  }, [scopedItems]);

  // Manager Rollup Breakdown
  const managerRollup = useMemo(() => {
    const map = new Map<string, {
      manager: string;
      supervisors: Set<string>;
      total: number;
      acknowledged: number;
      pending: number;
      submitted: number;
      resolved: number;
      urgent: number;
    }>();

    scopedItems.forEach((i) => {
      const mgr = (i.manager || 'UNASSIGNED').trim().toUpperCase();
      const current = map.get(mgr) || {
        manager: mgr,
        supervisors: new Set<string>(),
        total: 0,
        acknowledged: 0,
        pending: 0,
        submitted: 0,
        resolved: 0,
        urgent: 0,
      };

      if (i.supervisor) current.supervisors.add(i.supervisor.trim().toUpperCase());
      current.total += 1;
      if (i.acknowledged) current.acknowledged += 1;
      if (i.actionStatus === 'PENDING') current.pending += 1;
      else if (i.actionStatus === 'SUBMITTED') current.submitted += 1;
      else if (i.actionStatus === 'RESOLVED') current.resolved += 1;

      if (i.priority === 'Urgent') current.urgent += 1;

      map.set(mgr, current);
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        supervisorsCount: row.supervisors.size,
        ackRate: row.total > 0 ? Math.round((row.acknowledged / row.total) * 100) : 100,
        resolutionRate: row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 100,
      }))
      .sort((a, b) => b.pending - a.pending || b.total - a.total);
  }, [scopedItems]);

  // Detailed Table Filtered
  const detailedFilteredItems = useMemo(() => {
    return scopedItems.filter((i) => {
      if (statusFilter !== 'all' && i.actionStatus !== statusFilter) return false;
      if (priorityFilter !== 'all' && i.priority !== priorityFilter) return false;
      if (ackFilter === 'acknowledged' && !i.acknowledged) return false;
      if (ackFilter === 'pending' && i.acknowledged) return false;
      if (filteredSupName !== 'all' && (i.supervisor || '').trim().toUpperCase() !== filteredSupName.toUpperCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          (i.outlet || '').toLowerCase().includes(q) ||
          (i.outletCode || '').toLowerCase().includes(q) ||
          (i.route || '').toLowerCase().includes(q) ||
          (i.supervisor || '').toLowerCase().includes(q) ||
          (i.manager || '').toLowerCase().includes(q) ||
          (i.gmComment || '').toLowerCase().includes(q) ||
          (i.category || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [scopedItems, statusFilter, priorityFilter, ackFilter, filteredSupName, searchQuery]);

  // Export to Excel
  const handleExport = () => {
    exportToExcel({
      filename: `audit_directives_tracker_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Directives Tracker',
      title: 'Audit Directives & Supervisor Resolution Summary Log',
      filterSummary: `Manager: ${selectedManager} | Supervisor: ${selectedSupervisor} | RTM: ${selectedRtm} | Status: ${statusFilter}`,
      columns: [
        { header: 'Date Flagged', key: 'createdAt', formatter: (val: any) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Status', key: 'actionStatus', formatter: (val: any) => val === 'RESOLVED' ? 'Verified Resolved' : val === 'SUBMITTED' ? 'Proof Uploaded' : 'Action Pending' },
        { header: 'Supervisor Acknowledged', key: 'acknowledged', formatter: (val: any) => val ? 'Yes' : 'Pending' },
        { header: 'Acknowledged Date', key: 'acknowledgedAt', formatter: (val: any) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Acknowledged By', key: 'acknowledgedBy', formatter: (val: any) => val || '—' },
        { header: 'Priority', key: 'priority' },
        { header: 'Outlet Name', key: 'outlet' },
        { header: 'Outlet Code', key: 'outletCode', formatter: (val: any) => val || '—' },
        { header: 'Route Code', key: 'route' },
        { header: 'RTM / Channel', key: 'channel' },
        { header: 'Assigned Supervisor', key: 'supervisor' },
        { header: 'Manager', key: 'manager' },
        { header: 'Category / Asset', key: 'category' },
        { header: 'Directive / Management Comment', key: 'gmComment' },
        { header: 'Supervisor Action Notes', key: 'supervisorComment', formatter: (val: any) => val || '—' },
        { header: 'Action Taken Date', key: 'actionTakenAt', formatter: (val: any) => val ? new Date(val).toLocaleString() : '—' },
      ],
      data: detailedFilteredItems,
    });
  };

  // Convert detailed items to lightbox items for preview
  const lightboxPhotos = useMemo(() => {
    return detailedFilteredItems.map((item) => ({
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
      supervisor: item.supervisor,
      manager: item.manager || '',
      channel: item.channel || 'GT',
    }));
  }, [detailedFilteredItems]);

  const actionItemsDict = useMemo(() => {
    const map: Record<string, AuditActionItem> = {};
    items.forEach((item) => {
      map[item.photoId] = item;
    });
    return map;
  }, [items]);

  return (
    <div className="space-y-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-6 shadow-md">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-soft)]">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex-shrink-0">
            <Flag className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight">
                {title}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-300 border border-indigo-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Tracking Sheet
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <ExportButton onClick={handleExport} label="Export Tracker Log" variant="outline" />
          <button
            type="button"
            onClick={() => fetchItems(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] border border-[var(--border)] transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Total Flagged */}
        <div className="p-3.5 rounded-xl bg-slate-500/10 border border-slate-500/20 space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Flag className="h-3 w-3" /> Total Issues
          </span>
          <p className="text-2xl font-black text-[var(--text-primary)]">{kpis.total}</p>
          <span className="text-[10px] text-[var(--text-muted)] font-medium">Directives assigned</span>
        </div>

        {/* Supervisor Acknowledged */}
        <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Supervisor Ack
          </span>
          <p className="text-2xl font-black text-teal-600 dark:text-teal-300">
            {kpis.acknowledged} <span className="text-xs font-semibold text-[var(--text-muted)]">/ {kpis.total}</span>
          </p>
          <span className="text-[10px] text-teal-800 dark:text-teal-400 font-medium">{kpis.ackRate}% acknowledged</span>
        </div>

        {/* Action Pending */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <Clock className="h-3 w-3 animate-pulse" /> Action Pending
          </span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-300">{kpis.pending}</p>
          <span className="text-[10px] text-amber-800 dark:text-amber-400 font-medium">Awaiting supervisor fix</span>
        </div>

        {/* Proof Uploaded */}
        <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-1">
            <Upload className="h-3 w-3" /> Proof Submitted
          </span>
          <p className="text-2xl font-black text-sky-600 dark:text-sky-300">{kpis.submitted}</p>
          <span className="text-[10px] text-sky-800 dark:text-sky-400 font-medium">Ready for review</span>
        </div>

        {/* Verified Resolved */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Resolved
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-300">{kpis.resolved}</p>
          <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-medium">Verified & closed</span>
        </div>

        {/* Urgent Priority */}
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Urgent Priority
          </span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-300">{kpis.urgent}</p>
          <span className="text-[10px] text-rose-800 dark:text-rose-400 font-medium">Critical focus items</span>
        </div>

        {/* Resolution Rate */}
        <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Closure Rate
          </span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-300">{kpis.resolutionRate}%</p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, kpis.resolutionRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setActiveTab('supervisors')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'supervisors'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Supervisor Rollup Sheet
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">
              {supervisorRollup.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('managers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'managers'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Manager Team Rollup
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">
              {managerRollup.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'details'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            All Highlighted Issues Log
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">
              {detailedFilteredItems.length}
            </span>
          </button>
        </div>

        {/* Active Filters Summary */}
        {filteredSupName !== 'all' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1.5">
              Filtered to Supervisor: <strong>{filteredSupName}</strong>
              <button
                type="button"
                onClick={() => setFilteredSupName('all')}
                className="hover:text-amber-900 ml-1 font-black cursor-pointer"
              >
                ✕
              </button>
            </span>
          </div>
        )}
      </div>

      {/* TAB 1: SUPERVISOR ROLLUP MATRIX */}
      {activeTab === 'supervisors' && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--surface-2)] text-[var(--text-secondary)] uppercase text-[10px] font-extrabold tracking-wider border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-3.5">Supervisor</th>
                <th className="py-3 px-3.5">Reporting Manager</th>
                <th className="py-3 px-3.5">Channel / RTM</th>
                <th className="py-3 px-3.5 text-center">Total Issues</th>
                <th className="py-3 px-3.5 text-center">Supervisor Ack</th>
                <th className="py-3 px-3.5 text-center">Action Pending</th>
                <th className="py-3 px-3.5 text-center">Proof Ready</th>
                <th className="py-3 px-3.5 text-center">Resolved Closed</th>
                <th className="py-3 px-3.5 text-center">Urgent</th>
                <th className="py-3 px-3.5 text-center">Resolution %</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] font-medium">
              {supervisorRollup.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No action directives highlighted to supervisors for the selected scope.
                  </td>
                </tr>
              ) : (
                supervisorRollup.map((row) => (
                  <tr
                    key={row.supervisor}
                    className="hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <td className="py-2.5 px-3.5">
                      <strong className="text-[var(--text-primary)] font-extrabold flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        {row.supervisor}
                      </strong>
                    </td>
                    <td className="py-2.5 px-3.5 text-[var(--text-secondary)]">
                      {row.manager}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                        {row.channel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-[var(--text-primary)]">
                      {row.total}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className="font-extrabold text-[11px] text-teal-600 dark:text-teal-400">
                        {row.acknowledged}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono"> / {row.total} ({row.ackRate}%)</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {row.pending > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                          {row.pending}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {row.submitted > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30">
                          {row.submitted}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {row.resolved > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                          {row.resolved}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {row.urgent > 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                          {row.urgent}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className={`font-extrabold text-[11px] ${
                          row.resolutionRate === 100
                            ? 'text-emerald-500'
                            : row.resolutionRate >= 50
                            ? 'text-sky-500'
                            : 'text-amber-500'
                        }`}>
                          {row.resolutionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setFilteredSupName(row.supervisor);
                          setActiveTab('details');
                        }}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border-soft)] text-accent border border-[var(--border)] transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" /> Inspect ({row.total})
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: MANAGER ROLLUP MATRIX */}
      {activeTab === 'managers' && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--surface-2)] text-[var(--text-secondary)] uppercase text-[10px] font-extrabold tracking-wider border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-3.5">Reporting Manager</th>
                <th className="py-3 px-3.5 text-center">Supervisors Count</th>
                <th className="py-3 px-3.5 text-center">Total Highlighted Directives</th>
                <th className="py-3 px-3.5 text-center">Team Ack</th>
                <th className="py-3 px-3.5 text-center">Team Pending</th>
                <th className="py-3 px-3.5 text-center">Proof Uploaded</th>
                <th className="py-3 px-3.5 text-center">Resolved Closed</th>
                <th className="py-3 px-3.5 text-center">Urgent Items</th>
                <th className="py-3 px-3.5 text-center">Team Resolution Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] font-medium">
              {managerRollup.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No action directives recorded for any manager.
                  </td>
                </tr>
              ) : (
                managerRollup.map((row) => (
                  <tr
                    key={row.manager}
                    className="hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <td className="py-2.5 px-3.5">
                      <strong className="text-[var(--text-primary)] font-extrabold flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        {row.manager}
                      </strong>
                    </td>
                    <td className="py-2.5 px-3.5 text-center text-[var(--text-secondary)] font-mono">
                      {row.supervisorsCount}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-[var(--text-primary)]">
                      {row.total}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className="font-extrabold text-[11px] text-teal-600 dark:text-teal-400">
                        {row.acknowledged}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono"> / {row.total} ({row.ackRate}%)</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {row.pending > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                          {row.pending}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {row.submitted > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30">
                          {row.submitted}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {row.resolved > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                          {row.resolved}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {row.urgent > 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                          {row.urgent}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className={`font-extrabold text-[11px] ${
                        row.resolutionRate === 100
                          ? 'text-emerald-500'
                          : row.resolutionRate >= 50
                          ? 'text-sky-500'
                          : 'text-amber-500'
                      }`}>
                        {row.resolutionRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: DETAILED ISSUES & DIRECTIVES LOG */}
      {activeTab === 'details' && (
        <div className="space-y-3">
          {/* Detailed Filters Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search outlet, route, directive notes, supervisor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent border-0 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Slicer */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs py-1 px-2.5 rounded-lg bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none font-semibold cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="PENDING">Pending Supervisor Action</option>
                <option value="SUBMITTED">Proof Uploaded (Review)</option>
                <option value="RESOLVED">Verified Resolved</option>
              </select>

              {/* Priority Slicer */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="text-xs py-1 px-2.5 rounded-lg bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none font-semibold cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="Urgent">Urgent Only</option>
                <option value="Normal">Normal</option>
              </select>

              {/* Acknowledgement Slicer */}
              <select
                value={ackFilter}
                onChange={(e) => setAckFilter(e.target.value as any)}
                className="text-xs py-1 px-2.5 rounded-lg bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none font-semibold cursor-pointer"
              >
                <option value="all">All Acknowledgements</option>
                <option value="acknowledged">Acknowledged Only</option>
                <option value="pending">Pending Acknowledgement</option>
              </select>

              {/* Supervisor Slicer */}
              <select
                value={filteredSupName}
                onChange={(e) => setFilteredSupName(e.target.value)}
                className="text-xs py-1 px-2.5 rounded-lg bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none font-semibold cursor-pointer"
              >
                <option value="all">All Supervisors</option>
                {Array.from(new Set(scopedItems.map((i) => i.supervisor).filter(Boolean))).sort().map((sup) => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table of Directives */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--surface-2)] text-[var(--text-secondary)] uppercase text-[10px] font-extrabold tracking-wider border-b border-[var(--border)]">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Supervisor Ack</th>
                  <th className="py-3 px-3">Outlet / Store</th>
                  <th className="py-3 px-3">Route / RTM</th>
                  <th className="py-3 px-3">Assigned Supervisor</th>
                  <th className="py-3 px-3.5">Management Directive</th>
                  <th className="py-3 px-3">Resolution Proof</th>
                  <th className="py-3 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] font-medium">
                {detailedFilteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No matching directives found with the selected filters.
                    </td>
                  </tr>
                ) : (
                  detailedFilteredItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 ${
                            item.actionStatus === 'RESOLVED'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : item.actionStatus === 'SUBMITTED'
                              ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                              : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse'
                          }`}
                        >
                          {item.actionStatus === 'RESOLVED' ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" /> Resolved
                            </>
                          ) : item.actionStatus === 'SUBMITTED' ? (
                            <>
                              <Upload className="h-3 w-3" /> Proof Ready
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" /> Pending Action
                            </>
                          )}
                        </span>
                        {item.priority === 'Urgent' && (
                          <span className="ml-1 px-1 py-0.2 rounded text-[9px] font-black uppercase bg-rose-500/20 text-rose-500 border border-rose-500/30">
                            Urgent
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.acknowledged ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Acknowledged
                            </span>
                            <p className="text-[10px] font-mono text-[var(--text-muted)]">
                              {item.acknowledgedAt
                                ? new Date(item.acknowledgedAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Recorded'}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 animate-pulse" /> Pending
                            </span>
                            <button
                              type="button"
                              disabled={quickAckingId === item.id}
                              onClick={() => handleQuickAcknowledge(item)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-sm disabled:opacity-50 inline-flex items-center gap-0.5"
                              title="Quick Acknowledge"
                            >
                              <Check className="h-2.5 w-2.5" />
                              {quickAckingId === item.id ? '...' : 'Ack'}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-[var(--text-primary)] truncate max-w-[180px]">
                          {item.outletCode ? <span className="font-mono text-sky-500 font-bold mr-1">[{item.outletCode}]</span> : null}
                          {item.outlet}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-[var(--text-secondary)]">
                        {item.route} <span className="text-[10px] text-indigo-400 font-bold">({item.channel || 'GT'})</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <strong className="text-[var(--text-primary)] font-bold">{item.supervisor}</strong>
                        {item.manager && (
                          <span className="text-[10px] text-[var(--text-muted)] block">Mgr: {item.manager}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 max-w-[280px]">
                        <p className="italic text-[11px] text-[var(--text-primary)] line-clamp-2">
                          "{item.gmComment}"
                        </p>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.proofPhotoUrl ? (
                          <div
                            onClick={() => setInspectIndex(idx)}
                            className="flex items-center gap-1.5 cursor-pointer group"
                            title="Click to view full resolution proof"
                          >
                            <img
                              src={item.proofPhotoUrl}
                              alt="Proof preview"
                              className="h-7 w-10 object-cover rounded border border-emerald-500/40 group-hover:scale-105 transition-transform"
                            />
                            <span className="text-[10px] font-bold text-emerald-500 hover:underline">
                              View Proof
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] italic">
                            No proof yet
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setInspectIndex(idx)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Full Inspection */}
      {inspectIndex !== null && (
        <ImageLightboxModal
          photos={lightboxPhotos}
          currentIndex={inspectIndex}
          isOpen={inspectIndex !== null}
          onClose={() => setInspectIndex(null)}
          onNavigate={(newIdx) => setInspectIndex(newIdx)}
          title="Directives Verification Lightbox"
          userRole={userRole}
          actionItems={actionItemsDict}
          onActionUpdated={() => fetchItems(true)}
        />
      )}
    </div>
  );
}
