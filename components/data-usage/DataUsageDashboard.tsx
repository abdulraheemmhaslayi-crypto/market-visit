'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  HardDrive,
  Users,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Search,
  Download,
  Calendar,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  TrendingUp,
  PieChart as PieChartIcon,
  Server,
  Layers,
  X,
  Sparkles,
} from 'lucide-react';
import { isFullAccessRole } from '@/lib/roles';
import { useToast } from '@/components/ui/toast';

// Dynamic import for Recharts to avoid SSR hydration mismatch
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), {
  ssr: false,
});
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), {
  ssr: false,
});
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), {
  ssr: false,
});
const PieChart = dynamic(() => import('recharts').then((m) => m.PieChart), {
  ssr: false,
});
const Pie = dynamic(() => import('recharts').then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), {
  ssr: false,
});

export interface DataUsageDashboardProps {
  portalType: 'admin' | 'supervisor';
}

export default function DataUsageDashboard({ portalType }: DataUsageDashboardProps) {
  const { data: session } = useSession();
  const { showToast } = useToast();

  const userRole = (session?.user as any)?.role;
  const canEditSettings = isFullAccessRole(userRole);

  const [dateRangePreset, setDateRangePreset] = useState<'today' | 'yesterday' | '7days' | '30days' | 'custom'>('today');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Normal' | 'Warning' | 'Exceeded'>('all');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings form state
  const [dailyLimitMb, setDailyLimitMb] = useState(50);
  const [warningPercent, setWarningPercent] = useState(80);
  const [highAlertMb, setHighAlertMb] = useState(100);

  const handlePresetChange = (preset: 'today' | 'yesterday' | '7days' | '30days' | 'custom') => {
    setDateRangePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  const fetchStats = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/data-usage/stats?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setData(json);
        if (json.settings) {
          setDailyLimitMb(json.settings.dailyPerUserLimitMb || 50);
          setWarningPercent(json.settings.warningThresholdPercent || 80);
          setHighAlertMb(json.settings.highUsageAlertThresholdMb || 100);
        }
      } else {
        showToast(json.error || 'Failed to load usage metrics', 'error');
      }
    } catch (err: any) {
      showToast('Network error loading data usage metrics', 'error');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/data-usage/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyPerUserLimitMb: dailyLimitMb,
          warningThresholdPercent: warningPercent,
          highUsageAlertThresholdMb: highAlertMb,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Data usage thresholds updated successfully!', 'success');
        setSettingsModalOpen(false);
        fetchStats(true);
      } else {
        showToast(json.error || 'Failed to update settings', 'error');
      }
    } catch {
      showToast('Error updating settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    let list = data.users;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (u: any) =>
          u.userName.toLowerCase().includes(q) ||
          u.userRole.toLowerCase().includes(q) ||
          (u.deviceInfo && u.deviceInfo.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      list = list.filter((u: any) => u.status === statusFilter);
    }

    return list;
  }, [data?.users, searchQuery, statusFilter]);

  const handleExportCSV = () => {
    if (!filteredUsers.length) {
      showToast('No records to export', 'error');
      return;
    }

    const headers = ['User Name', 'Role', 'Total Data Consumed', 'Downloaded', 'Uploaded', 'Total Requests', 'Days Active', 'Status', 'Device', 'Last Active'];
    const rows = filteredUsers.map((u: any) => [
      `"${u.userName}"`,
      `"${u.userRole}"`,
      `"${formatBytes(u.totalBytes)}"`,
      `"${formatBytes(u.bytesDownloaded)}"`,
      `"${formatBytes(u.bytesUploaded)}"`,
      u.totalRequests,
      u.daysActive,
      `"${u.status}"`,
      `"${u.deviceInfo || 'N/A'}"`,
      `"${u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : 'N/A'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: (string | number)[]) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `data-usage-report-${startDate}-to-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Usage report exported successfully!', 'success');
  };

  // Pie chart data for Upload vs Download
  const pieData = useMemo(() => {
    if (!data?.summary) return [];
    const down = data.summary.bytesDownloadedToday || 0;
    const up = data.summary.bytesUploadedToday || 0;
    if (down === 0 && up === 0) return [];
    return [
      { name: 'Downloads (Inbound)', value: down, color: '#3B82F6' },
      { name: 'Uploads (Outbound)', value: up, color: '#10B981' },
    ];
  }, [data]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                Application Data Usage & Network Tracker
              </h1>
              <p className="text-xs sm:text-sm text-[var(--foreground-muted)]">
                Real-time monitoring of daily internet bandwidth consumption per user & module
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canEditSettings && (
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all shadow-sm"
            >
              <Sliders className="h-4 w-4 text-blue-500" />
              Configure Thresholds
            </button>
          )}

          <button
            onClick={() => fetchStats()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--foreground-muted)] mr-1">Date Range:</span>
          {(['today', 'yesterday', '7days', '30days', 'custom'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetChange(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                dateRangePreset === preset
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[var(--surface-raised)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] border border-[var(--border)]'
              }`}
            >
              {preset === 'today'
                ? 'Today'
                : preset === 'yesterday'
                ? 'Yesterday'
                : preset === '7days'
                ? 'Last 7 Days'
                : preset === '30days'
                ? 'Last 30 Days'
                : 'Custom'}
            </button>
          ))}
        </div>

        {dateRangePreset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <span className="text-[var(--foreground-muted)]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* High Usage Alert Banner */}
      {data?.summary?.alertCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">High Data Consumption Warning: </span>
            <span>
              {data.summary.alertCount} user session(s) in this period have exceeded the warning threshold (
              {data.settings?.warningThresholdPercent || 80}% of {data.settings?.dailyPerUserLimitMb || 50} MB/day limit).
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Data Today */}
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Total Data (Today)
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <HardDrive className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
              {formatBytes(data?.summary?.totalBytesToday || 0)}
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-[var(--foreground-muted)]">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <ArrowUpCircle className="h-3.5 w-3.5" />
                {formatBytes(data?.summary?.bytesUploadedToday || 0)} Up
              </span>
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <ArrowDownCircle className="h-3.5 w-3.5" />
                {formatBytes(data?.summary?.bytesDownloadedToday || 0)} Down
              </span>
            </div>
          </div>
        </div>

        {/* Total Requests */}
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Total Network Requests
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
              {(data?.summary?.totalRequestsToday || 0).toLocaleString()}
            </div>
            <p className="mt-2 text-xs text-[var(--foreground-muted)]">
              Across all endpoints today
            </p>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Active Users Today
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
              {data?.summary?.activeUsersToday || 0}
            </div>
            <p className="mt-2 text-xs text-[var(--foreground-muted)]">
              Average: {formatBytes(data?.summary?.avgBytesPerUserToday || 0)} / user
            </p>
          </div>
        </div>

        {/* Daily Threshold Status */}
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Daily Limit Quota
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sliders className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
              {data?.settings?.dailyPerUserLimitMb || 50} MB
            </div>
            <p className="mt-2 text-xs text-[var(--foreground-muted)] flex items-center gap-1">
              <span>Warning trigger:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {data?.settings?.warningThresholdPercent || 80}%
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Trends Time-Series Chart */}
        <div className="lg:col-span-2 bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <h3 className="font-bold text-sm text-[var(--foreground)]">
                Daily Data Consumption Trend (MB)
              </h3>
            </div>
            <span className="text-xs text-[var(--foreground-muted)]">
              {data?.dailyTrends?.length || 0} Day(s) Recorded
            </span>
          </div>

          <div className="h-64 w-full flex-1">
            {data?.dailyTrends && data.dailyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.dailyTrends.map((t: any) => ({
                    date: t.date.substring(5), // MM-DD
                    downloadMb: Number((t.bytesDownloaded / (1024 * 1024)).toFixed(2)),
                    uploadMb: Number((t.bytesUploaded / (1024 * 1024)).toFixed(2)),
                    totalMb: Number((t.totalBytes / (1024 * 1024)).toFixed(2)),
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis dataKey="date" stroke="var(--foreground-muted)" fontSize={11} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'var(--foreground)',
                    }}
                    formatter={(value: any) => [`${value} MB`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="downloadMb" name="Downloads" fill="#3B82F6" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="uploadMb" name="Uploads" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[var(--foreground-muted)]">
                No trend data for the selected period
              </div>
            )}
          </div>
        </div>

        {/* API Module Breakdown */}
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-500" />
              <h3 className="font-bold text-sm text-[var(--foreground)]">
                Top APIs by Bandwidth
              </h3>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-64 pr-1">
            {data?.apiBreakdown && data.apiBreakdown.length > 0 ? (
              data.apiBreakdown.slice(0, 6).map((api: any, idx: number) => {
                const totalBytes = data.apiBreakdown.reduce((acc: number, cur: any) => acc + cur.bytes, 0);
                const percent = totalBytes > 0 ? Math.round((api.bytes / totalBytes) * 100) : 0;
                return (
                  <div key={api.endpoint} className="p-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-mono font-medium truncate max-w-[170px] text-[var(--foreground)]" title={api.endpoint}>
                        {api.endpoint}
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {formatBytes(api.bytes)}
                      </span>
                    </div>
                    <div className="w-full bg-[var(--border)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(5, percent))}%`,
                          backgroundColor: COLORS[idx % COLORS.length],
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--foreground-muted)] mt-1">
                      <span>{api.requests.toLocaleString()} calls</span>
                      <span>{percent}% of traffic</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[var(--foreground-muted)]">
                No API activity recorded yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Usage Leaderboard Table */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">
              User Data Consumption Leaderboard
            </h2>
            <p className="text-xs text-[var(--foreground-muted)]">
              Showing usage details for {filteredUsers.length} user(s)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[var(--foreground-muted)]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="Normal">Normal</option>
                <option value="Warning">Warning (&gt; 80%)</option>
                <option value="Exceeded">Exceeded (100%)</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--foreground-muted)]" />
              <input
                type="text"
                placeholder="Search user or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:outline-none w-44 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-raised)] text-[var(--foreground-muted)] font-semibold border-b border-[var(--border)] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Total Data</th>
                <th className="py-3 px-4">Upload / Download</th>
                <th className="py-3 px-4">Requests</th>
                <th className="py-3 px-4">Quota Progress</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Device / Platform</th>
                <th className="py-3 px-4">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user: any) => {
                  const limitPercent = user.percentOfLimit || 0;
                  return (
                    <tr key={user.userId} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[var(--foreground)]">
                        {user.userName}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {user.userRole}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-blue-600 dark:text-blue-400">
                        {formatBytes(user.totalBytes)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        <div className="flex flex-col text-[10px] space-y-0.5">
                          <span>↑ {formatBytes(user.bytesUploaded)}</span>
                          <span>↓ {formatBytes(user.bytesDownloaded)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        {user.totalRequests.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="w-full bg-[var(--border)] rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              user.status === 'Exceeded'
                                ? 'bg-red-500'
                                : user.status === 'Warning'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(3, limitPercent))}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[var(--foreground-muted)] mt-0.5 block">
                          {limitPercent}% of {data?.settings?.dailyPerUserLimitMb || 50} MB
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {user.status === 'Exceeded' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                            <AlertTriangle className="h-3 w-3" /> Exceeded
                          </span>
                        ) : user.status === 'Warning' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="h-3 w-3" /> Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Normal
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--foreground-muted)] max-w-[150px] truncate" title={user.deviceInfo || ''}>
                        {user.deviceInfo || 'Chrome / Mobile'}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-[var(--foreground-muted)] whitespace-nowrap">
                        {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-[var(--foreground-muted)]">
                    No data usage records found for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Threshold Configuration Modal */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Sliders className="h-5 w-5" />
                <h3 className="font-bold text-base text-[var(--foreground)]">
                  Configure Data Usage Thresholds
                </h3>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="p-1 rounded-lg text-[var(--foreground-muted)] hover:bg-[var(--surface-raised)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Daily Limit */}
              <div>
                <label className="block font-semibold text-[var(--foreground)] mb-1">
                  Daily Per-User Data Limit (MB)
                </label>
                <input
                  type="number"
                  min={5}
                  max={1000}
                  value={dailyLimitMb}
                  onChange={(e) => setDailyLimitMb(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                  Standard expected data budget per supervisor/user per workday.
                </p>
              </div>

              {/* Warning Threshold % */}
              <div>
                <label className="block font-semibold text-[var(--foreground)] mb-1">
                  Warning Threshold (% of Limit)
                </label>
                <input
                  type="number"
                  min={50}
                  max={95}
                  value={warningPercent}
                  onChange={(e) => setWarningPercent(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                  Flags users when they reach {warningPercent}% of their daily quota ({((dailyLimitMb * warningPercent) / 100).toFixed(0)} MB).
                </p>
              </div>

              {/* High Usage Alert Limit */}
              <div>
                <label className="block font-semibold text-[var(--foreground)] mb-1">
                  High-Usage Admin Alert Threshold (MB)
                </label>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={highAlertMb}
                  onChange={(e) => setHighAlertMb(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                  Triggers an abnormal high-usage alert on the supervisor and admin dashboards.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
