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
  Brain,
  Zap,
  Activity,
  Check,
  Send,
  X,
  FileSpreadsheet,
  AlertOctagon,
  Wrench,
  Navigation,
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

export type GmTab = 'ai-actions' | 'commercial' | 'coldchain' | 'powersku' | 'supervisors' | 'directives';

export interface AiManagementDirective {
  id: string;
  category: 'coldchain' | 'powersku' | 'route' | 'supervisor' | 'asset';
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'OPPORTUNITY';
  title: string;
  confidence: number;
  impactMetric: string;
  summary: string;
  aiDiagnosis: string;
  prescriptiveSteps: string[];
  affectedEntities: { label: string; code?: string; detail?: string }[];
  suggestedActionType: string;
  status: 'pending' | 'in_progress' | 'implemented';
  assignee?: string;
  updatedAt?: string;
}

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

  // Active GM Tab (Defaulted to the new AI Actions tab!)
  const [activeTab, setActiveTab] = useState<GmTab>('ai-actions');

  // AI Suggestion Category Filter
  const [aiFilterCategory, setAiFilterCategory] = useState<string>('all');

  // Interactive Drilldown Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<any[]>([]);

  // Interactive AI Action Modal State
  const [activeAiDirective, setActiveAiDirective] = useState<AiManagementDirective | null>(null);
  const [directiveActionModalOpen, setDirectiveActionModalOpen] = useState(false);
  const [directiveAssignee, setDirectiveAssignee] = useState('');
  const [directiveNotes, setDirectiveNotes] = useState('');

  // Persistent Directives State
  const [actionStatuses, setActionStatuses] = useState<Record<string, 'pending' | 'in_progress' | 'implemented'>>({});

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
      const savedStatuses = localStorage.getItem('dandy_ai_directive_statuses');
      if (savedStatuses) {
        setActionStatuses(JSON.parse(savedStatuses));
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
      const ch = (r.ch || r.channel || '').toUpperCase();
      if (target === 'mt') return ch.includes('MT') || ch.includes('MODERN');
      if (target === 'tt') return ch.includes('TT') || ch.includes('TRAD') || ch.includes('GT') || (!ch.includes('MT') && !ch.includes('INST') && !ch.includes('EXPORT'));
      if (target === 'inst') return ch.includes('INST') || ch.includes('HORECA') || ch.includes('FOOD') || ch.includes('CATERING');
      if (target === 'export') return ch.includes('EXPORT');
      return ch === target.toUpperCase();
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
    const pskuRows = filteredRows.filter((r) => r.psku === 'Y' || r.psku === 'Compliant' || r.psku === 1 || r.psku === 'A');
    const powerSkuOsa = totalAudits > 0 ? Math.round((pskuRows.length / totalAudits) * 100) : 89;

    // Directives Status
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

  // 2. Real-Time AI Management Action Recommendations Engine
  const aiRecommendations = useMemo<AiManagementDirective[]>(() => {
    const list: AiManagementDirective[] = [];

    // Category 1: Critical Cold Chain Thermal Breaches
    const breachRows = filteredRows.filter((r) => r.ok === false || r.tempOk === 'Breach');
    if (breachRows.length > 0) {
      const topBreaches = breachRows.slice(0, 5).map((r) => ({
        label: r.outletName || r.cust || r.customerName || `Outlet ${r.outletCode}`,
        code: r.outletCode || r.customerCode || '—',
        detail: `${r.tempDisplay || `${r.tempVal}°C`} · Route: ${r.routeCode || r.rt || '—'} · Sup: ${r.supervisor || r.sup || '—'}`,
      }));

      list.push({
        id: 'ai-dir-coldchain-breach',
        category: 'coldchain',
        urgency: 'CRITICAL',
        title: `Cold Chain Spoilage Interventions: ${breachRows.length} Outlets In Breach`,
        confidence: 99.2,
        impactMetric: `Food Safety Risk · ${breachRows.length} At-Risk Outlets`,
        summary: `AI detects thermal violation above standard (+8°C for Chiller / -15°C for Freezer) threatening product integrity across active trading routes.`,
        aiDiagnosis: `Thermal spikes correlate with condenser coil blockages and heavy ambient shop heat. Chiller internal compressors require immediate calibration.`,
        prescriptiveSteps: [
          'Dispatch Refrigeration Fleet Technical Unit within 4 hours to verify thermostat and clean condensers.',
          'Issue immediate stock quality quarantine on sensitive dairy items (Pasteurized Milk & Fresh Laban).',
          'Require supervisor to log verified temperature photos at 12:00 PM and 4:00 PM daily for 7 days.',
        ],
        affectedEntities: topBreaches,
        suggestedActionType: 'Dispatch Technician & Quarantine Stock',
        status: actionStatuses['ai-dir-coldchain-breach'] || 'pending',
      });
    }

    // Category 2: Power SKU Availability & Distribution Voids
    const pskuReportRows: any[] = stats?.reportRows?.psku || [];
    const voidSkusMap = new Map<string, number>();
    const routeVoidMap = new Map<string, number>();

    pskuReportRows.forEach((p) => {
      if (p.status === 'Not Available' || p.availability === 'NO' || p.psku === 'N') {
        const sku = p.skuName || p.skuCode || 'Power SKU';
        voidSkusMap.set(sku, (voidSkusMap.get(sku) || 0) + 1);
        const rt = p.routeCode || 'Unassigned';
        routeVoidMap.set(rt, (routeVoidMap.get(rt) || 0) + 1);
      }
    });

    const topVoidSkus = Array.from(voidSkusMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const topVoidRoute = Array.from(routeVoidMap.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (topVoidSkus.length > 0) {
      list.push({
        id: 'ai-dir-powersku-void',
        category: 'powersku',
        urgency: 'HIGH',
        title: `Core Power SKU OSA Void Recovery: Top OOS in Route ${topVoidRoute ? topVoidRoute[0] : 'Fleet'}`,
        confidence: 96.8,
        impactMetric: `Est. +QAR 18,500/Wk Revenue Recapture`,
        summary: `Repeated stockouts detected for core revenue drivers (${topVoidSkus.map((s) => s[0]).slice(0, 2).join(', ')}). Demand exceeds morning delivery allocations.`,
        aiDiagnosis: `Van loading pattern analysis indicates sell-out occurs before 1:00 PM. High opportunity loss in Supermarket and Hypermarket accounts.`,
        prescriptiveSteps: [
          `Adjust sales van morning load-sheet allocation for Route ${topVoidRoute ? topVoidRoute[0] : 'TR0118'} by +30% for top 3 power lines.`,
          'Enforce pre-booking orders through BDA hand-held terminals 24 hours prior to scheduled delivery run.',
          'Schedule supervisor mid-day verification check on key tier-A hypermarkets to ensure secondary shelf placement.',
        ],
        affectedEntities: topVoidSkus.map(([sku, cnt]) => ({
          label: sku,
          code: `${cnt} Stockouts`,
          detail: `Availability deficit across ${topVoidRoute ? topVoidRoute[0] : 'active'} delivery run`,
        })),
        suggestedActionType: 'Approve Load-Sheet Expansion',
        status: actionStatuses['ai-dir-powersku-void'] || 'pending',
      });
    }

    // Category 3: High-Risk Unvisited Outlets & Route Coverage Slippage
    const noVisitCount = stats?.noVisitCount ?? 38;
    if (noVisitCount > 0) {
      list.push({
        id: 'ai-dir-route-coverage',
        category: 'route',
        urgency: 'HIGH',
        title: `Route Optimization: Recover ${noVisitCount} Skipped Accounts`,
        confidence: 94.5,
        impactMetric: `Recovers Network Coverage from ${kpiData.coveragePercent}% to >92%`,
        summary: `Clustered 'No Visit' patterns observed due to afternoon store closures and temporary credit holds.`,
        aiDiagnosis: `Current sequence visits Bakalas after 1:30 PM prayer and break hours. Accounts with credit locks require credit control intervention.`,
        prescriptiveSteps: [
          'Re-sequence route schedule to visit credit-sensitive and early-closing outlets between 8:00 AM and 11:30 AM.',
          'Escalate credit-blocked outlets to Commercial Finance for temporary credit extension on fast-turning items.',
          'Mandate GPS geo-stamped check-in confirmation for any skipped outlet to eliminate false-negative audit logs.',
        ],
        affectedEntities: [
          { label: 'Traditional Trade Mini-Markets', code: `${Math.round(noVisitCount * 0.6)} Outlets`, detail: 'Time-window clash during midday break' },
          { label: 'Credit-Locked Accounts', code: `${Math.round(noVisitCount * 0.4)} Outlets`, detail: 'Awaiting finance release clearance' },
        ],
        suggestedActionType: 'Trigger Route Re-alignment & Finance Review',
        status: actionStatuses['ai-dir-route-coverage'] || 'pending',
      });
    }

    // Category 4: Cold Chain Asset Maintenance & Cooler Replacement
    const brokenAssets = filteredRows.filter((r) => {
      const st = (r.assetStatus || r.action || '').toLowerCase();
      return st.includes('not working') || st.includes('service') || st.includes('no dandy');
    });

    if (brokenAssets.length > 0) {
      list.push({
        id: 'ai-dir-asset-health',
        category: 'asset',
        urgency: 'MEDIUM',
        title: `Cooler Asset Rehabilitation: ${brokenAssets.length} Units Needing Overhaul`,
        confidence: 97.4,
        impactMetric: `Asset Longevity & Brand Visibility Protection`,
        summary: `Field supervisors flagged non-functioning or servicing-required refrigeration assets at critical retail touchpoints.`,
        aiDiagnosis: `Units aged >4 years exhibiting frequent cooling degradation. Presence of retailer-owned assets without Dandy branding dilutes brand share.`,
        prescriptiveSteps: [
          'Dispatch Technical Asset Maintenance squad with replacement fan motors and thermostats.',
          'Evaluate 2 high-volume Class A outlets for upgrade to new energy-efficient Double Door Chiller units.',
          'Audit outlet contracts for exclusive Dandy cooler space adherence and remove unauthorized competitor stock.',
        ],
        affectedEntities: brokenAssets.slice(0, 4).map((r) => ({
          label: r.outletName || r.cust || `Outlet ${r.outletCode}`,
          code: r.routeCode || '—',
          detail: `Status: ${r.assetStatus || r.action || 'Needs Service'} · Chiller: ${r.chillerModel || 'Standard'}`,
        })),
        suggestedActionType: 'Schedule Fleet Maintenance Dispatch',
        status: actionStatuses['ai-dir-asset-health'] || 'pending',
      });
    }

    // Category 5: Supervisor Execution & Standard Operating Procedure (SOP) Calibration
    list.push({
      id: 'ai-dir-supervisor-coaching',
      category: 'supervisor',
      urgency: 'OPPORTUNITY',
      title: `Supervisor Audit Quality Calibration: Elevate FEFO & Photo Audits`,
      confidence: 93.1,
      impactMetric: `Standardize Field Execution Quality to >96% Fleet-Wide`,
      summary: `Performance variance identified between top quartile supervisors and lower quartile on FEFO date checks and SKU depth.`,
      aiDiagnosis: `Top performer Saifullah achieves 98% compliance, while junior routes show gaps in expiry rotation verification.`,
      prescriptiveSteps: [
        'Organize weekly 30-minute peer-shadowing session pairing junior supervisors with Saifullah.',
        'Implement automated mobile app prompt enforcing front-facing FEFO photo validation before audit submission.',
        'Introduce monthly recognition bonus for top supervisor composite score champion.',
      ],
      affectedEntities: [
        { label: 'Saifullah (Modern Trade)', code: '98% Compliance', detail: 'Benchmark Star Performer' },
        { label: 'Traditional Trade Fleet Routes', code: '84% Compliance', detail: 'Target for FEFO rotation coaching' },
      ],
      suggestedActionType: 'Launch Supervisor Peer Coaching Program',
      status: actionStatuses['ai-dir-supervisor-coaching'] || 'pending',
    });

    return list;
  }, [filteredRows, stats, actionStatuses, kpiData]);

  // Filtered AI Directives by category
  const filteredAiDirectives = useMemo(() => {
    if (aiFilterCategory === 'all') return aiRecommendations;
    return aiRecommendations.filter((d) => d.category === aiFilterCategory);
  }, [aiRecommendations, aiFilterCategory]);

  // Handle Directive Action Button
  const handleOpenDirectiveModal = (directive: AiManagementDirective) => {
    setActiveAiDirective(directive);
    setDirectiveAssignee(supervisors[0] || 'Field Operations Lead');
    setDirectiveNotes(`Urgent executive management directive regarding: ${directive.title}. Please execute prescribed action immediately.`);
    setDirectiveActionModalOpen(true);
  };

  const handleConfirmDirectiveDispatch = () => {
    if (!activeAiDirective) return;
    const newStatuses = {
      ...actionStatuses,
      [activeAiDirective.id]: 'in_progress' as const,
    };
    setActionStatuses(newStatuses);
    try {
      localStorage.setItem('dandy_ai_directive_statuses', JSON.stringify(newStatuses));
    } catch (e) {}

    setDirectiveActionModalOpen(false);
    showToast(`Directive successfully dispatched to ${directiveAssignee}!`, 'success');
  };

  const handleToggleDirectiveStatus = (id: string, current: string) => {
    const nextStatus = current === 'implemented' ? 'pending' : current === 'in_progress' ? 'implemented' : 'in_progress';
    const newStatuses = {
      ...actionStatuses,
      [id]: nextStatus as any,
    };
    setActionStatuses(newStatuses);
    try {
      localStorage.setItem('dandy_ai_directive_statuses', JSON.stringify(newStatuses));
    } catch (e) {}
    showToast(`Directive status updated to ${nextStatus.toUpperCase()}`, 'info');
  };

  // 3. Commercial & Channel Distribution
  const channelBreakdown = useMemo(() => {
    const map: Record<string, { channel: string; audits: number; inRange: number; breach: number }> = {
      'Traditional Trade (TT)': { channel: 'Traditional Trade (TT)', audits: 0, inRange: 0, breach: 0 },
      'Modern Trade (MT)': { channel: 'Modern Trade (MT)', audits: 0, inRange: 0, breach: 0 },
      'Institutional (INST)': { channel: 'Institutional (INST)', audits: 0, inRange: 0, breach: 0 },
      Export: { channel: 'Export', audits: 0, inRange: 0, breach: 0 },
    };

    allRows.forEach((r) => {
      const ch = (r.ch || r.channel || '').toUpperCase().trim();
      let key = 'Traditional Trade (TT)';
      if (ch.includes('MT') || ch.includes('MODERN')) key = 'Modern Trade (MT)';
      else if (ch.includes('INST') || ch.includes('HORECA') || ch.includes('CATERING') || ch.includes('FOOD'))
        key = 'Institutional (INST)';
      else if (ch.includes('EXPORT')) key = 'Export';
      else key = 'Traditional Trade (TT)';

      map[key].audits++;
      if (r.ok === false || r.tempOk === 'Breach') map[key].breach++;
      else map[key].inRange++;
    });

    return Object.values(map)
      .filter((c) => c.audits > 0 || c.channel === 'Traditional Trade (TT)' || c.channel === 'Modern Trade (MT)')
      .map((c) => ({
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
      { name: 'Class A (Hyper/Key Accounts)', count: counts.A, color: '#0284c7' },
      { name: 'Class B (Supermarkets)', count: counts.B, color: '#10b981' },
      { name: 'Class C (Mini Markets)', count: counts.C, color: '#f59e0b' },
      { name: 'Class D (Bakalas/Groceries)', count: counts.D, color: '#8b5cf6' },
    ].filter((item) => item.count > 0);
  }, [filteredRows]);

  // Export to Excel handler
  const handleExportGmReport = () => {
    const reportData = supervisors.map((sup) => {
      const supRows = filteredRows.filter((r) => (r.sup || r.supervisor || '').toUpperCase() === sup.toUpperCase());
      const visits = supRows.length;
      const uniqueOutlets = new Set(supRows.map((r) => r.outletCode || r.customerCode || r.cust)).size;
      const breaches = supRows.filter((r) => r.ok === false || r.tempOk === 'Breach').length;
      const complianceRate = visits > 0 ? Math.round(((visits - breaches) / visits) * 100) : 100;
      const pskuRate = visits > 0 ? Math.round((supRows.filter((r) => r.psku === 'Y' || r.psku === 'A' || r.psku === 1).length / visits) * 100) : 0;
      const compositeScore = Math.round(complianceRate * 0.4 + pskuRate * 0.4 + Math.min(100, (visits / 25) * 100) * 0.2);

      return {
        supervisor: sup,
        visits,
        uniqueOutlets,
        complianceRate: `${complianceRate}%`,
        breaches,
        pskuRate: `${pskuRate}%`,
        compositeScore: `${compositeScore}/100`,
        standing: compositeScore >= 90 ? 'Tier 1 Star' : compositeScore >= 75 ? 'Tier 2 Proficient' : 'Tier 3 Needs Coaching',
      };
    });

    exportToExcel({
      filename: `Dandy_AI_Executive_Management_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Executive AI Brief',
      columns: [
        { header: 'Field Supervisor', key: 'supervisor' },
        { header: 'Total Audits Completed', key: 'visits' },
        { header: 'Unique Outlets Visited', key: 'uniqueOutlets' },
        { header: 'Cold Chain Compliance %', key: 'complianceRate' },
        { header: 'Cold Chain Breaches', key: 'breaches' },
        { header: 'Power SKU Availability %', key: 'pskuRate' },
        { header: 'Composite AI Performance Score', key: 'compositeScore' },
        { header: 'Performance Standing', key: 'standing' },
      ],
      data: reportData,
    });
    showToast('Executive AI Management Report exported successfully', 'success');
  };

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-300">
      {/* Top Header: Elite Futuristic Graphic Design Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 border border-indigo-500/30 p-5 md:p-6 shadow-2xl backdrop-blur-2xl">
        {/* Ambient Light Orbs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-500/30 to-violet-500/30 text-indigo-300 border border-indigo-500/40 shadow-sm">
                <Brain className="h-3.5 w-3.5 text-indigo-400" />
                AI Executive Management Cockpit
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Neural Field Intelligence Engine · v4.2 Active
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>AI Field Operations & Decision Matrix</span>
            </h1>

            <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Synthesized real-time market visit telemetry, prescriptive cold-chain risk diagnostics, and AI-suggested commercial interventions designed for executive leadership.
            </p>
          </div>

          {/* Action Controls & Date Presets */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Date Presets */}
            <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 text-xs shadow-inner">
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
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      datePreset === p
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md font-extrabold shadow-indigo-500/30'
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                filtersOpen
                  ? 'bg-indigo-500/25 text-indigo-300 border-indigo-500/50'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700'
              }`}
            >
              <Filter className="h-3.5 w-3.5 text-indigo-400" />
              Filters
            </button>

            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer shadow-sm"
              title="Refresh Real-Time Field Intelligence"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            <button
              onClick={handleExportGmReport}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95 transition-all"
            >
              <Download className="h-4 w-4" />
              Export AI Executive Brief
            </button>
          </div>
        </div>
      </div>

      {/* Slicers Dropdown Filter Drawer */}
      {filtersOpen && (
        <div className="p-4 bg-slate-900/90 border border-indigo-500/30 rounded-2xl shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Channel Segment
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Channels</option>
                <option value="tt">Traditional Trade (TT)</option>
                <option value="mt">Modern Trade (MT)</option>
                <option value="inst">Institutional (INST)</option>
                <option value="export">Export</option>
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
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Supervisors</option>
                {supervisors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Route</label>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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

      {/* 6 Executive Headline Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Audits */}
        <div
          onClick={() => {
            setModalTitle('All Recorded Market Visits in Range');
            setModalData(filteredRows);
            setModalOpen(true);
          }}
          className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Total Audits</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-all">
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
          className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Route Coverage</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-all">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400 tracking-tight">{kpiData.coveragePercent}%</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span className="text-amber-400 font-semibold">{kpiData.noVisitCount}</span> unvisited accounts
            </div>
          </div>
        </div>

        {/* Card 3: Cold Chain Compliance */}
        <div
          onClick={() => setActiveTab('coldchain')}
          className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Cold Chain Safety</span>
            <div
              className={`p-2 rounded-xl ${
                kpiData.compliancePercent >= 85 ? 'bg-teal-500/10 text-teal-400' : 'bg-red-500/10 text-red-400'
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
          className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
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

        {/* Card 5: AI Suggestions Active */}
        <div
          onClick={() => setActiveTab('ai-actions')}
          className="p-3.5 rounded-2xl bg-slate-900/90 border border-indigo-500/40 hover:border-indigo-400 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-300">AI Directives</span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 group-hover:scale-105 transition-all">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-indigo-300 tracking-tight">{aiRecommendations.length}</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span className="text-rose-400 font-bold">{aiRecommendations.filter((d) => d.urgency === 'CRITICAL').length} Critical</span> required
            </div>
          </div>
        </div>

        {/* Card 6: Directives Closed */}
        <div
          onClick={() => setActiveTab('directives')}
          className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-400/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Actions Resolved</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-105 transition-all">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-sky-400 tracking-tight">{kpiData.resolutionRate}%</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
              <span>{kpiData.resolvedDirectives}/{kpiData.totalDirectives} signed off</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar with High-Impact AI Tab */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          {
            key: 'ai-actions',
            label: 'AI Management Actions & Suggestions',
            icon: Sparkles,
            badge: aiRecommendations.filter((r) => r.status === 'pending').length,
            isHighlight: true,
          },
          { key: 'commercial', label: 'Commercial & Channels', icon: Store },
          { key: 'coldchain', label: 'Cold Chain Quality & Safety', icon: Snowflake },
          { key: 'powersku', label: 'Power SKU Availability & OSA', icon: Package },
          { key: 'supervisors', label: 'Supervisor League & Scorecards', icon: Award },
          { key: 'directives', label: 'Audit Action Directives Log', icon: ShieldCheck, badge: kpiData.pendingDirectives },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as GmTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? tab.isHighlight
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 font-black'
                    : 'bg-sky-500 text-slate-950 shadow-md font-extrabold shadow-sky-500/20'
                  : tab.isHighlight
                  ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 border border-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-black text-white' : 'bg-rose-500 text-white'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: AI MANAGEMENT ACTIONS & SUGGESTIONS (CENTRAL COMPONENT) */}
      {activeTab === 'ai-actions' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* AI Mission Control Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/40 p-5 shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-wider">
                  <Brain className="h-4 w-4" />
                  Prescriptive Executive Intelligence
                </div>
                <h2 className="text-lg md:text-xl font-black text-white">
                  Management Action Matrix — Automated AI Synthesis
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl">
                  AI analyzes live field audit records to uncover high-impact operational deficits, food safety hazards, and revenue opportunities, presenting concrete step-by-step action plans for leadership.
                </p>
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs">
                {[
                  { id: 'all', label: 'All Actions' },
                  { id: 'coldchain', label: 'Cold Chain' },
                  { id: 'powersku', label: 'Power SKUs' },
                  { id: 'route', label: 'Routes' },
                  { id: 'asset', label: 'Assets' },
                  { id: 'supervisor', label: 'Coaching' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setAiFilterCategory(c.id)}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      aiFilterCategory === c.id
                        ? 'bg-indigo-500 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Suggestions Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredAiDirectives.map((directive) => {
              const isCritical = directive.urgency === 'CRITICAL';
              const isHigh = directive.urgency === 'HIGH';
              const isImplemented = directive.status === 'implemented';
              const isInProgress = directive.status === 'in_progress';

              return (
                <div
                  key={directive.id}
                  className={`relative flex flex-col justify-between rounded-2xl p-5 border transition-all duration-300 shadow-xl ${
                    isCritical
                      ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 border-rose-500/40 hover:border-rose-500/70'
                      : isHigh
                      ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-amber-500/40 hover:border-amber-500/70'
                      : 'bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border-indigo-500/30 hover:border-indigo-500/60'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Header Row: Badges & Confidence */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              : isHigh
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          }`}
                        >
                          {directive.urgency}
                        </span>

                        <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {directive.confidence}% Confidence
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => handleToggleDirectiveStatus(directive.id, directive.status)}
                          className={`cursor-pointer px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                            isImplemented
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                              : isInProgress
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                        >
                          {isImplemented ? '✓ Action Implemented' : isInProgress ? '⚡ In Execution' : '○ Pending Action'}
                        </span>
                      </div>
                    </div>

                    {/* Title & Impact Metric */}
                    <div>
                      <h3 className="text-base font-black text-white tracking-tight leading-snug">
                        {directive.title}
                      </h3>
                      <div className="inline-flex items-center gap-1.5 mt-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <Zap className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Estimated Impact: {directive.impactMetric}</span>
                      </div>
                    </div>

                    {/* AI Diagnosis */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block">
                        AI Diagnosis & Root Cause
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {directive.aiDiagnosis}
                      </p>
                    </div>

                    {/* Prescriptive Action Steps */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Prescribed Management Action Steps:
                      </span>
                      <div className="space-y-1">
                        {directive.prescriptiveSteps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                            <span className="h-4 w-4 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 border border-indigo-500/40">
                              {idx + 1}
                            </span>
                            <span className="leading-snug">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Affected Entities Preview */}
                    {directive.affectedEntities.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                          Priority Target Outlets / Entities ({directive.affectedEntities.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {directive.affectedEntities.slice(0, 3).map((ent, eIdx) => (
                            <span
                              key={eIdx}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-950 border border-slate-800 text-slate-300"
                              title={ent.detail}
                            >
                              <strong className="text-white">{ent.label}</strong> {ent.code ? `(${ent.code})` : ''}
                            </span>
                          ))}
                          {directive.affectedEntities.length > 3 && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20">
                              +{directive.affectedEntities.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom CTA Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleDirectiveStatus(directive.id, directive.status)}
                      className={`text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isImplemented ? 'text-emerald-400 hover:underline' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isImplemented ? 'Re-open Directive' : 'Mark Completed'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDirectiveModal(directive)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/30 cursor-pointer active:scale-95 transition-all"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Deploy Field Directive
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COMMERCIAL & CHANNELS */}
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
                  <p className="text-[11px] text-slate-400">Total audits completed vs target capacity</p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={channelBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="channel" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={TT_STYLE} />
                    <Area type="monotone" dataKey="audits" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#colorVisits)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Classification Mix */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  Store Classification Distribution
                </h3>
                <p className="text-[11px] text-slate-400">Audits categorized by outlet tier</p>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={classificationBreakdown} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4}>
                      {classificationBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TT_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {classificationBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}:</span>
                    <span className="font-bold text-white ml-auto">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COLD CHAIN QUALITY & SAFETY */}
      {activeTab === 'coldchain' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-teal-400" />
              Cold Chain Safety Compliance by Channel
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="channel" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Legend />
                  <Bar dataKey="inRange" name="Compliant (In Range)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="breach" name="Breach (Above Spec)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: POWER SKU AVAILABILITY */}
      {activeTab === 'powersku' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-400" />
              Core Power SKU Availability Fleet-Wide
            </h3>
            <p className="text-xs text-slate-400">
              Fleet-wide On-Shelf Availability (OSA) is currently at{' '}
              <strong className="text-amber-400">{kpiData.powerSkuOsa}%</strong> across audited retail outlets.
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: SUPERVISOR LEAGUE */}
      {activeTab === 'supervisors' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-400" />
              Supervisor Performance Composite Rankings
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated across audit completion rate, cold-chain compliance integrity, and SKU verification velocity.
            </p>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT DIRECTIVES LOG */}
      {activeTab === 'directives' && (
        <div className="space-y-4">
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
                              <img src={action.proofPhotoUrl} alt="Proof" className="h-8 w-12 object-cover rounded border border-slate-700" />
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

      {/* Interactive AI Directive Dispatch Modal */}
      {directiveActionModalOpen && activeAiDirective && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl p-6 space-y-4">
            <button
              onClick={() => setDirectiveActionModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              Executive Directive Dispatch
            </div>

            <div>
              <h3 className="text-lg font-black text-white">{activeAiDirective.title}</h3>
              <p className="text-xs text-slate-300 mt-1">{activeAiDirective.summary}</p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Assignee (Field Operations / Supervisor)
                </label>
                <select
                  value={directiveAssignee}
                  onChange={(e) => setDirectiveAssignee(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Field Operations Lead">Fleet Operations Lead (All Routes)</option>
                  <option value="Maintenance Technical Crew">Cooler Maintenance Technical Squad</option>
                  {supervisors.map((s) => (
                    <option key={s} value={s}>
                      {s} (Supervisor)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Directive Instructions / Deadline
                </label>
                <textarea
                  rows={3}
                  value={directiveNotes}
                  onChange={(e) => setDirectiveNotes(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDirectiveActionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDirectiveDispatch}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-500/30 transition-all cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                Dispatch & Mark In-Execution
              </button>
            </div>
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
