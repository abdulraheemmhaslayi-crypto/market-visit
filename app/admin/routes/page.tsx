'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Map, CheckCircle2, AlertTriangle, TrendingUp, MapPin } from 'lucide-react';
import { Route } from '@/types';
import nextDynamic from 'next/dynamic';
import InteractiveChartTableModal from '@/components/dashboard/InteractiveChartTableModal';
import { useState } from 'react';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';

const BarChart = nextDynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = nextDynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = nextDynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = nextDynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = nextDynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = nextDynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Cell = nextDynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const ResponsiveContainer = nextDynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

const TT_STYLE = {
  backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: '10px', color: 'var(--text-primary)', fontSize: '12px',
  boxShadow: 'var(--shadow-dropdown)',
};

export default function RoutesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<any[]>([]);

  const { data: routes = [], isLoading } = useQuery<Route[]>({
    queryKey: ['routes'],
    queryFn: () => fetch('/api/routes').then(r => r.json()),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ['dashboard-stats', '', '', '', ''],
    queryFn: () => fetch('/api/dashboard').then(r => r.json()),
  });

  const coverageData = stats?.coveragePerRoute ?? [];

  const handleExportRoutes = () => {
    exportToExcel({
      filename: `routes_master_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Routes Master',
      title: 'Routes & Coverage Performance Master Log',
      columns: [
        { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.code || '—' },
        { header: 'Route Name', key: 'routeName', formatter: (val: any, row: any) => val || row.name || '—' },
        { header: 'Channel', key: 'channel' },
        { header: 'Assigned Supervisor', key: 'superName', formatter: (val: any, row: any) => val || row.supervisorId || row.assignedSupervisor || '—' },
        { header: 'Manager ID', key: 'managerId', formatter: (val: any, row: any) => val || row.managerName || '—' },
      ],
      data: routes,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Routes
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            View all field routes, coverage performance, and assignment status.
          </p>
        </div>
        <ExportButton onClick={handleExportRoutes} label="Export Routes Excel" variant="default" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Routes', value: routes.length, icon: Map, color: 'var(--accent)', bg: 'var(--accent-light)' },
          { label: 'Fully Covered', value: coverageData.filter((r: any) => r.coverage >= 80).length, icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-light)' },
          { label: 'Partial Coverage', value: coverageData.filter((r: any) => r.coverage >= 50 && r.coverage < 80).length, icon: TrendingUp, color: 'var(--warning)', bg: 'var(--warning-light)' },
          { label: 'Low Coverage', value: coverageData.filter((r: any) => r.coverage < 50).length, icon: AlertTriangle, color: 'var(--danger)', bg: 'var(--danger-light)' },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="card card-hover p-4 flex items-center gap-3">
              <div className="icon-wrap h-10 w-10 rounded-xl flex-shrink-0" style={{ background: k.bg }}>
                <Icon className="h-5 w-5" style={{ color: k.color }} />
              </div>
              <div>
                {isLoading ? <Skeleton className="h-6 w-10 mb-1" /> : (
                  <p className="text-[22px] font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{k.value}</p>
                )}
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coverage Chart */}
      {coverageData.length > 0 && (
        <div className="card">
          <div className="section-header">
            <span className="section-title">
              <BarChart2Icon />
              Coverage by Route
            </span>
            <span className="badge badge-accent">Bar Chart</span>
          </div>
          <div className="p-5">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={coverageData}
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
                    maxBarSize={36}
                    onClick={(data) => {
                      if (data && (data as any).routeCode) {
                        const rCode = (data as any).routeCode;
                        const matches = (stats?.rows ?? []).filter((r: any) => r.rt === rCode);
                        setModalTitle(`Visits for Route ${rCode}`);
                        setModalData(matches);
                        setModalOpen(true);
                      }
                    }}
                  >
                    {coverageData.map((r: any, i: number) => (
                      <Cell key={i} fill={r.coverage >= 80 ? '#10B981' : r.coverage >= 50 ? '#F59E0B' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Routes Table */}
      <div className="card overflow-hidden">
        <div className="section-header">
          <span className="section-title">
            <MapPin className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            All Routes
          </span>
          <span className="badge badge-accent">{routes.length} routes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Route Code', 'Route Name', 'Coverage', 'Visited Outlets', 'Total Outlets', 'Status'].map((h, i) => (
                  <th key={h} className="px-5 py-3 text-left" style={{
                    fontSize: '10px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--text-muted)', background: 'var(--surface-2)',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : routes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    No routes configured. Import master data to add routes.
                  </td>
                </tr>
              ) : (
                routes.map((r) => {
                  const cov = coverageData.find((c: any) => c.routeCode === r.routeCode);
                  const pct = cov?.coverage ?? 0;
                  const status = pct >= 80 ? 'good' : pct >= 50 ? 'partial' : pct > 0 ? 'low' : 'pending';
                  const statusLabel = status === 'good' ? 'On Track' : status === 'partial' ? 'Partial' : status === 'low' ? 'Low' : 'No Visits';
                  const statusClass = status === 'good' ? 'badge-success' : status === 'partial' ? 'badge-warning' : status === 'low' ? 'badge-danger' : 'badge-info';

                  return (
                    <tr
                      key={r.routeCode}
                      style={{ borderBottom: '1px solid var(--border-soft)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      className="transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[12px] font-semibold" style={{ color: 'var(--accent)' }}>{r.routeCode}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{r.routeName}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="progress-bar w-20">
                            <div className="progress-fill" style={{
                              width: `${pct}%`,
                              background: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)',
                            }} />
                          </div>
                          <span className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{cov?.visited ?? 0}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{cov?.total ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${statusClass}`}>{statusLabel}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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

// Inline icon to avoid import issues with dynamic recharts
function BarChart2Icon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)' }}><rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/></svg>;
}

export const dynamic = 'force-dynamic';
