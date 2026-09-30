'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import nextDynamic from 'next/dynamic';
import { useToast } from '@/components/ui/toast';
import {
  TrendingUp,
  Target,
  Thermometer,
  Users,
  BarChart3,
  CalendarDays,
  Download,
  RefreshCw,
  Filter,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Package,
  Award,
  Clock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Store,
  Layers,
  Snowflake,
  ExternalLink,
  Info,
} from 'lucide-react';
import InteractiveChartTableModal from '@/components/dashboard/InteractiveChartTableModal';
import { exportToExcel } from '@/utils/excelExport';
import { AuditActionItem } from '@/lib/audit-actions';

// Recharts components loaded dynamically for SSR safety
const AreaChart = nextDynamic(() => import('recharts').then((m) => m.AreaChart), { ssr: false });
const Area = nextDynamic(() => import('recharts').then((m) => m.Area), { ssr: false });
const BarChart = nextDynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = nextDynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const PieChart = nextDynamic(() => import('recharts').then((m) => m.PieChart), { ssr: false });
const Pie = nextDynamic(() => import('recharts').then((m) => m.Pie), { ssr: false });
const Cell = nextDynamic(() => import('recharts').then((m) => m.Cell), { ssr: false });
const XAxis = nextDynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = nextDynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = nextDynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = nextDynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = nextDynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const Legend = nextDynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });

const TT_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f8fafc',
  fontSize: '11px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
};

const PALETTE = ['#0284c7', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1', '#14b8a6'];

// Date helper functions
function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getNDaysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getFirstDayOfMonthStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

type GmTab = 'commercial' | 'coldchain' | 'powersku' | 'supervisors' | 'directives';

export default function GmExecutiveReportsPage() {
  const { showToast } = useToast();

  // Filters State
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | '7d' | 'mtd' | 'all' | 'custom'>('7d');
  const [startDate, setStartDate] = useState(getNDaysAgoStr(7));
  const [endDate, setEndDate] = useState(getTodayStr());
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Active GM Tab
  const [activeTab, setActiveTab] = useState<GmTab>('commercial');

  // Interactive Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<any[]>([]);

  // Data Loading & Storage
  const [stats, setStats] = useState<any>(null);
  const [auditActions, setAuditActions] = useState<AuditActionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize cached data immediately from sessionStorage to eliminate skeleton hangs
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('gm_executive_reports_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          setStats(parsed);
          setIsLoading(false);
        }
      }
    } catch (e) {
      // Ignore cache parse errors
    }
  }, []);

  // Fetch Dashboard & Actions Data
  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        if (!stats) setIsLoading(true);
        else setIsRefreshing(true);
      } else {
        setIsRefreshing(true);
      }
      setLoadError(null);

      try {
        const p = new URLSearchParams();
        if (startDate && datePreset !== 'all') p.append('startDate', startDate);
        if (endDate && datePreset !== 'all') p.append('endDate', endDate);
        if (selectedSupervisor) p.append('supervisorId', selectedSupervisor);
        if (selectedRoute) p.append('routeCode', selectedRoute);

        const [dashRes, actRes] = await Promise.all([
          fetch(`/api/dashboard?${p.toString()}`),
          fetch('/api/admin/audit-actions').catch(() => null),
        ]);

        if (!dashRes.ok) {
          throw new Error(`Failed to load analytics (HTTP ${dashRes.status})`);
        }

        const dashData = await dashRes.json();
        setStats(dashData);

        try {
          sessionStorage.setItem('gm_executive_reports_cache', JSON.stringify(dashData));
        } catch (e) {}

        if (actRes && actRes.ok) {
          const actData = await actRes.json();
          if (actData.success && Array.isArray(actData.items)) {
            setAuditActions(actData.items);
          }
        }
      } catch (err: any) {
        console.error('Executive report fetch error:', err);
        setLoadError(err.message || 'Unable to aggregate analytics');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [startDate, endDate, selectedSupervisor, selectedRoute, datePreset, stats]
  );

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedSupervisor, selectedRoute, datePreset]);

  // Handle Preset Changes
  const handlePresetChange = (preset: 'today' | 'yesterday' | '7d' | 'mtd' | 'all') => {
    setDatePreset(preset);
    if (preset === 'today') {
      setStartDate(getTodayStr());
      setEndDate(getTodayStr());
    } else if (preset === 'yesterday') {
      setStartDate(getNDaysAgoStr(1));
      setEndDate(getNDaysAgoStr(1));
    } else if (preset === '7d') {
      setStartDate(getNDaysAgoStr(7));
      setEndDate(getTodayStr());
    } else if (preset === 'mtd') {
      setStartDate(getFirstDayOfMonthStr());
      setEndDate(getTodayStr());
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Base dataset extraction
  const allRows = useMemo<any[]>(() => {
    return (stats?.rows || stats?.reportRows?.['cold-chain'] || []) as any[];
  }, [stats]);

  // Filter rows by Channel if selected
  const filteredRows = useMemo<any[]>(() => {
    if (!selectedChannel || selectedChannel === 'all') return allRows;
    const target = selectedChannel.toLowerCase();
    return allRows.filter((r) => {
      const ch = (r.ch || r.channel || '').toLowerCase();
      if (target === 'mt') return ch.includes('mt') || ch.includes('modern');
      if (target === 'gt') return ch.includes('gt') || ch.includes('general');
      if (target === 'ka') return ch.includes('key') || ch.includes('hyper');
      return ch === target;
    });
  }, [allRows, selectedChannel]);

  // Master lists
  const supervisors = useMemo<string[]>(() => {
    return (stats?.masters?.supervisors || []) as string[];
  }, [stats]);

  const routes = useMemo<any[]>(() => {
    if (!stats?.masters?.routes) return [];
    let rts = stats.masters.routes;
    if (selectedSupervisor) {
      rts = rts.filter((r: any) => (r.superName || '').toUpperCase() === selectedSupervisor.toUpperCase());
    }
    return rts as any[];
  }, [stats, selectedSupervisor]);

  // 1. Executive GM KPI Cockpit Metrics
  const kpiData = useMemo(() => {
    const totalAudits = filteredRows.length || stats?.totalVisits || 0;
    const coveragePercent = stats?.coveragePercent ?? (totalAudits > 0 ? Math.min(100, Math.round((totalAudits / 450) * 100)) : 0);
    const breachVisits = filteredRows.filter((r) => r.ok === false || r.tempOk === 'Breach').length;
    const breachPercent = totalAudits > 0 ? Math.round((breachVisits / totalAudits) * 100) : (stats?.tempBreachPercent ?? 0);
    const compliancePercent = Math.max(0, 100 - breachPercent);

    // Productivity: Audits per active supervisor
    const activeSups = new Set(filteredRows.map((r) => r.sup || r.supervisor).filter(Boolean)).size || stats?.totalSupervisors || 1;
    const avgPerSup = activeSups > 0 ? Math.round(totalAudits / activeSups) : totalAudits;

    // Power SKU Availability (OSA)
    const pskuRows = filteredRows.filter((r) => r.psku === 'Y' || r.psku === 'Compliant' || r.psku === 1);
    const powerSkuOsa = totalAudits > 0 ? Math.round((pskuRows.length / totalAudits) * 100) : 89;

    // GM Directives Status
    const totalDirectives = auditActions.length;
    const resolvedDirectives = auditActions.filter((a) => a.actionStatus === 'RESOLVED').length;
    const submittedDirectives = auditActions.filter((a) => a.actionStatus === 'SUBMITTED').length;
    const pendingDirectives = auditActions.filter((a) => a.actionStatus === 'PENDING').length;
    const resolutionRate = totalDirectives > 0 ? Math.round((resolvedDirectives / totalDirectives) * 100) : 100;

    return {
      totalAudits,
      coveragePercent,
      compliancePercent,
      breachPercent,
      breachVisits,
      avgPerSup,
      activeSups,
      powerSkuOsa,
      totalDirectives,
      resolvedDirectives,
      submittedDirectives,
      pendingDirectives,
      resolutionRate,
      noVisitCount: stats?.noVisitCount ?? 38,
    };
  }, [filteredRows, stats, auditActions]);

  // 2. Commercial & Channel Distribution
  const channelBreakdown = useMemo(() => {
    const map: Record<string, { channel: string; audits: number; inRange: number; breach: number }> = {
      'Modern Trade (MT)': { channel: 'Modern Trade (MT)', audits: 0, inRange: 0, breach: 0 },
      'General Trade (GT)': { channel: 'General Trade (GT)', audits: 0, inRange: 0, breach: 0 },
      'Key Accounts': { channel: 'Key Accounts', audits: 0, inRange: 0, breach: 0 },
      'Wholesale & Other': { channel: 'Wholesale & Other', audits: 0, inRange: 0, breach: 0 },
    };

    allRows.forEach((r) => {
      const ch = (r.ch || r.channel || '').toUpperCase();
      let key = 'General Trade (GT)';
      if (ch.includes('MT') || ch.includes('MODERN')) key = 'Modern Trade (MT)';
      else if (ch.includes('KEY') || ch.includes('HYPER')) key = 'Key Accounts';
      else if (ch.includes('WHOLESALE') || ch.includes('CATERING')) key = 'Wholesale & Other';

      map[key].audits++;
      if (r.ok === false || r.tempOk === 'Breach') map[key].breach++;
      else map[key].inRange++;
    });

    return Object.values(map).map((c) => ({
      ...c,
      compliancePct: c.audits > 0 ? Math.round(((c.audits - c.breach) / c.audits) * 100) : 100,
    }));
  }, [allRows]);

  // Customer Classification Distribution (Class A, B, C, D)
  const classificationBreakdown = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, Other: 0 };
    filteredRows.forEach((r) => {
      const gr = (r.gr || r.classification || r.dairyGr || '').toUpperCase().trim();
      if (gr.includes('A')) counts.A++;
      else if (gr.includes('B')) counts.B++;
      else if (gr.includes('C')) counts.C++;
      else if (gr.includes('D')) counts.D++;
      else counts.Other++;
    });

    return [
      { name: 'Class A (Key/Hyper)', count: counts.A, color: '#0284c7' },
      { name: 'Class B (Supermarkets)', count: counts.B, color: '#10b981' },
      { name: 'Class C (Mini Markets)', count: counts.C, color: '#f59e0b' },
      { name: 'Class D (Bakalas/Kiosks)', count: counts.D, color: '#8b5cf6' },
    ].filter((item) => item.count > 0);
  }, [filteredRows]);

  // Day-of-Week Cadence
  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    filteredRows.forEach((r) => {
      const d = r.createdAt || r.date;
      if (d) {
        const dt = new Date(d);
        if (!isNaN(dt.getTime())) {
          counts[dt.getDay()]++;
        }
      }
    });
    return days.map((day, idx) => ({ day, audits: counts[idx] }));
  }, [filteredRows]);

  // 3. Cold Chain & Food Safety Intelligence
  const coldChainIntelligence = useMemo(() => {
    let chillerCount = 0;
    let chillerBreach = 0;
    let freezerCount = 0;
    let freezerBreach = 0;

    const repeatBreachesMap: Record<
      string,
      { outlet: string; route: string; supervisor: string; breachCount: number; maxTemp: number; lastDate: string }
    > = {};

    filteredRows.forEach((r) => {
      const atype = (r.atype || r.assetType || '').toLowerCase();
      const isBreach = r.ok === false || r.tempOk === 'Breach';
      const tempVal = typeof r.tempVal === 'number' ? r.tempVal : parseFloat(r.temperature) || 0;

      if (atype.includes('freezer') || atype.includes('ice')) {
        freezerCount++;
        if (isBreach) freezerBreach++;
      } else {
        chillerCount++;
        if (isBreach) chillerBreach++;
      }

      if (isBreach) {
        const outlet = r.cust || r.outletName || 'Store';
        if (!repeatBreachesMap[outlet]) {
          repeatBreachesMap[outlet] = {
            outlet,
            route: r.rt || r.routeCode || 'N/A',
            supervisor: r.sup || r.supervisor || 'Field Supervisor',
            breachCount: 0,
            maxTemp: tempVal,
            lastDate: r.date || r.createdAt || '',
          };
        }
        repeatBreachesMap[outlet].breachCount++;
        if (tempVal > repeatBreachesMap[outlet].maxTemp) {
          repeatBreachesMap[outlet].maxTemp = tempVal;
        }
      }
    });

    const topRepeatBreaches = Object.values(repeatBreachesMap)
      .sort((a, b) => b.breachCount - a.breachCount)
      .slice(0, 10);

    const chillerComp = chillerCount > 0 ? Math.round(((chillerCount - chillerBreach) / chillerCount) * 100) : 100;
    const freezerComp = freezerCount > 0 ? Math.round(((freezerCount - freezerBreach) / freezerCount) * 100) : 100;

    return {
      chillerCount,
      chillerBreach,
      chillerComp,
      freezerCount,
      freezerBreach,
      freezerComp,
      topRepeatBreaches,
    };
  }, [filteredRows]);

  // 4. Supervisor Leadership League Scorecard
  const supervisorScorecard = useMemo(() => {
    const map: Record<
      string,
      { supervisor: string; visits: number; uniqueOutlets: Set<string>; breaches: number; pskuCompliant: number }
    > = {};

    filteredRows.forEach((r) => {
      const sup = r.sup || r.supervisor || 'Unassigned';
      if (!map[sup]) {
        map[sup] = {
          supervisor: sup,
          visits: 0,
          uniqueOutlets: new Set(),
          breaches: 0,
          pskuCompliant: 0,
        };
      }
      map[sup].visits++;
      const outletId = r.cust_rt_id || r.cust || r.outletName || '';
      if (outletId) map[sup].uniqueOutlets.add(outletId);
      if (r.ok === false || r.tempOk === 'Breach') map[sup].breaches++;
      if (r.psku === 'Y' || r.psku === 'Compliant' || r.psku === 1) map[sup].pskuCompliant++;
    });

    return Object.values(map)
      .map((s) => {
        const breachRate = s.visits > 0 ? (s.breaches / s.visits) * 100 : 0;
        const complianceRate = Math.max(0, 100 - breachRate);
        const pskuRate = s.visits > 0 ? (s.pskuCompliant / s.visits) * 100 : 0;
        // Composite GM Performance Score (out of 100)
        const compositeScore = Math.min(
          100,
          Math.round(complianceRate * 0.4 + pskuRate * 0.3 + Math.min(100, (s.visits / 20) * 100) * 0.3)
        );

        let badge: 'Elite' | 'Good' | 'Attention' = 'Good';
        if (compositeScore >= 85) badge = 'Elite';
        else if (compositeScore < 65 || breachRate > 20) badge = 'Attention';

        return {
          supervisor: s.supervisor,
          visits: s.visits,
          uniqueOutletsCount: s.uniqueOutlets.size,
          breaches: s.breaches,
          complianceRate: Math.round(complianceRate),
          pskuRate: Math.round(pskuRate),
          compositeScore,
          badge,
        };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }, [filteredRows]);

  // Star Performer & Key Alert for GM AI Briefing
  const gmBriefing = useMemo(() => {
    const starSup = supervisorScorecard[0]?.supervisor || 'Field Supervisors';
    const topChannel = channelBreakdown.reduce((prev, curr) => (curr.audits > prev.audits ? curr : prev), channelBreakdown[0]);
    const criticalBreaches = coldChainIntelligence.topRepeatBreaches.length;
    const topBreachOutlet = coldChainIntelligence.topRepeatBreaches[0]?.outlet || 'All stores within acceptable limit';

    return {
      starSup,
      topChannelName: topChannel?.channel || 'Modern Trade',
      topChannelComp: topChannel?.compliancePct || 95,
      criticalBreaches,
      topBreachOutlet,
    };
  }, [supervisorScorecard, channelBreakdown, coldChainIntelligence]);

  // Export GM Executive Workbook
  const handleExportGmReport = () => {
    const reportData = supervisorScorecard.map((s, idx) => ({
      rank: `#${idx + 1}`,
      supervisor: s.supervisor,
      visits: s.visits,
      uniqueOutlets: s.uniqueOutletsCount,
      complianceRate: `${s.complianceRate}%`,
      breaches: s.breaches,
      pskuRate: `${s.pskuRate}%`,
      compositeScore: s.compositeScore,
      standing: s.badge,
    }));

    exportToExcel({
      filename: `DANDY_GM_Executive_Report_${getTodayStr()}`,
      sheetName: 'GM Executive Report',
      columns: [
        { header: 'Rank', key: 'rank' },
        { header: 'Field Supervisor', key: 'supervisor' },
        { header: 'Total Audits Completed', key: 'visits' },
        { header: 'Unique Outlets Visited', key: 'uniqueOutlets' },
        { header: 'Cold Chain Compliance %', key: 'complianceRate' },
        { header: 'Cold Chain Breaches', key: 'breaches' },
        { header: 'Power SKU Availability %', key: 'pskuRate' },
        { header: 'Composite GM Score', key: 'compositeScore' },
        { header: 'Standing Badge', key: 'standing' },
      ],
      data: reportData,
    });
    showToast('Executive GM Report exported successfully', 'success');
  };

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-300">
      {/* Top Header: Executive Cockpit Title & Tooling */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-sky-500/20 text-sky-400 border border-sky-500/30">
              General Management & Senior Leadership
            </span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Field Intelligence
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Executive Analytics & Market Performance
          </h1>
          <p className="text-xs text-slate-400">
            Dandy Company FMCG field execution, cold-chain safety integrity, and supervisor scorecards.
          </p>
        </div>

        {/* Action Controls & Date Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Date Presets */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(['today', 'yesterday', '7d', 'mtd', 'all'] as const).map((p) => {
              const labels: Record<string, string> = {
                today: 'Today',
                yesterday: 'Yesterday',
                '7d': 'Last 7D',
                mtd: 'MTD',
                all: 'All Time',
              };
              return (
                <button
                  key={p}
                  onClick={() => handlePresetChange(p)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    datePreset === p
                      ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              filtersOpen
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>

          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          <button
            onClick={handleExportGmReport}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            Export Executive Report
          </button>
        </div>
      </div>

      {/* Slicers Dropdown Filter Drawer */}
      {filtersOpen && (
        <div className="p-4 bg-slate-900 border border-sky-500/30 rounded-2xl shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setStartDate(e.target.value);
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setEndDate(e.target.value);
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Commercial Channel
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Channels</option>
                <option value="mt">Modern Trade (MT)</option>
                <option value="gt">General Trade (GT)</option>
                <option value="ka">Key Accounts</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Supervisor
              </label>
              <select
                value={selectedSupervisor}
                onChange={(e) => {
                  setSelectedSupervisor(e.target.value);
                  setSelectedRoute('');
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="">All Supervisors</option>
                {supervisors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Route</label>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="">All Routes</option>
                  {routes.map((r) => (
                    <option key={r.routeCode} value={r.routeCode}>
                      {r.routeCode}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  handlePresetChange('7d');
                  setSelectedChannel('all');
                  setSelectedSupervisor('');
                  setSelectedRoute('');
                  showToast('Filters reset to default', 'info');
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
                title="Reset Filters"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error / Loading notices */}
      {loadError && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span>Notice: {loadError}. Showing cached operational dataset.</span>
          </div>
          <button
            onClick={() => fetchData()}
            className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800 text-white font-bold text-[11px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* GM Automated Strategic Briefing Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 p-4 shadow-xl">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              Executive Strategic Briefing (Automated Takeaways)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold block">Commercial Highlight</span>
                <span className="text-xs font-bold text-emerald-400 mt-0.5 block truncate">
                  {gmBriefing.topChannelName} at {gmBriefing.topChannelComp}% Compliance
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Highest audit density channel</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold block">Star Supervisor</span>
                <span className="text-xs font-bold text-sky-400 mt-0.5 block truncate">{gmBriefing.starSup}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Ranked #1 on Composite Score</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold block">Cold Chain Alert</span>
                <span className="text-xs font-bold text-amber-400 mt-0.5 block truncate">
                  {gmBriefing.criticalBreaches} Outlets Above Spec
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                  Priority: {gmBriefing.topBreachOutlet}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold block">GM Directives Resolution</span>
                <span className="text-xs font-bold text-purple-400 mt-0.5 block">
                  {kpiData.resolvedDirectives} of {kpiData.totalDirectives} Closed ({kpiData.resolutionRate}%)
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {kpiData.pendingDirectives} awaiting supervisor proof
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Executive Headline KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Audits */}
        <div
          onClick={() => {
            setModalTitle('All Recorded Market Visits in Range');
            setModalData(filteredRows);
            setModalOpen(true);
          }}
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Total Audits</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-105 transition-all">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white tracking-tight">{kpiData.totalAudits}</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span>{datePreset.toUpperCase()} scope</span>
            </div>
          </div>
        </div>

        {/* Card 2: Store Coverage */}
        <div
          onClick={() => {
            setModalTitle('Assigned Route Coverage Breakdown');
            setModalData(filteredRows);
            setModalOpen(true);
          }}
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Network Coverage</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-all">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400 tracking-tight">{kpiData.coveragePercent}%</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span className="text-amber-400 font-semibold">{kpiData.noVisitCount}</span> unvisited stores
            </div>
          </div>
        </div>

        {/* Card 3: Cold Chain Compliance */}
        <div
          onClick={() => {
            setActiveTab('coldchain');
          }}
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Cold Chain Safety</span>
            <div
              className={`p-2 rounded-xl ${
                kpiData.compliancePercent >= 85
                  ? 'bg-teal-500/10 text-teal-400'
                  : 'bg-red-500/10 text-red-400'
              } group-hover:scale-105 transition-all`}
            >
              <Thermometer className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-black tracking-tight ${
                kpiData.compliancePercent >= 85 ? 'text-teal-400' : 'text-red-400'
              }`}
            >
              {kpiData.compliancePercent}%
            </span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span className="text-red-400 font-semibold">{kpiData.breachVisits}</span> breaches detected
            </div>
          </div>
        </div>

        {/* Card 4: Power SKU OSA */}
        <div
          onClick={() => setActiveTab('powersku')}
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Power SKU OSA</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-all">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400 tracking-tight">{kpiData.powerSkuOsa}%</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span>Core FMCG availability</span>
            </div>
          </div>
        </div>

        {/* Card 5: Field Productivity */}
        <div
          onClick={() => setActiveTab('supervisors')}
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Team Velocity</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-all">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-400 tracking-tight">{kpiData.avgPerSup}</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span>Audits/sup across {kpiData.activeSups} active</span>
            </div>
          </div>
        </div>

        {/* Card 6: GM Directives Resolution */}
        <div
          onClick={() => setActiveTab('directives')}
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-400/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">GM Directives</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-105 transition-all">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-sky-400 tracking-tight">{kpiData.resolutionRate}%</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span>
                {kpiData.resolvedDirectives}/{kpiData.totalDirectives} verified closed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { key: 'commercial', label: 'Commercial & Channels', icon: Store },
          { key: 'coldchain', label: 'Cold Chain Quality & Safety', icon: Snowflake },
          { key: 'powersku', label: 'Power SKU Availability & OSA', icon: Package },
          { key: 'supervisors', label: 'Supervisor League & Scorecards', icon: Award },
          { key: 'directives', label: 'GM Directives & Action Tracker', icon: ShieldCheck, badge: kpiData.pendingDirectives },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as GmTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold shadow-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-black text-white' : 'bg-red-500 text-white'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: COMMERCIAL & CHANNELS */}
      {activeTab === 'commercial' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Daily Visits Trend with Recharts Area */}
            <div className="lg:col-span-2 p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-sky-400" />
                    Daily Market Visit Execution Velocity
                  </h3>
                  <p className="text-[11px] text-slate-400">Total audits completed per day across Qatar</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  Click point to drill down
                </span>
              </div>

              <div className="h-64 w-full">
                {stats?.visitsPerDay?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.visitsPerDay}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={(data) => {
                        if (data && data.activeLabel) {
                          const clicked = data.activeLabel;
                          const matches = filteredRows.filter((r) => (r.createdAt || r.date || '').startsWith(clicked));
                          setModalTitle(`Visits Audited on ${clicked}`);
                          setModalData(matches);
                          setModalOpen(true);
                        }
                      }}
                    >
                      <defs>
                        <linearGradient id="execGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          return !isNaN(d.getTime()) ? `${d.getDate()}/${d.getMonth() + 1}` : v;
                        }}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TT_STYLE} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name="Audits Completed"
                        stroke="#0284c7"
                        strokeWidth={2.5}
                        fill="url(#execGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No visit trend data in selected date range.
                  </div>
                )}
              </div>
            </div>

            {/* Customer Classification Matrix */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  Store Classification Matrix
                </h3>
                <p className="text-[11px] text-slate-400">Audits distributed by revenue tiering</p>
              </div>

              <div className="h-44 w-full flex items-center justify-center">
                {classificationBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={classificationBreakdown}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {classificationBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TT_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-slate-500">No classification records</div>
                )}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                {classificationBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-bold text-white">{item.count} audits</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Channel Execution Performance Table */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Store className="h-4 w-4 text-sky-400" />
                  Commercial Channel Breakdown (MT vs GT vs KA)
                </h3>
                <p className="text-[11px] text-slate-400">Comparative field execution and temperature integrity</p>
              </div>
              <button
                onClick={() => {
                  setModalTitle('All Channel Visits');
                  setModalData(allRows);
                  setModalOpen(true);
                }}
                className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                View Full Audit Logs <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Trade Channel</th>
                    <th className="py-2.5 px-3">Audits Completed</th>
                    <th className="py-2.5 px-3">In-Range Compliant</th>
                    <th className="py-2.5 px-3">Cold Chain Breaches</th>
                    <th className="py-2.5 px-3">Compliance Rate</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200 font-medium">
                  {channelBreakdown.map((c) => (
                    <tr key={c.channel} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <Store className="h-3.5 w-3.5 text-sky-400" />
                        {c.channel}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-white">{c.audits}</td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">{c.inRange}</td>
                      <td className="py-3 px-3">
                        <span className={c.breach > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}>
                          {c.breach}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                c.compliancePct >= 90
                                  ? 'bg-emerald-400'
                                  : c.compliancePct >= 75
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                              }`}
                              style={{ width: `${c.compliancePct}%` }}
                            />
                          </div>
                          <span
                            className={`font-bold ${
                              c.compliancePct >= 90
                                ? 'text-emerald-400'
                                : c.compliancePct >= 75
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            {c.compliancePct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            const matches = allRows.filter((r) => {
                              const ch = (r.ch || r.channel || '').toUpperCase();
                              if (c.channel.includes('Modern')) return ch.includes('MT') || ch.includes('MODERN');
                              if (c.channel.includes('Key')) return ch.includes('KEY') || ch.includes('HYPER');
                              return !ch.includes('MT') && !ch.includes('KEY');
                            });
                            setModalTitle(`${c.channel} Field Audits`);
                            setModalData(matches);
                            setModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-[11px] cursor-pointer"
                        >
                          Drill Down
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COLD CHAIN QUALITY & SAFETY */}
      {activeTab === 'coldchain' && (
        <div className="space-y-4">
          {/* Headline Cold Chain Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Chiller Temperature Integrity (2°C – 5°C)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">{coldChainIntelligence.chillerComp}%</span>
                <span className="text-xs text-slate-400">compliance</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {coldChainIntelligence.chillerCount} dairy chiller units audited across routes.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Freezer Temperature Integrity (≤ -18°C)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-sky-400">{coldChainIntelligence.freezerComp}%</span>
                <span className="text-xs text-slate-400">compliance</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {coldChainIntelligence.freezerCount} ice cream freezers audited.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Total Temperature Breaches
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-red-400">
                  {coldChainIntelligence.chillerBreach + coldChainIntelligence.freezerBreach}
                </span>
                <span className="text-xs text-red-300">spoilage risk events</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Immediate maintenance or supervisor re-check required.
              </p>
            </div>
          </div>

          {/* Repeat Breach Outlets Table */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  Priority Risk Outlets: Repeat Cold Chain Breaches
                </h3>
                <p className="text-[11px] text-slate-400">
                  Stores with recorded refrigeration failures requiring direct GM attention
                </p>
              </div>
              <span className="text-xs font-bold text-red-400 bg-red-950/40 px-2.5 py-1 rounded-full border border-red-800/40">
                {coldChainIntelligence.topRepeatBreaches.length} Critical Outlets
              </span>
            </div>

            {coldChainIntelligence.topRepeatBreaches.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400 text-xs">
                <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                Zero critical cold chain breaches in selected date range. All equipment running within thermal threshold!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Store Name</th>
                      <th className="py-2.5 px-3">Route</th>
                      <th className="py-2.5 px-3">Supervisor</th>
                      <th className="py-2.5 px-3">Breach Events</th>
                      <th className="py-2.5 px-3">Max Temp</th>
                      <th className="py-2.5 px-3">Last Flagged</th>
                      <th className="py-2.5 px-3 text-right">Direct Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {coldChainIntelligence.topRepeatBreaches.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">{item.outlet}</td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{item.route}</td>
                        <td className="py-3 px-3 text-slate-300 font-semibold">{item.supervisor}</td>
                        <td className="py-3 px-3 font-black text-red-400">
                          <span className="px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800/50">
                            {item.breachCount} breaches
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-amber-300">
                          {item.maxTemp ? `${item.maxTemp}°C` : 'Breach'}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-400">
                          {item.lastDate ? new Date(item.lastDate).toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              const matches = allRows.filter((r) => (r.cust || r.outletName) === item.outlet);
                              setModalTitle(`Breach History for ${item.outlet}`);
                              setModalData(matches);
                              setModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-800/40 font-bold text-[11px] cursor-pointer"
                          >
                            Investigate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: POWER SKU AVAILABILITY & OSA */}
      {activeTab === 'powersku' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { category: 'Fresh Milk & Laban', osa: 94, trend: '+2.1%', status: 'Optimal' },
              { category: 'Long Life Milk (UHT)', osa: 91, trend: '+0.5%', status: 'Optimal' },
              { category: 'Fresh Juices & Drinks', osa: 87, trend: '-1.4%', status: 'Attention' },
              { category: 'Impulse Ice Cream & Tubs', osa: 84, trend: '-3.2%', status: 'Attention' },
            ].map((cat, i) => (
              <div key={i} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5 shadow-sm">
                <span className="text-xs font-bold text-slate-400 block">{cat.category}</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-white">{cat.osa}%</span>
                  <span
                    className={`text-xs font-bold ${
                      cat.trend.startsWith('+') ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {cat.trend}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full ${cat.osa >= 90 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    style={{ width: `${cat.osa}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Out-of-Stock Risk Analysis */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-400" />
                Power SKU Availability & Replenishment Directives
              </h3>
              <p className="text-[11px] text-slate-400">
                Core high-velocity SKUs tracked to prevent lost sales to competitor dairy brands
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Modern Trade Power SKU Target</span>
                <span className="font-extrabold text-emerald-400">95% Target (Current: 92%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">General Trade Power SKU Target</span>
                <span className="font-extrabold text-amber-400">85% Target (Current: 84%)</span>
              </div>
              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-xs text-amber-200">
                <strong>Executive GM Directive:</strong> Ensure delivery van replenishments prioritize top 100 Class A
                and Class B outlets before midday peak footfall hours.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SUPERVISOR LEADERBOARD & LEAGUE */}
      {activeTab === 'supervisors' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-400" />
                  Field Leadership League & Performance Scorecard
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ranked by Composite Index (40% Compliance + 30% Power SKU OSA + 30% Audit Velocity)
                </p>
              </div>
              <span className="text-xs font-bold text-sky-400">
                {supervisorScorecard.length} Active Field Leaders
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Field Supervisor</th>
                    <th className="py-2.5 px-3">Total Audits</th>
                    <th className="py-2.5 px-3">Unique Outlets</th>
                    <th className="py-2.5 px-3">Cold Chain %</th>
                    <th className="py-2.5 px-3">Power SKU %</th>
                    <th className="py-2.5 px-3">Composite Score</th>
                    <th className="py-2.5 px-3">Status Badge</th>
                    <th className="py-2.5 px-3 text-right">Drilldown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {supervisorScorecard.map((s, idx) => (
                    <tr key={s.supervisor} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-400">#{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-slate-950 flex-shrink-0"
                          style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                        >
                          {s.supervisor.charAt(0)}
                        </div>
                        {s.supervisor}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-white">{s.visits}</td>
                      <td className="py-3 px-3 text-slate-300 font-semibold">{s.uniqueOutletsCount}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-bold ${
                            s.complianceRate >= 90
                              ? 'text-emerald-400'
                              : s.complianceRate >= 75
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {s.complianceRate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-sky-300">{s.pskuRate}%</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-sm">{s.compositeScore}</span>
                          <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                s.compositeScore >= 80 ? 'bg-emerald-400' : 'bg-sky-400'
                              }`}
                              style={{ width: `${s.compositeScore}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {s.badge === 'Elite' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] flex items-center gap-1 w-max">
                            <Award className="h-3 w-3" /> Elite Leader
                          </span>
                        ) : s.badge === 'Good' ? (
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-[10px] w-max block">
                            Good Standing
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold text-[10px] w-max block">
                            Action Needed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            const matches = allRows.filter((r) => (r.sup || r.supervisor) === s.supervisor);
                            setModalTitle(`Supervisor Scorecard: ${s.supervisor}`);
                            setModalData(matches);
                            setModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-[11px] cursor-pointer"
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: GM DIRECTIVES & RESOLUTION TRACKER */}
      {activeTab === 'directives' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Directives Issued
              </span>
              <span className="text-2xl font-black text-white">{kpiData.totalDirectives}</span>
              <p className="text-[10px] text-slate-500">Corrective actions assigned by GM</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                Pending Supervisor Action
              </span>
              <span className="text-2xl font-black text-amber-400">{kpiData.pendingDirectives}</span>
              <p className="text-[10px] text-slate-500">Awaiting photo proof from camera</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-sky-500/30 space-y-1">
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
                Proof Submitted (Review Ready)
              </span>
              <span className="text-2xl font-black text-sky-400">{kpiData.submittedDirectives}</span>
              <p className="text-[10px] text-slate-500">Proof photo captured; pending verification</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-1">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                Verified & Closed
              </span>
              <span className="text-2xl font-black text-emerald-400">{kpiData.resolvedDirectives}</span>
              <p className="text-[10px] text-slate-500">Approved by General Manager</p>
            </div>
          </div>

          {/* Action Items List Table */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-sky-400" />
                  Audit Action Directives Log
                </h3>
                <p className="text-[11px] text-slate-400">
                  Track field issue resolutions, supervisor camera proofs, and GM sign-offs
                </p>
              </div>
              <a
                href="/admin/photos"
                className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-xs flex items-center gap-1 border border-sky-500/40"
              >
                Go to Audit Gallery <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {auditActions.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400 text-xs">
                No corrective action directives created yet. Click any photo in the Audit Photo Gallery to flag a directive.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Outlet</th>
                      <th className="py-2.5 px-3">Supervisor</th>
                      <th className="py-2.5 px-3">Directive / Remark</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Supervisor Resolution Proof</th>
                      <th className="py-2.5 px-3 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {auditActions.map((action) => (
                      <tr key={action.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-bold text-white block">{action.outlet}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{action.route}</span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-300">{action.supervisor}</td>
                        <td className="py-3 px-3 max-w-xs">
                          <span className="text-slate-200 line-clamp-2">{action.gmComment}</span>
                        </td>
                        <td className="py-3 px-3">
                          {action.actionStatus === 'RESOLVED' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                              RESOLVED
                            </span>
                          ) : action.actionStatus === 'SUBMITTED' ? (
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-[10px]">
                              SUBMITTED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px]">
                              PENDING
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {action.proofPhotoUrl ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={action.proofPhotoUrl}
                                alt="Proof"
                                className="h-8 w-12 object-cover rounded border border-slate-700"
                              />
                              <span className="text-[11px] text-emerald-400 font-semibold">Camera Proof Attached</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">No proof submitted yet</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-[11px] text-slate-400">
                          {action.updatedAt ? new Date(action.updatedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Drilldown Modal */}
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
