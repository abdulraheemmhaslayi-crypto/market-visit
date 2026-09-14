'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { useTheme } from '@/providers/theme-provider';
import InteractiveChartTableModal from '@/components/dashboard/InteractiveChartTableModal';
import DrilldownReportModal from '@/components/dashboard/DrilldownReportModal';
import { useSession } from 'next-auth/react';
import { isFleetRole, getAllowedReports } from '@/lib/roles';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';

import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { getSizeModelsForCategory, ASSET_CATEGORIES } from '@/utils/asset-config';
import { PhotoGallerySection } from '@/components/dashboard/PhotoGallerySection';

const GCOL: Record<string, string> = {
  A: '#0b7a4c',
  B: '#2b9c62',
  C: '#c8801a',
  D: '#d9663a',
  E: '#c0392b',
};

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const [rows, setRows] = useState<any[]>([]);
  const [reportRows, setReportRows] = useState<any>({ npd: [], psku: [], 'cold-chain': [], classification: [] });
  const [managerSupervisorMap, setManagerSupervisorMap] = useState<Record<string, string[]>>({});
  const [photos, setPhotos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const { theme } = useTheme();

  // Filter States
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fMgr, setFMgr] = useState('');
  const [fSuper, setFSuper] = useState('');
  const [fChannel, setFChannel] = useState('');
  const [fClass, setFClass] = useState('');
  const [fCust, setFCust] = useState('');
  const [fRoute, setFRoute] = useState('');
  const [fSku, setFSku] = useState('');
  const [fVertical, setFVertical] = useState('');
  const [fAssetCategory, setFAssetCategory] = useState('Chillers');
  const [fSizeModels, setFSizeModels] = useState<string[]>([]);
  const [masters, setMasters] = useState<any>(null);

  // Canvas Refs
  const canvasTrendRef = useRef<HTMLCanvasElement>(null);
  const canvasChannelRef = useRef<HTMLCanvasElement>(null);
  const canvasSuperRef = useRef<HTMLCanvasElement>(null);
  const canvasTempRef = useRef<HTMLCanvasElement>(null);
  const canvasNpdRef = useRef<HTMLCanvasElement>(null);
  const canvasPskuRef = useRef<HTMLCanvasElement>(null);
  const canvasClassRef = useRef<HTMLCanvasElement>(null);
  const canvasClassDairyRef = useRef<HTMLCanvasElement>(null);
  const canvasClassIceRef = useRef<HTMLCanvasElement>(null);

  // Chart instances
  const chartsRef = useRef<Record<string, any>>({});

  // Fetch real data on mount & poll every 10 seconds
  useEffect(() => {
    let active = true;
    async function loadData(silent = false) {
      if (!silent) setIsLoading(true);
      else setIsSyncing(true);
      try {
        const params = new URLSearchParams();
        if (userRole) params.set('role', userRole);
        if (fFrom) params.set('startDate', fFrom);
        if (fTo) params.set('endDate', fTo);
        const res = await fetch(`/api/dashboard${params.toString() ? `?${params.toString()}` : ''}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && active) {
          setRows(data.rows || []);
          setReportRows(data.reportRows || { npd: [], psku: [], 'cold-chain': [], classification: [] });
          setManagerSupervisorMap(data.managerSupervisorMap || {});
          setPhotos(data.photos || []);
          setMasters(data.masters || null);
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (active) {
          setIsLoading(false);
          setIsSyncing(false);
        }
      }
    }
    loadData(false);

    const timer = setInterval(() => {
      loadData(true);
    }, 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fFrom, fTo, userRole]);

  const normalizeDate = (value: string) => value ? new Date(`${value}T00:00:00`) : null;

  // Compute dropdown values from unfiltered rows & dynamic DB manager map
  // 1. Manager Options
  // Compute dropdown values strictly from ROUTE_MASTER and CUSTMASTER via masters payload
  // 1. Manager Options
  const mgrOptions = useMemo<string[]>(() => {
    if (!masters) return [];
    return (masters.managers || []) as string[];
  }, [masters]);

  // 2. Supervisor Options: Filtered strictly by Manager if selected, otherwise all supervisors
  const supOptions = useMemo<string[]>(() => {
    if (!masters) return [];
    if (fMgr) {
      const sups = (masters.routes || [])
        .filter((r: any) => r.managerName.toUpperCase() === fMgr.toUpperCase())
        .map((r: any) => r.superName)
        .filter(Boolean);
      return Array.from(new Set(sups)).sort() as string[];
    }
    return (masters.supervisors || []) as string[];
  }, [masters, fMgr]);

  // 3. Channel Options: filtered by Manager and Supervisor
  const channelOptions = useMemo(() => {
    const filteredByMgrSuper = rows.filter(r => {
      const rowDate = new Date(r.createdAt);
      const from = normalizeDate(fFrom);
      const to = normalizeDate(fTo);
      const fromOk = !from || rowDate >= from;
      const toOk = !to || rowDate <= new Date(`${fTo}T23:59:59`);
      return (!fMgr || r.mgr === fMgr) && (!fSuper || r.sup === fSuper) && fromOk && toOk;
    });
    return Array.from(new Set(filteredByMgrSuper.map((r) => r.ch))).sort();
  }, [rows, fMgr, fSuper, fFrom, fTo]);

  // 4. Customer / Outlet Options: Filtered by Route, Supervisor, or Manager if selected
  const custOptions = useMemo<string[]>(() => {
    if (!masters) return [];
    let routes = masters.routes || [];
    if (fSuper) {
      routes = routes.filter((r: any) => r.superName.toUpperCase() === fSuper.toUpperCase());
    } else if (fMgr) {
      routes = routes.filter((r: any) => r.managerName.toUpperCase() === fMgr.toUpperCase());
    }
    const routeCodes = new Set(routes.map((r: any) => r.routeCode));

    let customersList = masters.customers || [];
    if (fRoute) {
      customersList = customersList.filter((c: any) => c.routeCode === fRoute);
    } else if (fSuper || fMgr) {
      customersList = customersList.filter((c: any) => routeCodes.has(c.routeCode));
    }
    return Array.from(new Set(customersList.map((c: any) => c.customerName))).sort() as string[];
  }, [masters, fRoute, fSuper, fMgr]);

  // 5. Classification Options: filtered by Manager, Supervisor, Channel, and Outlet
  const classOptions = useMemo(() => {
    const filteredByAllUpstream = rows.filter(r => {
      const rowDate = new Date(r.createdAt);
      const from = normalizeDate(fFrom);
      const to = normalizeDate(fTo);
      const fromOk = !from || rowDate >= from;
      const toOk = !to || rowDate <= new Date(`${fTo}T23:59:59`);
      return (!fMgr || r.mgr === fMgr) && (!fSuper || r.sup === fSuper) && (!fChannel || r.ch === fChannel) && (!fCust || r.cust === fCust) && fromOk && toOk;
    });
    return Array.from(new Set(filteredByAllUpstream.map((r) => r.gr))).sort();
  }, [rows, fMgr, fSuper, fChannel, fCust, fFrom, fTo]);

  // 6. Route Options: Filtered by Supervisor or Manager if selected
  const routeOptions = useMemo<string[]>(() => {
    if (!masters) return [];
    let routes = masters.routes || [];
    if (fSuper) {
      routes = routes.filter((r: any) => r.superName.toUpperCase() === fSuper.toUpperCase());
    } else if (fMgr) {
      routes = routes.filter((r: any) => r.managerName.toUpperCase() === fMgr.toUpperCase());
    }
    return Array.from(new Set(routes.map((r: any) => r.routeCode))).sort() as string[];
  }, [masters, fSuper, fMgr]);

  // Dynamic Size/Model options based on selected Asset Category
  const availableSizeModels = useMemo(() => {
    return getSizeModelsForCategory(fAssetCategory);
  }, [fAssetCategory]);

  // Reset helper
  const resetFilters = () => {
    setFFrom('');
    setFTo('');
    setFMgr('');
    setFSuper('');
    setFChannel('');
    setFClass('');
    setFCust('');
    setFRoute('');
    setFSku('');
    setFVertical('');
    setFAssetCategory('Chillers');
    setFSizeModels([]);
  };

  // NPD Product report-level filter options (SKU-response granularity, not available on visit-level `rows`)
  const npdRouteOptions = useMemo(
    () => Array.from(new Set((reportRows.npd || []).map((r: any) => r.routeCode).filter((v: any) => !!v))).sort() as string[],
    [reportRows]
  );
  const npdSkuOptions = useMemo(
    () => Array.from(new Set((reportRows.npd || []).map((r: any) => r.skuName).filter((v: any) => !!v))).sort() as string[],
    [reportRows]
  );
  const npdVerticalOptions = useMemo(
    () => Array.from(new Set((reportRows.npd || []).map((r: any) => r.businessVertical).filter((v: any) => !!v))).sort() as string[],
    [reportRows]
  );

  // NPD Product rows matching all active filters (date, manager, supervisor, channel, classification, outlet, route, SKU, business vertical)
  const filteredNpdRows = useMemo(() => {
    return (reportRows.npd || []).filter((r: any) => {
      const rowDate = new Date(r.date);
      const from = normalizeDate(fFrom);
      const to = normalizeDate(fTo);
      const fromOk = !from || rowDate >= from;
      const toOk = !to || rowDate <= new Date(`${fTo}T23:59:59`);
      return fromOk && toOk
        && (!fMgr || r.manager === fMgr)
        && (!fSuper || r.supervisor === fSuper)
        && (!fChannel || r.channel === fChannel)
        && (!fClass || r.classification === fClass)
        && (!fCust || r.outletName === fCust)
        && (!fRoute || r.routeCode === fRoute)
        && (!fSku || r.skuName === fSku)
        && (!fVertical || r.businessVertical === fVertical);
    });
  }, [reportRows, fMgr, fSuper, fChannel, fClass, fCust, fRoute, fSku, fVertical, fFrom, fTo]);

  // Filtered rows matching selection
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const rowDate = new Date(r.createdAt);
      const from = normalizeDate(fFrom);
      const to = normalizeDate(fTo);
      const fromOk = !from || rowDate >= from;
      const toOk = !to || rowDate <= new Date(`${fTo}T23:59:59`);
      const catOk = !fAssetCategory || fAssetCategory === 'All' || (r.atype && r.atype.toLowerCase().includes(fAssetCategory.toLowerCase().replace(/s$/, '')));
      const modelOk = fSizeModels.length === 0 || (r.observation && fSizeModels.some(sm => (r.observation as string).toLowerCase().includes(sm.toLowerCase())));
      return (!fMgr || r.mgr === fMgr) && (!fSuper || r.sup === fSuper) && (!fChannel || r.ch === fChannel) && (!fClass || r.gr === fClass) && (!fCust || r.cust === fCust) && (!fRoute || r.rt === fRoute) && catOk && modelOk && fromOk && toOk;
    });
  }, [rows, fMgr, fSuper, fChannel, fClass, fCust, fRoute, fAssetCategory, fSizeModels, fFrom, fTo]);

  // Visit set for the two per-vertical Classification charts: respects Manager,
  // Supervisor, Channel, and Outlet/Customer, but not the legacy single-value Classification
  // slicer (which no longer has one meaning now that Dairy and Ice Cream grade independently).
  const filteredForClassCharts = useMemo(() => {
    return rows.filter((r) => {
      const rowDate = new Date(r.createdAt);
      const from = normalizeDate(fFrom);
      const to = normalizeDate(fTo);
      const fromOk = !from || rowDate >= from;
      const toOk = !to || rowDate <= new Date(`${fTo}T23:59:59`);
      return (!fMgr || r.mgr === fMgr) && (!fSuper || r.sup === fSuper) && (!fChannel || r.ch === fChannel) && (!fCust || r.cust === fCust) && fromOk && toOk;
    });
  }, [rows, fMgr, fSuper, fChannel, fCust, fFrom, fTo]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<any[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalTitle, setReportModalTitle] = useState('');
  const [reportModalType, setReportModalType] = useState<'npd' | 'psku' | 'cold-chain' | 'classification'>('npd');
  // Tracks which underlying reportRows array backs the open drilldown, since 'classification'
  // now has two sources (Dairy / Ice Cream) that share the same reportModalType/columns.
  const [reportModalSource, setReportModalSource] = useState<'npd' | 'psku' | 'cold-chain' | 'classificationDairy' | 'classificationIceCream'>('npd');
  const allowedReports = useMemo(() => getAllowedReports(userRole), [userRole]);
  const [reportModalRows, setReportModalRows] = useState<any[]>([]);
  const [reportFilterChip, setReportFilterChip] = useState<{ key: string; value: string; label: string } | null>(null);

  const handleChartClick = (chartTitle: string, filterFn: (row: any) => boolean) => {
    const matched = filtered.filter(filterFn);
    setModalTitle(chartTitle);
    setModalData(matched);
    setModalOpen(true);
  };

  const handleDrilldownChartClick = (
    reportType: 'npd' | 'psku' | 'cold-chain',
    chartTitle: string,
    filterFn: (row: any) => boolean,
    chipLabel?: string
  ) => {
    const visitLookup = new Map(filtered.map((row) => [row.visitId, row]));
    if (!allowedReports.includes(reportType)) return;
    const matched = (reportRows[reportType] || []).filter((row: any) => {
      if (reportType === 'cold-chain') {
        return filterFn(row);
      }
      const visit = visitLookup.get(row.visitId);
      return visit ? filterFn(visit) : false;
    });
    setReportModalType(reportType);
    setReportModalSource(reportType);
    setReportModalTitle(chartTitle);
    setReportModalRows(matched);
    setReportFilterChip(chipLabel ? { key: 'segment', value: chipLabel, label: chipLabel } : null);
    setReportModalOpen(true);
  };

  const handleClearReportFilter = () => {
    if (reportModalSource === 'npd') {
      setReportModalRows(filteredNpdRows);
      setReportFilterChip(null);
      return;
    }
    if (reportModalSource === 'classificationDairy' || reportModalSource === 'classificationIceCream') {
      const visitLookup = new Map(filteredForClassCharts.map((row) => [row.visitId, row]));
      const sourceRows = reportModalSource === 'classificationDairy' ? reportRows.classificationDairy : reportRows.classificationIceCream;
      const matched = (sourceRows || []).filter((row: any) => visitLookup.has(row.visitId));
      setReportModalRows(matched);
      setReportFilterChip(null);
      return;
    }
    const visitLookup = new Map(filtered.map((row) => [row.visitId, row]));
    const matched = (reportRows[reportModalSource] || []).filter((row: any) => {
      if (reportModalSource === 'cold-chain') {
        return true;
      }
      const visit = visitLookup.get(row.visitId);
      return visit ? true : false;
    });
    setReportModalRows(matched);
    setReportFilterChip(null);
  };

  // Compute KPI values
  const outletsCount = useMemo(() => new Set(filtered.map((r) => r.cust)).size, [filtered]);
  const breachesCount = useMemo(() => filtered.filter((r) => !r.ok).length, [filtered]);
  const fefoCount = useMemo(() => filtered.filter((r) => r.fefo).length, [filtered]);
  const noVisitCount = useMemo(() => filtered.filter((r) => r.visitType === 'No Visit').length, [filtered]);
  const noVisitRows = useMemo(() => filtered.filter((r: any) => r.visitType === 'No Visit'), [filtered]);
  const breachPct = useMemo(
    () => (filtered.length ? ((breachesCount / filtered.length) * 100).toFixed(1) + '% of assets' : '–'),
    [filtered, breachesCount]
  );
  const fefoPct = useMemo(
    () => (filtered.length ? Math.round((fefoCount / filtered.length) * 100) + '%' : '–'),
    [filtered, fefoCount]
  );

  // Compute Manager scorecard metrics
  const mgrTableData = useMemo(() => {
    const mgrs: Record<string, { v: number; o: Set<string>; b: number; f: number }> = {};
    filtered.forEach((r) => {
      if (!mgrs[r.mgr]) {
        mgrs[r.mgr] = { v: 0, o: new Set(), b: 0, f: 0 };
      }
      const m = mgrs[r.mgr];
      m.v++;
      m.o.add(r.cust);
      if (!r.ok) m.b++;
      if (r.fefo) m.f++;
    });
    return Object.entries(mgrs).sort((a, b) => b[1].v - a[1].v);
  }, [filtered]);

  // Render active note description
  const activeNote = useMemo(() => {
    const parts = [];
    if (fFrom || fTo) parts.push(`Date: <b>${fFrom || 'Start'} → ${fTo || 'Now'}</b>`);
    if (fMgr) parts.push(`Manager: <b>${fMgr}</b>`);
    if (fSuper) parts.push(`Supervisor: <b>${fSuper}</b>`);
    if (fChannel) parts.push(`Channel: <b>${fChannel}</b>`);
    if (fClass) parts.push(`Classification: <b>${fClass}</b>`);
    if (fCust) parts.push(`Outlet: <b>${fCust}</b>`);
    if (fRoute) parts.push(`Route: <b>${fRoute}</b>`);
    if (fSku) parts.push(`SKU: <b>${fSku}</b>`);
    if (fVertical) parts.push(`Business Vertical: <b>${fVertical}</b>`);
    return parts.length ? 'Filtered by ' + parts.join(' · ') : 'Showing all visits';
  }, [fFrom, fTo, fMgr, fSuper, fChannel, fClass, fCust, fRoute, fSku, fVertical]);

  // Excel Export Handlers
  const handleExportAllFilteredVisits = () => {
    exportToExcel({
      filename: `admin_visit_records_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Filtered Visits',
      title: 'Field Visit Master Data Report',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'Visit Date', key: 'createdAt', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Manager', key: 'mgr' },
        { header: 'Supervisor', key: 'sup' },
        { header: 'Channel', key: 'ch' },
        { header: 'Outlet Name', key: 'cust' },
        { header: 'Classification', key: 'gr' },
        { header: 'Asset Type', key: 'atype' },
        { header: 'Asset Temp (°C)', key: 'temp', formatter: (val) => val !== undefined && val !== null ? `${val}°C` : '—' },
        { header: 'Temp Status', key: 'ok', formatter: (val) => val ? 'OK / In Range' : 'Temp Breach' },
        { header: 'FEFO Compliance', key: 'fefo', formatter: (val) => val ? 'Compliant' : 'Non-Compliant' },
        { header: 'Visit Type', key: 'visitType' },
        { header: 'Action Required', key: 'action' },
      ],
      data: filtered,
    });
  };

  const handleExportKpis = () => {
    exportToExcel({
      filename: `dashboard_kpi_summary_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'KPI Summary',
      title: 'Executive KPI Performance Summary',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'KPI Metric', key: 'metric' },
        { header: 'Metric Value', key: 'value' },
        { header: 'Details / Context', key: 'details' },
      ],
      data: [
        { metric: 'Total Visits Logged', value: filtered.length, details: 'Visits logged under current filters' },
        { metric: 'Outlets Covered', value: outletsCount, details: 'Unique retail outlets visited' },
        { metric: 'Skipped Visits (No Visit)', value: noVisitCount, details: 'Visits logged as skipped outlet' },
        { metric: 'Assets Checked', value: filtered.length, details: 'Chiller and freezer units inspected' },
        { metric: 'Temperature Breaches', value: breachesCount, details: `${breachPct} temperature breach rate` },
        { metric: 'FEFO Compliance Rate', value: fefoPct, details: 'Assets following FEFO principles' },
      ],
    });
  };

  const countFreqHelper = (arr: any[], fn: (r: any) => string | number) => {
    const m: Record<string, number> = {};
    arr.forEach((r) => {
      const k = fn(r);
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  };

  const detailedVisitColumns = [
    { header: 'Date', key: 'createdAt', formatter: (val: any) => val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
    { header: 'Visit ID', key: 'visitId' },
    { header: 'Manager', key: 'mgr' },
    { header: 'Supervisor', key: 'sup' },
    { header: 'Outlet Name', key: 'cust' },
    { header: 'Shop Code', key: 'code' },
    { header: 'Route', key: 'rt' },
    { header: 'Channel', key: 'ch' },
    { header: 'Class', key: 'gr' },
    { header: 'Asset', key: 'atype' },
    { header: 'Temp (°C)', key: 'temp', formatter: (val: any) => val !== undefined && val !== null ? `${val}°C` : '—' },
    { header: 'Status', key: 'ok', formatter: (val: any) => val ? 'OK' : 'Breach' },
    { header: 'Action Required', key: 'action', formatter: (val: any) => val || 'None' },
  ];

  const handleExportTrendChart = () => {
    exportToExcel({
      filename: `visits_over_time_detailed_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Visits Over Time',
      title: 'Visits Over Time - Full Visit Drill-Down Records',
      filterSummary: activeNote,
      userRole,
      columns: detailedVisitColumns,
      data: filtered,
    });
  };

  const handleExportChannelChart = () => {
    exportToExcel({
      filename: `visits_by_channel_detailed_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Channel Breakdown',
      title: 'Visits by Channel - Full Visit Drill-Down Records',
      filterSummary: activeNote,
      userRole,
      columns: detailedVisitColumns,
      data: filtered,
    });
  };

  const handleExportSupervisorChart = () => {
    exportToExcel({
      filename: `supervisor_scorecard_detailed_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Supervisor Scorecard',
      title: 'Supervisor Scorecard - Full Visit Drill-Down Records',
      filterSummary: activeNote,
      userRole,
      columns: detailedVisitColumns,
      data: filtered,
    });
  };

  const handleExportColdChainChart = () => {
    const coldChainReportRows = reportRows['cold-chain'] || [];
    const coldChainData = coldChainReportRows.length > 0
      ? coldChainReportRows
      : filtered.map((r) => ({
          date: r.createdAt,
          visitId: r.visitId,
          channel: r.ch,
          manager: r.mgr,
          supervisor: r.sup,
          outletName: r.cust,
          classification: r.gr,
          assetType: r.atype,
          temperature: r.temp,
          tempStatus: r.ok ? 'In Range' : 'Breach',
          actionRemarks: r.action || '—',
        }));

    exportToExcel({
      filename: `cold_chain_readings_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Cold Chain Status',
      title: 'Asset Temperature & Cold Chain Inspection Status',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'Inspection Date', key: 'date', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Manager', key: 'manager' },
        { header: 'Supervisor', key: 'supervisor' },
        { header: 'Channel', key: 'channel' },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Classification', key: 'classification' },
        { header: 'Asset Type', key: 'assetType' },
        {header: 'Asset Temp', key: 'assetTemp', formatter: (val: any, row: any) => val || (row.temperature !== undefined ? `${row.temperature}°C` : '—') },
        { header: 'Temp Status', key: 'tempStatus', formatter: (val: any, row: any) => val || (row.tempInRange ? 'In Range' : 'Breach') },
        { header: 'Action Required / Remarks', key: 'actionRemarks', formatter: (val: any, row: any) => val || row.actionRequired || '—' },
      ],
      data: coldChainData,
    });
  };

  const handleExportNpdChart = () => {
    const dataToExport = filteredNpdRows.length > 0
      ? filteredNpdRows
      : filtered.map((r) => {
          const [cCode, rCode] = (r.cust_rt_id || '').split('|');
          return {
            date: r.createdAt,
            visitId: r.visitId,
            routeCode: r.rt || rCode || '',
            manager: r.mgr,
            supervisor: r.sup,
            channel: r.ch,
            outletCode: r.custCode || cCode || '',
            outletName: r.cust,
            classification: r.gr,
            skuName: 'All NPD SKUs',
            availability: r.npd === 'A' || r.npd === 'YES' ? 'YES' : 'NO',
          };
        });

    exportToExcel({
      filename: `npd_availability_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'NPD Availability',
      title: 'New Product Development (NPD) Availability Report',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'Date', key: 'date', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.route || (row.cust_rt_id ? row.cust_rt_id.split('|')[1] : '—') },
        { header: 'Manager', key: 'manager' },
        { header: 'Supervisor', key: 'supervisor' },
        { header: 'Channel', key: 'channel' },
        { header: 'Outlet Code', key: 'outletCode', formatter: (val: any, row: any) => val || row.custCode || (row.cust_rt_id ? row.cust_rt_id.split('|')[0] : '—') },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Classification', key: 'classification' },
        { header: 'SKU Name', key: 'skuName' },
        { header: 'NPD Availability', key: 'availability', formatter: (val: any, row: any) => val || row.status || '—' },
      ],
      data: dataToExport,
    });
  };

  const handleExportPowerSkuChart = () => {
    const pskuReportRows = reportRows.psku || [];
    const dataToExport = pskuReportRows.length > 0
      ? pskuReportRows
      : filtered.map((r) => {
          const [cCode, rCode] = (r.cust_rt_id || '').split('|');
          return {
            date: r.createdAt,
            visitId: r.visitId,
            routeCode: r.rt || rCode || '',
            manager: r.mgr,
            supervisor: r.sup,
            channel: r.ch,
            outletCode: r.custCode || cCode || '',
            outletName: r.cust,
            classification: r.gr,
            skuName: 'All Power SKUs',
            availability: r.psku === 'A' || r.psku === 'YES' ? 'YES' : 'NO',
          };
        });

    exportToExcel({
      filename: `powersku_availability_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Power SKU Availability',
      title: 'Power SKU Focus Product Presence Report',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'Date', key: 'date', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.route || (row.cust_rt_id ? row.cust_rt_id.split('|')[1] : '—') },
        { header: 'Manager', key: 'manager' },
        { header: 'Supervisor', key: 'supervisor' },
        { header: 'Channel', key: 'channel' },
        { header: 'Outlet Code', key: 'outletCode', formatter: (val: any, row: any) => val || row.custCode || (row.cust_rt_id ? row.cust_rt_id.split('|')[0] : '—') },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Classification', key: 'classification' },
        { header: 'SKU Name', key: 'skuName' },
        { header: 'Power SKU Availability', key: 'availability', formatter: (val: any, row: any) => val || row.status || '—' },
      ],
      data: dataToExport,
    });
  };

  const handleExportClassificationDairyChart = () => {
    const visitLookup = new Map(filteredForClassCharts.map((row) => [row.visitId, row]));
    const dairyRows = (reportRows.classificationDairy || []).filter((r: any) => visitLookup.has(r.visitId));
    const dataToExport = dairyRows.length > 0 ? dairyRows : filtered;

    exportToExcel({
      filename: `classification_dairy_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Dairy Classification',
      title: 'Outlet Classification Distribution - Dairy Vertical',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'Date', key: 'date', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Manager', key: 'manager' },
        { header: 'Supervisor', key: 'supervisor' },
        { header: 'Channel', key: 'channel' },
        { header: 'Outlet Code', key: 'outletCode' },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Classification Grade', key: 'class', formatter: (val: any, row: any) => val || row.gr || 'Not classified' },
      ],
      data: dataToExport,
    });
  };

  const handleExportClassificationIceCreamChart = () => {
    const visitLookup = new Map(filteredForClassCharts.map((row) => [row.visitId, row]));
    const iceRows = (reportRows.classificationIceCream || []).filter((r: any) => visitLookup.has(r.visitId));
    const dataToExport = iceRows.length > 0 ? iceRows : filtered;

    exportToExcel({
      filename: `classification_ice_cream_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Ice Cream Classification',
      title: 'Outlet Classification Distribution - Ice Cream Vertical',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'Date', key: 'date', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Manager', key: 'manager' },
        { header: 'Supervisor', key: 'supervisor' },
        { header: 'Channel', key: 'channel' },
        { header: 'Outlet Code', key: 'outletCode' },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Classification Grade', key: 'class', formatter: (val: any, row: any) => val || row.gr || 'Not classified' },
      ],
      data: dataToExport,
    });
  };

  const handleExportManagerTable = () => {
    const managerData = mgrTableData.map(([m, x]: any) => ({
      manager: m,
      visits: x.v,
      outlets: x.o.size,
      tempBreaches: x.b,
      fefoPct: `${x.v ? Math.round((x.f / x.v) * 100) : 0}%`,
    }));

    exportToExcel({
      filename: `manager_performance_summary_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Manager Summary',
      title: 'Manager Performance Summary Scorecard',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'Manager Name', key: 'manager' },
        { header: 'Total Visits', key: 'visits' },
        { header: 'Unique Outlets Covered', key: 'outlets' },
        { header: 'Temp Breaches', key: 'tempBreaches' },
        { header: 'FEFO Compliance (%)', key: 'fefoPct' },
      ],
      data: managerData,
    });
  };

  const handleExportNoVisits = () => {
    exportToExcel({
      filename: `skipped_no_visits_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'No Visits',
      title: 'Skipped Outlet / No Visit Record Log',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'Visit Date', key: 'createdAt', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Manager', key: 'mgr' },
        { header: 'Supervisor', key: 'sup' },
        { header: 'Channel', key: 'ch' },
        { header: 'Outlet Name', key: 'cust' },
        { header: 'Reason / Remarks', key: 'action' },
      ],
      data: noVisitRows,
    });
  };

  // Chart Rendering Hook
  useEffect(() => {
    if (isLoading || !filtered) return;

    const BLUE = '#4F46E5', BLUE_DEEP = '#4338CA', GREEN = '#0f9d63', AMBER = '#d08a12', RED = '#d63d2e', GREY = '#c3d2de';
    const isDark = theme === 'dark';
    const gridColor = isDark ? '#2A3A55' : '#E4E9F0';
    const textColor = isDark ? '#94A3B8' : '#5A6478';

    const countFreq = (arr: any[], fn: (r: any) => string | number) => {
      const m: Record<string, number> = {};
      arr.forEach((r) => {
        const k = fn(r);
        m[k] = (m[k] || 0) + 1;
      });
      return m;
    };

    const createBarPctLabelPlugin = () => ({
      id: 'barPctLabels',
      afterDatasetsDraw(chart: any) {
        const { ctx } = chart;
        const dataset = chart.data.datasets[0];
        chart.getDatasetMeta(0).data.forEach((bar: any, index: number) => {
          const value = dataset.data[index];
          if (typeof value !== 'number') return;
          const label = `${value}%`;
          ctx.save();
          ctx.font = '700 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = theme === 'dark' ? '#f1f5f9' : '#0f172a';
          ctx.shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)';
          ctx.shadowBlur = 4;
          ctx.fillText(label, bar.x, bar.y - 4);
          ctx.restore();
        });
      },
    });

    const createBarValueLabelPlugin = () => ({
      id: 'barValueLabels',
      afterDatasetsDraw(chart: any) {
        const { ctx } = chart;
        const dataset = chart.data.datasets[0];
        chart.getDatasetMeta(0).data.forEach((bar: any, index: number) => {
          const value = dataset.data[index];
          if (typeof value !== 'number') return;
          const label = `${value}`;
          ctx.save();
          ctx.font = '700 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = theme === 'dark' ? '#f1f5f9' : '#0f172a';
          ctx.shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)';
          ctx.shadowBlur = 4;
          ctx.fillText(label, bar.x, bar.y - 4);
          ctx.restore();
        });
      },
    });

    const createDoughnutPctLabelPlugin = () => ({
      id: 'doughnutPctLabels',
      afterDatasetsDraw(chart: any) {
        const { ctx } = chart;
        const dataset = chart.data.datasets[0];
        if (!dataset || !dataset.data) return;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        meta.data.forEach((arc: any, index: number) => {
          const val = dataset.data[index];
          if (typeof val !== 'number' || val <= 0) return;
          const label = `${val}%`;

          const { startAngle, endAngle, outerRadius, innerRadius, x, y } = arc;
          const angle = startAngle + (endAngle - startAngle) / 2;
          const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
          const labelX = x + Math.cos(angle) * radius;
          const labelY = y + Math.sin(angle) * radius;

          ctx.save();
          ctx.font = '700 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 4;
          ctx.fillText(label, labelX, labelY);
          ctx.restore();
        });
      },
    });

    // 1. Trend Line Chart (percentage-based)
    if (canvasTrendRef.current) {
      if (chartsRef.current.cTrend) chartsRef.current.cTrend.destroy();
      const wk = countFreq(filtered, (r) => r.week);
      const weeks = [1, 2, 3, 4, 5, 6, 7, 8];
      const trendTotal = filtered.length;
      const trendPct = (w: number) => (trendTotal ? Math.round(((wk[w] || 0) / trendTotal) * 100) : 0);
      chartsRef.current.cTrend = new Chart(canvasTrendRef.current, {
        type: 'line',
        data: {
          labels: weeks.map((w) => 'W' + w),
          datasets: [
            {
              label: 'Visits',
              data: weeks.map((w) => trendPct(w)),
              borderColor: BLUE,
              backgroundColor: 'rgba(79,70,229,.12)',
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.raw}% of ${trendTotal} visits` } },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0) {
              const label = (chart.data.labels?.[el[0].index] ?? '') as string;
              const weekNum = parseInt(label.replace('W', ''), 10);
              handleChartClick(`Visits for Week ${weekNum}`, (r) => r.week === weekNum);
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${v}%` } },
          },
        },
      });
    }

    // 2. Channel Doughnut Chart (percentage-based)
    if (canvasChannelRef.current) {
      if (chartsRef.current.cChannel) chartsRef.current.cChannel.destroy();
      const chCounts = countFreq(filtered, (r) => {
        const s = (r.ch || '').toUpperCase().trim();
        if (s.includes('MT') || s.includes('MODERN')) return 'MT';
        if (s.includes('INST') || s.includes('HOTEL') || s.includes('HORECA') || s.includes('CATERING')) return 'INST';
        // if (s.includes('EXP') || s.includes('EXPORT')) return 'EXPORT';
        return 'TT';
      });
      const chL = ['TT', 'MT', 'INST'];
      const chTotal = filtered.length;
      const chPct = (c: string) => (chTotal ? Math.round(((chCounts[c] || 0) / chTotal) * 100) : 0);
      chartsRef.current.cChannel = new Chart(canvasChannelRef.current, {
        type: 'doughnut',
        data: {
          labels: chL,
          datasets: [
            {
              data: chL.map((c) => chPct(c)),
              backgroundColor: [BLUE, GREEN, AMBER],
              borderWidth: 0,
            },
          ],
        },
        plugins: [createDoughnutPctLabelPlugin()],
        options: {
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                generateLabels: (chart: any) => {
                  const data = chart.data;
                  if (!data.labels.length || !data.datasets.length) return [];
                  const dataset = data.datasets[0];
                  const meta = chart.getDatasetMeta(0);
                  return data.labels.map((label: string, i: number) => {
                    const val = dataset.data[i] || 0;
                    const fill = dataset.backgroundColor[i];
                    const style = meta.data[i];
                    return {
                      text: `${label} (${val}%)`,
                      fillStyle: fill,
                      strokeStyle: fill,
                      lineWidth: 0,
                      hidden: isNaN(val) || (style && style.hidden),
                      index: i,
                    };
                  });
                },
              },
            },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}%` } },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0) {
              const label = (chart.data.labels?.[el[0].index] ?? '') as string;
              handleChartClick(`Visits for ${label} Channel`, (r) => {
                const s = (r.ch || '').toUpperCase().trim();
                if (label === 'MT') return s.includes('MT') || s.includes('MODERN');
                if (label === 'INST') return s.includes('INST') || s.includes('HOTEL') || s.includes('HORECA') || s.includes('CATERING');
                if (label === 'EXPORT') return s.includes('EXP') || s.includes('EXPORT');
                return !s.includes('MT') && !s.includes('MODERN') && !s.includes('INST') && !s.includes('HOTEL') && !s.includes('HORECA') && !s.includes('CATERING') && !s.includes('EXP') && !s.includes('EXPORT');
              });
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
        },
      });
    }

    // 3. Supervisor Scorecard Bar Chart (Total Visits count)
    if (canvasSuperRef.current) {
      if (chartsRef.current.cSuper) chartsRef.current.cSuper.destroy();
      const sc = countFreq(filtered, (r) => r.sup);
      const topSup = Object.entries(sc)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      const superTotal = filtered.length;

      chartsRef.current.cSuper = new Chart(canvasSuperRef.current, {
        type: 'bar',
        data: {
          labels: topSup.map((x) => x[0]),
          datasets: [
            {
              label: 'Total Visits',
              data: topSup.map((x) => x[1]),
              backgroundColor: BLUE,
              borderRadius: 6,
            },
          ],
        },
        plugins: [createBarValueLabelPlugin()],
        options: {
          maintainAspectRatio: false,
          layout: {
            padding: { top: 20 },
          },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.raw} visits (${superTotal ? Math.round(((ctx.raw as number) / superTotal) * 100) : 0}% of total)` } },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0) {
              const label = (chart.data.labels?.[el[0].index] ?? '') as string;
              handleChartClick(`Visits for Supervisor ${label}`, (r) => r.sup === label);
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { beginAtZero: true, grace: '15%', grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } },
          },
        },
      });
    }

    // 4. Cold Chain Doughnut Chart (percentage-based)
    if (canvasTempRef.current) {
      if (chartsRef.current.cTemp) chartsRef.current.cTemp.destroy();
      
      let okCount = 0;
      let breachCount = 0;
      let tempTotal = 0;

      const coldChainReportRows = reportRows['cold-chain'] || [];
      if (coldChainReportRows.length > 0) {
        tempTotal = coldChainReportRows.length;
        coldChainReportRows.forEach((r: any) => {
          if (r.tempInRange === true || r.tempInRange === 1) okCount++;
          else breachCount++;
        });
      } else if (filtered && filtered.length > 0) {
        tempTotal = filtered.length;
        filtered.forEach((r: any) => {
          if (r.ok === true || r.ok === 1) okCount++;
          else breachCount++;
        });
      }

      const tempPct = (count: number) => (tempTotal ? Math.round((count / tempTotal) * 100) : 0);

      chartsRef.current.cTemp = new Chart(canvasTempRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Within range', 'Breach'],
          datasets: [
            {
              data: [tempPct(okCount), tempPct(breachCount)],
              backgroundColor: [GREEN, RED],
              borderWidth: 0,
            },
          ],
        },
        plugins: [createDoughnutPctLabelPlugin()],
        options: {
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                generateLabels: (chart: any) => {
                  const data = chart.data;
                  if (!data.labels.length || !data.datasets.length) return [];
                  const dataset = data.datasets[0];
                  const meta = chart.getDatasetMeta(0);
                  return data.labels.map((label: string, i: number) => {
                    const val = dataset.data[i] || 0;
                    const fill = dataset.backgroundColor[i];
                    const style = meta.data[i];
                    return {
                      text: `${label} (${val}%)`,
                      fillStyle: fill,
                      strokeStyle: fill,
                      lineWidth: 0,
                      hidden: isNaN(val) || (style && style.hidden),
                      index: i,
                    };
                  });
                },
              },
            },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}%` } },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0) {
              const label = (chart.data.labels?.[el[0].index] ?? '') as string;
              const isWithinRange = label === 'Within range';
              
              if (coldChainReportRows.length > 0) {
                const matched = coldChainReportRows.filter((r: any) =>
                  isWithinRange ? (r.tempInRange === true || r.tempInRange === 1) : (r.tempInRange === false || r.tempInRange === 0)
                );
                setReportModalType('cold-chain');
                setReportModalSource('cold-chain');
                setReportModalTitle(`Cold Chain Status · ${label}`);
                setReportModalRows(matched);
                setReportFilterChip({ key: 'segment', value: label, label: `Status: ${label}` });
                setReportModalOpen(true);
              } else {
                handleChartClick(`Cold Chain Status · ${label}`, (r) => (isWithinRange ? r.ok === true : r.ok === false));
              }
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
        },
      });
    }

    // 5. NPD Availability Bar Chart (SKU-response & visit-level granularity)
    if (canvasNpdRef.current) {
      if (chartsRef.current.cNpd) chartsRef.current.cNpd.destroy();
      
      let availCount = 0;
      let notAvailCount = 0;
      let notReqCount = 0;
      let npdTotal = 0;

      if (filteredNpdRows && filteredNpdRows.length > 0) {
        npdTotal = filteredNpdRows.length;
        filteredNpdRows.forEach((r: any) => {
          const st = (r.status || r.availability || '').toUpperCase();
          if (st === 'AVAILABLE' || st === 'YES' || st === 'A') availCount++;
          else if (st === 'NOT AVAILABLE' || st === 'NO' || st === 'N') notAvailCount++;
          else notReqCount++;
        });
      } else if (filtered && filtered.length > 0) {
        npdTotal = filtered.length;
        filtered.forEach((r: any) => {
          const st = (r.npd || '').toUpperCase();
          if (st === 'A' || st === 'AVAILABLE' || st === 'YES') availCount++;
          else if (st === 'N' || st === 'NOT AVAILABLE' || st === 'NO') notAvailCount++;
          else notReqCount++;
        });
      }

      const npdPct = (count: number) => (npdTotal ? Math.round((count / npdTotal) * 100) : 0);

      chartsRef.current.cNpd = new Chart(canvasNpdRef.current, {
        type: 'bar',
        data: {
          labels: ['Available', 'Not Available', 'Not Applicable'],
          datasets: [
            {
              data: [npdPct(availCount), npdPct(notAvailCount), npdPct(notReqCount)],
              backgroundColor: [GREEN, RED, GREY],
              borderRadius: 6,
            },
          ],
        },
        plugins: [createBarPctLabelPlugin()],
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw}% of ${npdTotal} ${filteredNpdRows.length > 0 ? 'responses' : 'visits'}`,
              },
            },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0) {
              const label = (chart.data.labels?.[el[0].index] ?? '') as string;
              const targetCode = label === 'Available' ? 'Available' : label === 'Not Available' ? 'Not Available' : 'Not Applicable';
              const matched = filteredNpdRows.length > 0
                ? filteredNpdRows.filter((r: any) => {
                    const st = (r.status || r.availability || '').toUpperCase();
                    if (targetCode === 'Available') return st === 'AVAILABLE' || st === 'YES' || st === 'A';
                    if (targetCode === 'Not Available') return st === 'NOT AVAILABLE' || st === 'NO' || st === 'N';
                    return st !== 'AVAILABLE' && st !== 'YES' && st !== 'A' && st !== 'NOT AVAILABLE' && st !== 'NO' && st !== 'N';
                  })
                : filtered.filter((r: any) => {
                    const st = (r.npd || '').toUpperCase();
                    if (targetCode === 'Available') return st === 'A' || st === 'AVAILABLE' || st === 'YES';
                    if (targetCode === 'Not Available') return st === 'N' || st === 'NOT AVAILABLE' || st === 'NO';
                    return st !== 'A' && st !== 'AVAILABLE' && st !== 'YES' && st !== 'N' && st !== 'NOT AVAILABLE' && st !== 'NO';
                  });

              setReportModalType('npd');
              setReportModalSource('npd');
              setReportModalTitle(`NPD Availability · ${label}`);
              setReportModalRows(matched);
              setReportFilterChip({ key: 'segment', value: label, label: `Status: ${label}` });
              setReportModalOpen(true);
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${v}%` } },
          },
        },
      });
    }

    // 6. Focus SKU Availability Bar Chart (percentage-based)
    if (canvasPskuRef.current) {
      if (chartsRef.current.cPsku) chartsRef.current.cPsku.destroy();
      const psku = countFreq(filtered, (r) => r.psku);
      const pskuTotal = filtered.length;
      const pskuPct = (count: number) => (pskuTotal ? Math.round((count / pskuTotal) * 100) : 0);

      chartsRef.current.cPsku = new Chart(canvasPskuRef.current, {
        type: 'bar',
        data: {
          labels: ['Available', 'Not Available', 'Not Applicable'],
          datasets: [
            {
              data: [pskuPct(psku.A || 0), pskuPct(psku.N || 0), pskuPct(psku.X || 0)],
              backgroundColor: [GREEN, RED, GREY],
              borderRadius: 6,
            },
          ],
        },
        plugins: [createBarPctLabelPlugin()],
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.raw}% of ${pskuTotal} visits` } },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0) {
              const label = (chart.data.labels?.[el[0].index] ?? '') as string;
              const pskuCode = label === 'Available' ? 'A' : label === 'Not Available' ? 'N' : 'X';
              handleDrilldownChartClick('psku', `Power SKU Availability · ${label}`, (r) => r.psku === pskuCode, label ? `Status: ${label}` : undefined);
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${v}%` } },
          },
        },
      });
    }

    // 7. Classification Bar Charts (Dairy & Ice Cream)
    if (canvasClassDairyRef.current) {
      if (chartsRef.current.cClassDairy) chartsRef.current.cClassDairy.destroy();
      const visitLookup = new Map(filteredForClassCharts.map((row) => [row.visitId, row]));
      const dairyRows = (reportRows.classificationDairy || []).filter((r: any) => visitLookup.has(r.visitId));
      const cld = countFreq(dairyRows, (r) => r.class);
      const allGrades = ['A', 'B', 'C', 'D', 'E', '-'];
      const gradeLabels = ['A', 'B', 'C', 'D', 'E', 'Not Classified'];
      const classTotalDairy = dairyRows.length;
      const classPctDairy = (count: number) => (classTotalDairy ? Math.round((count / classTotalDairy) * 100) : 0);

      chartsRef.current.cClassDairy = new Chart(canvasClassDairyRef.current, {
        type: 'bar',
        data: {
          labels: gradeLabels,
          datasets: [
            {
              label: 'Visits',
              data: allGrades.map((g) => classPctDairy(cld[g] || 0)),
              backgroundColor: allGrades.map((g) => g === '-' ? '#9aa9b4' : GCOL[g]),
              borderRadius: 6,
            },
          ],
        },
        plugins: [createBarPctLabelPlugin()],
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.raw}% of ${classTotalDairy} visits` } },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0 && allowedReports.includes('classification')) {
              const label = (chart.data.labels?.[el[0].index] ?? '') as string;
              const classValue = label === 'Not Classified' ? '-' : label;
              const matched = (reportRows.classificationDairy || []).filter((row: any) => row.class === classValue && visitLookup.has(row.visitId));
              setReportModalType('classification');
              setReportModalSource('classificationDairy');
              setReportModalTitle(`Outlets by Classification · Dairy · ${label}`);
              setReportModalRows(matched);
              setReportFilterChip({ key: 'segment', value: `Class: ${label}`, label: `Class: ${label}` });
              setReportModalOpen(true);
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${v}%` } },
          },
        },
      });
    }

    if (canvasClassIceRef.current) {
      if (chartsRef.current.cClassIce) chartsRef.current.cClassIce.destroy();
      const visitLookup = new Map(filteredForClassCharts.map((row) => [row.visitId, row]));
      const iceRows = (reportRows.classificationIceCream || []).filter((r: any) => visitLookup.has(r.visitId));
      const cli = countFreq(iceRows, (r) => r.class);
      const allGrades = ['A', 'B', 'C', 'D', 'E', '-'];
      const gradeLabels = ['A', 'B', 'C', 'D', 'E', 'Not Classified'];
      const classTotalIce = iceRows.length;
      const classPctIce = (count: number) => (classTotalIce ? Math.round((count / classTotalIce) * 100) : 0);

      chartsRef.current.cClassIce = new Chart(canvasClassIceRef.current, {
        type: 'bar',
        data: {
          labels: gradeLabels,
          datasets: [
            {
              label: 'Visits',
              data: allGrades.map((g) => classPctIce(cli[g] || 0)),
              backgroundColor: allGrades.map((g) => g === '-' ? '#9aa9b4' : GCOL[g]),
              borderRadius: 6,
            },
          ],
        },
        plugins: [createBarPctLabelPlugin()],
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.raw}% of ${classTotalIce} visits` } },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0 && allowedReports.includes('classification')) {
              const label = (chart.data.labels?.[el[0].index] ?? '') as string;
              const classValue = label === 'Not Classified' ? '-' : label;
              const matched = (reportRows.classificationIceCream || []).filter((row: any) => row.class === classValue && visitLookup.has(row.visitId));
              setReportModalType('classification');
              setReportModalSource('classificationIceCream');
              setReportModalTitle(`Outlets by Classification · Ice Cream · ${label}`);
              setReportModalRows(matched);
              setReportFilterChip({ key: 'segment', value: `Class: ${label}`, label: `Class: ${label}` });
              setReportModalOpen(true);
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${v}%` } },
          },
        },
      });
    }
  }, [filtered, filteredForClassCharts, filteredNpdRows, isLoading, theme]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg)]">
        <p className="text-sm font-bold text-[var(--text-secondary)]">Loading Executive Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dandy-dashboard-body">
      {isFleetRole(userRole) && (
        <div className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-700">
          Fleet / Maintenance view: only the Cold Chain report is available.
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .dandy-dashboard-body {
          --ink: var(--text-primary);
          --soft: var(--text-secondary);
          --line: var(--border);
          --card: var(--surface);
          --bg: var(--bg);
          --blue:#4F46E5; --blue-deep:#4338CA; --green:#0f9d63; --amber:#d08a12; --red:#d63d2e;
          --shadow:0 2px 8px rgba(13,33,54,.06),0 8px 24px rgba(13,33,54,.05);
          font-family: var(--font-sans), 'Inter', system-ui, sans-serif;
          background:var(--bg);
          color:var(--ink);
          -webkit-font-smoothing:antialiased;
          padding-bottom:20px;
          margin:-20px; /* offset standard padding */
        }
        .top {
          background:linear-gradient(135deg,#6366F1,#4F46E5);
          color:#fff;
          padding:12px 18px;
          display:flex;
          align-items:center;
          gap:12px;
          box-shadow:var(--shadow);
        }
        .top .logo {
          width:36px;
          height:36px;
          border-radius:9px;
          background:#fff;
          display:grid;
          place-items:center;
          font-weight:800;
          color:#4F46E5;
          font-size:16px;
        }
        .top h1 {
          font-size:17px;
          font-weight:800;
          letter-spacing:-.3px;
        }
        .top .sub {
          font-size:11px;
          opacity:.85;
          font-weight:500;
          margin-top:2px;
        }
        .demo-tag {
          margin-left:auto;
          background:rgba(255,255,255,.18);
          padding:4px 10px;
          border-radius:99px;
          font-size:10px;
          font-weight:700;
          letter-spacing:.03em;
        }
        .wrap {
          max-width:100%;
          padding:14px 14px;
        }
        .filters {
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-bottom:8px;
          align-items:flex-end;
        }
        .fld {
          display:flex;
          flex-direction:column;
          gap:4px;
          position:relative;
        }
        .fld label {
          font-size:10.5px;
          font-weight:800;
          text-transform:uppercase;
          letter-spacing:.05em;
          color:var(--soft);
          padding-left:4px;
        }
        .filters select,
        .filters input {
          padding:8px 11px;
          border:1.5px solid var(--line);
          border-radius:11px;
          background:var(--card);
          font-family:inherit;
          font-size:12px;
          font-weight:600;
          color:var(--ink);
          cursor:pointer;
          min-width:120px;
        }
        .filters input {
          cursor:text;
        }
        .filters select:focus,
        .filters input:focus {
          outline:none;
          border-color:var(--blue);
        }
        .reset {
          padding:8px 12px;
          border:1.5px solid var(--line);
          border-radius:11px;
          background:var(--card);
          font-family:inherit;
          font-size:12px;
          font-weight:700;
          color:var(--blue-deep);
          cursor:pointer;
        }
        .live-badge {
          display:flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          border:1.5px solid var(--line);
          border-radius:11px;
          background:var(--card);
          font-family:monospace;
          font-size:10.5px;
          font-weight:700;
          color:var(--soft);
          user-select:none;
        }
        .live-dot {
          height:8px;
          width:8px;
          border-radius:50%;
          display:inline-block;
        }
        .live-dot.active {
          background:var(--green);
          box-shadow: 0 0 8px var(--green);
          animation: pulse-dot 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .live-dot.syncing {
          background:var(--blue);
          box-shadow: 0 0 8px var(--blue);
          animation: pulse-dot 0.6s ease-in-out infinite alternate;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        .active-note {
          font-size:11px;
          color:var(--soft);
          font-weight:600;
          margin-bottom:12px;
          padding-left:2px;
          min-height:16px;
        }
        .active-note b {
          color:var(--blue-deep);
        }
        .kpis {
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
          gap:10px;
          margin-bottom:14px;
        }
        .kpi {
          background:var(--card);
          border-radius:12px;
          padding:12px 14px;
          box-shadow:var(--shadow);
          border:1px solid var(--line);
        }
        .kpi .lbl {
          font-size:10px;
          color:var(--soft);
          font-weight:700;
          text-transform:uppercase;
          letter-spacing:.04em;
        }
        .kpi .val {
          font-size:24px;
          font-weight:800;
          letter-spacing:-1px;
          margin-top:4px;
        }
        .kpi .delta {
          font-size:11px;
          font-weight:700;
          margin-top:2px;
          color:var(--soft);
        }
        .kpi.b .val { color:var(--blue-deep); }
        .kpi.g .val { color:var(--green); }
        .kpi.a .val { color:var(--amber); }
        .kpi.r .val { color:var(--red); }
        .grid {
          display:grid;
          grid-template-columns:2fr 1fr;
          gap:12px;
          margin-bottom:12px;
        }
        .grid3 {
          display:grid;
          grid-template-columns:1fr 1fr 1fr;
          gap:12px;
          margin-bottom:12px;
        }
        @media(max-width:820px){
          .grid, .grid3 { grid-template-columns:1fr; }
        }
        .panel {
          background:var(--card);
          border-radius:12px;
          padding:12px 14px 6px;
          box-shadow:var(--shadow);
          border:1px solid var(--line);
        }
        .panel.tbl { padding-bottom:12px; }
        .panel h3 {
          font-size:13px;
          font-weight:800;
          margin-bottom:3px;
        }
        .panel .psub {
          font-size:10px;
          color:var(--soft);
          font-weight:600;
          margin-bottom:8px;
        }
        .chart-box { position:relative; height:180px; }
        .chart-sm { position:relative; height:150px; }
        table {
          width:100%;
          border-collapse:collapse;
          font-size:11.5px;
        }
        th {
          text-align:left;
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.03em;
          color:var(--soft);
          padding:6px 8px;
          border-bottom:2px solid var(--line);
          font-weight:800;
          position:sticky;
          top:0;
          background:var(--card);
        }
        td {
          padding:6px 8px;
          border-bottom:1px solid var(--line);
        }
        tr:hover td { background:var(--surface-2); }
        .tbl-wrap {
          max-height:240px;
          overflow-y:auto;
          overflow-x:auto;
          border-radius:12px;
          border:1px solid var(--line);
          -webkit-overflow-scrolling:touch;
        }
        .pill {
          display:inline-block;
          padding:2px 9px;
          border-radius:99px;
          font-size:11px;
          font-weight:800;
        }
        .pill.g { background:#e3f6ec; color:#0b7a4c; }
        .pill.r { background:#fdebe9; color:var(--red); }
        .grade {
          width:24px;
          height:24px;
          border-radius:6px;
          display:inline-grid;
          place-items:center;
          color:#fff;
          font-weight:800;
          font-size:11px;
        }
        .foot {
          text-align:center;
          color:var(--soft);
          font-size:11px;
          margin-top:14px;
          line-height:1.6;
        }
        @media(max-width: 640px) {
          .top {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            padding: 12px;
          }
          .top .demo-tag {
            margin-left: 0;
            margin-top: 4px;
          }
        }
        @media(max-width: 480px) {
          .filters {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }
          .fld {
            width: 100%;
          }
          .filters select,
          .filters input {
            width: 100%;
            min-height: 40px;
          }
          .reset {
            width: 100%;
            min-height: 40px;
            text-align: center;
          }
        }
      ` }} />

      {/* Header Banner */}
      <div className="top">
        <div className="logo">D</div>
        <div>
          <h1>Dandy Market Visit — Management Dashboard</h1>
          <div className="sub">Field-force visit compliance & execution · Dandy Company Ltd</div>
        </div>
        <div className="demo-tag">LIVE DATABASE DATA</div>
      </div>

      <div className="wrap">
        {/* Filters Panel */}
        <div className="filters">
          <div className="fld">
            <label>From</label>
            <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>

          <div className="fld">
            <label>To</label>
            <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>



          <div className="fld">
            <label>Manager</label>
            <select value={fMgr} onChange={(e) => {
              setFMgr(e.target.value);
              setFSuper('');
              setFChannel('');
              setFClass('');
              setFCust('');
            }}>
              <option value="">All Managers</option>
              {mgrOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Supervisor</label>
            <select value={fSuper} onChange={(e) => {
              setFSuper(e.target.value);
              setFChannel('');
              setFClass('');
              setFCust('');
            }}>
              <option value="">All Supervisors</option>
              {supOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Channel</label>
            <select value={fChannel} onChange={(e) => {
              setFChannel(e.target.value);
              setFClass('');
              setFCust('');
            }}>
              <option value="">All Channels</option>
              {channelOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Classification</label>
            <select value={fClass} onChange={(e) => {
              setFClass(e.target.value);
              setFCust('');
            }}>
              <option value="">All Classifications</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Outlet / Customer</label>
            <select value={fCust} onChange={(e) => setFCust(e.target.value)}>
              <option value="">All Outlets</option>
              {custOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Route Code</label>
            <select value={fRoute} onChange={(e) => {
              setFRoute(e.target.value);
              setFCust('');
            }}>
              <option value="">All Route Codes</option>
              {routeOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label>Asset Category</label>
            <select
              value={fAssetCategory}
              onChange={(e) => {
                setFAssetCategory(e.target.value);
                setFSizeModels([]);
              }}
            >
              <option value="All">All Categories</option>
              {ASSET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="fld min-w-[190px]">
            <label>Size / Model</label>
            <MultiSelectDropdown
              placeholder="Select Size/Model"
              options={availableSizeModels}
              selectedValues={fSizeModels}
              onChange={setFSizeModels}
            />
          </div>

          <button className="reset" onClick={resetFilters}>Reset</button>

          <ExportButton onClick={handleExportAllFilteredVisits} label="Export Filtered Data" variant="default" />

          <div className="live-badge">
            <span className={`live-dot ${isSyncing ? 'syncing' : 'active'}`} />
            <span>{isSyncing ? 'SYNCING...' : 'LIVE SYNC ACTIVE'}</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>UPDATED {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Active Filter description */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="active-note flex-grow" dangerouslySetInnerHTML={{ __html: activeNote }} />
          <ExportButton onClick={handleExportKpis} label="Export KPI Summary" variant="compact" />
        </div>

        {/* KPI Row */}
        <div className="kpis">
          <div className="kpi b">
            <div className="lbl">Total Visits</div>
            <div className="val">{filtered.length}</div>
            <div className="delta">visits logged</div>
          </div>
          <div className="kpi g">
            <div className="lbl">Outlets Covered</div>
            <div className="val">{outletsCount}</div>
            <div className="delta">unique outlets</div>
          </div>
          <div className="kpi a">
            <div className="lbl">No Visits</div>
            <div className="val">{noVisitCount}</div>
            <div className="delta">skipped outlet visits</div>
          </div>
          <div className="kpi a">
            <div className="lbl">Assets Checked</div>
            <div className="val">{filtered.length}</div>
            <div className="delta">chillers/freezers</div>
          </div>
          <div className="kpi r">
            <div className="lbl">Temp Breaches</div>
            <div className="val">{breachesCount}</div>
            <div className="delta">{breachPct}</div>
          </div>
          <div className="kpi g">
            <div className="lbl">FEFO Compliance</div>
            <div className="val">{fefoPct}</div>
            <div className="delta">assets following FEFO</div>
          </div>
        </div>

        {/* No Visit Details */}
        {noVisitRows.length > 0 && (
          <div className="panel" style={{ marginBottom: '12px' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>No Visit Details</h3>
                <div className="psub">Skipped outlet visits with recorded reasons</div>
              </div>
              <ExportButton onClick={handleExportNoVisits} label="Export Excel" variant="compact" />
            </div>
            <div className="overflow-x-auto" style={{ marginTop: '10px' }}>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Date</th>
                    <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Supervisor</th>
                    <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Route</th>
                    <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Outlet</th>
                    <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {noVisitRows.map((row: any) => (
                    <tr key={row.visitId} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.sup}</td>
                      <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{row.rt || '—'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.cust || '—'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{row.reasonCategory || row.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Chart Row 1 */}
        <div className="grid">
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Visits Over Time</h3>
                <div className="psub">Weekly visits (filtered)</div>
              </div>
              <ExportButton onClick={handleExportTrendChart} label="Export" variant="compact" />
            </div>
            <div className="chart-box">
              <canvas ref={canvasTrendRef}></canvas>
            </div>
          </div>
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Visits by Channel</h3>
                <div className="psub">Share across MT / TT / INST</div>
              </div>
              <ExportButton onClick={handleExportChannelChart} label="Export" variant="compact" />
            </div>
            <div className="chart-sm">
              <canvas ref={canvasChannelRef}></canvas>
            </div>
          </div>
        </div>

        {/* Chart Row 2 */}
        <div className="grid">
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Supervisor Scorecard</h3>
                <div className="psub">Visits per supervisor (filtered)</div>
              </div>
              <ExportButton onClick={handleExportSupervisorChart} label="Export" variant="compact" />
            </div>
            <div className="chart-box">
              <canvas ref={canvasSuperRef}></canvas>
            </div>
          </div>
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Cold Chain Status</h3>
                <div className="psub">Asset temperature readings</div>
              </div>
              <ExportButton onClick={handleExportColdChainChart} label="Export" variant="compact" />
            </div>
            <div className="chart-sm">
              <canvas ref={canvasTempRef}></canvas>
            </div>
          </div>
        </div>
 
        {/* Chart Row 3 */}
        <div className="grid3">
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>NPD Availability</h3>
                <div className="psub">New-product presence</div>
              </div>
              <ExportButton onClick={handleExportNpdChart} label="Export" variant="compact" />
            </div>
            <div className="chart-sm">
              <canvas ref={canvasNpdRef}></canvas>
            </div>
          </div>
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Power SKU Availability</h3>
                <div className="psub">Focus SKU presence</div>
              </div>
              <ExportButton onClick={handleExportPowerSkuChart} label="Export" variant="compact" />
            </div>
            <div className="chart-sm">
              <canvas ref={canvasPskuRef}></canvas>
            </div>
          </div>
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Outlets by Classification · Dairy</h3>
                <div className="psub">Visit distribution A–E (Dairy)</div>
              </div>
              <ExportButton onClick={handleExportClassificationDairyChart} label="Export" variant="compact" />
            </div>
            <div className="chart-sm">
              <canvas ref={canvasClassDairyRef}></canvas>
            </div>
          </div>
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Outlets by Classification · Ice Cream</h3>
                <div className="psub">Visit distribution A–E (Ice Cream)</div>
              </div>
              <ExportButton onClick={handleExportClassificationIceCreamChart} label="Export" variant="compact" />
            </div>
            <div className="chart-sm">
              <canvas ref={canvasClassIceRef}></canvas>
            </div>
          </div>
        </div>

        {/* Manager Table */}
        <div className="panel tbl" style={{ marginBottom: '16px' }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3>Manager Performance Summary</h3>
              <div className="psub">Visits, coverage & compliance per manager (filtered)</div>
            </div>
            <ExportButton onClick={handleExportManagerTable} label="Export Table" variant="compact" />
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Visits</th>
                  <th>Outlets</th>
                  <th>Temp Breach</th>
                  <th>FEFO %</th>
                </tr>
              </thead>
              <tbody>
                {mgrTableData.length > 0 ? (
                  mgrTableData.map(([m, x]: any) => (
                    <tr key={m}>
                      <td style={{ fontWeight: 700 }}>{m}</td>
                      <td>{x.v}</td>
                      <td>{x.o.size}</td>
                      <td>
                        {x.b ? (
                          <span className="pill r">{x.b}</span>
                        ) : (
                          <span className="pill g">0</span>
                        )}
                      </td>
                      <td>{x.v ? Math.round((x.f / x.v) * 100) : 0}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#5a7085', padding: '20px' }}>
                      No data for this filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>



        {/* Visit Details Table */}
        <div className="panel tbl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3>Visit Details</h3>
              <div className="psub">Outlet-level records (filtered) — GM drill-down view</div>
            </div>
            <ExportButton onClick={handleExportAllFilteredVisits} label="Export All Visits" variant="compact" />
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Supervisor</th>
                  <th>Outlet</th>
                  <th>Ch</th>
                  <th>Class</th>
                  <th>Asset</th>
                  <th>Temp</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.slice(0, 40).map((r, idx) => (
                    <tr key={idx}>
                      <td>{r.mgr}</td>
                      <td>{r.sup}</td>
                      <td>{r.cust}</td>
                      <td>{r.ch}</td>
                      <td>
                        <span
                          className="grade"
                          style={{ background: GCOL[r.gr] || '#9aa9b4' }}
                        >
                          {r.gr}
                        </span>
                      </td>
                      <td>{r.atype}</td>
                      <td>{r.temp}°C</td>
                      <td>
                        {r.ok ? (
                          <span className="pill g">OK</span>
                        ) : (
                          <span className="pill r">Breach</span>
                        )}
                      </td>
                      <td>{r.action || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: '#5a7085', padding: '20px' }}>
                      No data for this filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Photo Gallery Section with Pagination */}
        <PhotoGallerySection
          photos={photos}
          fFrom={fFrom}
          fTo={fTo}
          fMgr={fMgr}
          fSuper={fSuper}
          fChannel={fChannel}
          fCust={fCust}
          fRoute={fRoute}
        />

        {/* Footer */}
        <div className="foot">
          <b>Real database visits live sync.</b> All five filters above are active — selections recalculate compliance & scorecard data dynamically.
        </div>
      </div>
      <InteractiveChartTableModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        data={modalData}
      />
      <DrilldownReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title={reportModalTitle}
        rows={reportModalRows}
        reportType={reportModalType}
        filterChip={reportFilterChip}
        onClearFilter={handleClearReportFilter}
      />
    </div>
  );
}
