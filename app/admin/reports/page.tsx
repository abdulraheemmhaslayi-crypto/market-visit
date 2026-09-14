'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import nextDynamic from 'next/dynamic';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileBarChart2, TrendingUp, Target, Thermometer,
  Users, BarChart3, CalendarDays, Download, RefreshCw, Filter, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { DashboardStats, Route } from '@/types';
import InteractiveChartTableModal from '@/components/dashboard/InteractiveChartTableModal';

import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { getSizeModelsForCategory, ASSET_CATEGORIES } from '@/utils/asset-config';

const AreaChart       = nextDynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area            = nextDynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const BarChart        = nextDynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar             = nextDynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const PieChart        = nextDynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie             = nextDynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell            = nextDynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const XAxis           = nextDynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis           = nextDynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid   = nextDynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip         = nextDynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = nextDynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

const TT_STYLE = {
  backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: '10px', color: 'var(--text-primary)', fontSize: '12px',
  boxShadow: 'var(--shadow-dropdown)',
};

const PIE_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9'];

function SectionCard({ title, icon: Icon, iconColor, badge, children }: {
  title: string; icon: React.ElementType; iconColor?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col h-full">
      <div className="section-header flex-shrink-0">
        <span className="section-title">
          <Icon className="h-4 w-4" style={{ color: iconColor || 'var(--accent)' }} />
          {title}
        </span>
        {badge}
      </div>
      <div className="p-5 flex-grow">{children}</div>
    </div>
  );
}

export default function ReportsPage() {
  const { showToast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedRoute, setSelectedRoute]           = useState('');
  const [selectedAssetCategory, setSelectedAssetCategory] = useState('Chillers');
  const [selectedSizeModels, setSelectedSizeModels]       = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<any[]>([]);

  const availableSizeModels = useMemo(() => {
    return getSizeModelsForCategory(selectedAssetCategory);
  }, [selectedAssetCategory]);

  const { data: stats, isLoading, isRefetching, refetch } = useQuery<any>({
    queryKey: ['dashboard-stats', startDate, endDate, selectedSupervisor, selectedRoute],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (startDate)          p.append('startDate', startDate);
      if (endDate)            p.append('endDate', endDate);
      if (selectedSupervisor) p.append('supervisorId', selectedSupervisor);
      if (selectedRoute)      p.append('routeCode', selectedRoute);
      const res = await fetch(`/api/dashboard?${p}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const supervisors = useMemo<string[]>(() => {
    return (stats?.masters?.supervisors || []) as string[];
  }, [stats]);

  const routes = useMemo<any[]>(() => {
    if (!stats?.masters?.routes) return [];
    let rts = stats.masters.routes;
    if (selectedSupervisor) {
      rts = rts.filter((r: any) => r.superName.toUpperCase() === selectedSupervisor.toUpperCase());
    }
    return rts as any[];
  }, [stats, selectedSupervisor]);

  const activeFilters = [startDate, endDate, selectedSupervisor, selectedRoute, selectedAssetCategory !== 'All' ? selectedAssetCategory : '', selectedSizeModels.length > 0 ? 'models' : ''].filter(Boolean).length;

  const pieData = [
    { name: 'In Range', value: 100 - (stats?.tempBreachPercent ?? 0) },
    { name: 'Breach', value: stats?.tempBreachPercent ?? 0 },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Analytics & Reports
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Field coverage performance, temperature compliance, and supervisor scorecards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost relative" onClick={() => setFiltersOpen(f => !f)}>
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: 'var(--accent)' }}>
                {activeFilters}
              </span>
            )}
          </button>
          <button className="btn-primary" onClick={() => refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      {filtersOpen && (
        <div className="card p-4 animate-slide-up" style={{ borderColor: 'var(--accent-light)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div>
              <label className="form-label">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Supervisor</label>
              <select value={selectedSupervisor} onChange={e => { setSelectedSupervisor(e.target.value); setSelectedRoute(''); }} className="form-input">
                <option value="">All Supervisors</option>
                {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Route</label>
              <select value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)} className="form-input">
                <option value="">All Routes</option>
                {routes.map(r => <option key={r.routeCode} value={r.routeCode}>{r.routeCode}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Asset Category</label>
              <select
                value={selectedAssetCategory}
                onChange={(e) => {
                  setSelectedAssetCategory(e.target.value);
                  setSelectedSizeModels([]);
                }}
                className="form-input"
              >
                <option value="All">All Categories</option>
                {ASSET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Size / Model</label>
              <MultiSelectDropdown
                placeholder="Select Size/Model"
                options={availableSizeModels}
                selectedValues={selectedSizeModels}
                onChange={setSelectedSizeModels}
              />
            </div>
            <div className="flex items-end">
              <button className="btn-ghost w-full justify-center" onClick={() => { setStartDate(''); setEndDate(''); setSelectedSupervisor(''); setSelectedRoute(''); setSelectedAssetCategory('Chillers'); setSelectedSizeModels([]); showToast('Filters cleared', 'info'); }}>
                <RotateCcw className="h-3.5 w-3.5" />Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Visits', value: stats?.totalVisits ?? 0, icon: CalendarDays, color: 'var(--accent)', bg: 'var(--accent-light)' },
          { label: 'No Visits', value: stats?.noVisitCount ?? 0, icon: AlertTriangle, color: '#D97706', bg: '#FFF7ED' },
          { label: 'Coverage', value: `${stats?.coveragePercent ?? 0}%`, icon: Target, color: '#059669', bg: '#ECFDF5' },
          { label: 'Breach Rate', value: `${stats?.tempBreachPercent ?? 0}%`, icon: Thermometer, color: (stats?.tempBreachPercent ?? 0) > 15 ? 'var(--danger)' : 'var(--text-muted)', bg: (stats?.tempBreachPercent ?? 0) > 15 ? 'var(--danger-light)' : 'var(--surface-2)' },
          { label: 'Team Size', value: stats?.totalSupervisors ?? 0, icon: Users, color: '#0EA5E9', bg: '#F0F9FF' },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="card card-hover p-4 flex items-center gap-3">
              <div className="icon-wrap h-10 w-10 rounded-xl flex-shrink-0" style={{ background: k.bg }}>
                <Icon className="h-5 w-5" style={{ color: k.color }} />
              </div>
              <div>
                {isLoading ? <Skeleton className="h-6 w-16 mb-1" /> : (
                  <p className="text-[22px] font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{k.value}</p>
                )}
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <SectionCard title="Daily Visits Trend" icon={TrendingUp} badge={<span className="badge badge-accent">Area Chart</span>}>
            {isLoading ? <Skeleton className="h-52 w-full" /> : !stats?.visitsPerDay?.length ? (
              <div className="h-52 flex items-center justify-center" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No data in range</div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.visitsPerDay}
                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        const clickedDate = data.activeLabel;
                        const d = new Date(clickedDate);
                        const formattedDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                        const matches = ((stats as any)?.rows ?? []).filter((r: any) => {
                          const rDate = new Date(r.createdAt).toISOString().split('T')[0];
                          return rDate === clickedDate;
                        });
                        setModalTitle(`Visits on ${formattedDate}`);
                        setModalData(matches);
                        setModalOpen(true);
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TT_STYLE} />
                    <Area type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2.5} fill="url(#vg)" dot={false} activeDot={{ r: 4, fill: '#4F46E5', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Temp Compliance" icon={Thermometer} iconColor="var(--danger)" badge={<span className="badge badge-danger">Pie</span>}>
            {isLoading ? <Skeleton className="h-52 w-full" /> : (
              <div className="h-52 flex flex-col items-center justify-center">
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart style={{ cursor: 'pointer' }}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(data) => {
                          if (data && (data as any).name) {
                            const name = (data as any).name;
                            const isOk = name === 'In Range';
                            const matches = ((stats as any)?.rows ?? []).filter((r: any) => r.ok === isOk);
                            setModalTitle(`Visits with Temperature Status: ${name}`);
                            setModalData(matches);
                            setModalOpen(true);
                          }
                        }}
                      >
                        {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#10B981' : '#EF4444'} />)}
                      </Pie>
                      <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [`${v.toFixed(1)}%`]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#10B981' }} /><span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Normal</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#EF4444' }} /><span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Breach</span></div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Route Coverage %" icon={BarChart3} iconColor="#059669" badge={<span className="badge badge-success">Bar Chart</span>}>
          {isLoading ? <Skeleton className="h-52 w-full" /> : !stats?.coveragePerRoute?.length ? (
            <div className="h-52 flex items-center justify-center" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No routes tracked</div>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.coveragePerRoute}
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
                  <XAxis dataKey="routeCode" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [`${v}%`, 'Coverage']} />
                  <Bar
                    dataKey="coverage"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                    onClick={(data) => {
                      if (data && (data as any).routeCode) {
                        const rCode = (data as any).routeCode;
                        const matches = ((stats as any)?.rows ?? []).filter((r: any) => r.rt === rCode);
                        setModalTitle(`Visits for Route ${rCode}`);
                        setModalData(matches);
                        setModalOpen(true);
                      }
                    }}
                  >
                    {((stats?.coveragePerRoute ?? []) as any[]).map((r: any, i: number) => (
                      <Cell key={i} fill={r.coverage >= 80 ? '#10B981' : r.coverage >= 50 ? '#F59E0B' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* Supervisor Scorecard */}
        <SectionCard title="Supervisor Scorecard" icon={Users} iconColor="#8B5CF6">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !stats?.supervisorPerformance?.length ? (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No supervisor data</div>
          ) : (
            <div className="space-y-2.5">
              {((stats?.supervisorPerformance ?? []) as any[]).map((sup: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}>
                    {sup.supervisorName?.charAt(0)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{sup.supervisorName}</p>
                      <span className="text-[12px] font-bold ml-2 flex-shrink-0" style={{ color: sup.coveragePercent >= 80 ? 'var(--success)' : sup.coveragePercent >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                        {sup.coveragePercent}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${sup.coveragePercent}%`,
                        background: sup.coveragePercent >= 80 ? 'var(--success)' : sup.coveragePercent >= 50 ? 'var(--warning)' : 'var(--danger)',
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      <InteractiveChartTableModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        data={modalData}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
