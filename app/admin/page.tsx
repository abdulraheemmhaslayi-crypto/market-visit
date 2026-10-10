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
import VisitSummaryTable from '@/components/dashboard/VisitSummaryTable';
import { RefreshCw } from 'lucide-react';

const GCOL: Record<string, string> = {
  A: '#0b7a4c',
  B: '#2b9c62',
  C: '#c8801a',
  D: '#d9663a',
  E: '#c0392b',
};

function isManagerMatch(
  rowManager: string | undefined | null,
  selectedManagers: string[] | string,
  rowSupervisor?: string | undefined | null,
  managerSupervisorMap?: Record<string, string[]>
): boolean {
  const mgrs = Array.isArray(selectedManagers)
    ? selectedManagers.filter(Boolean)
    : (selectedManagers ? [selectedManagers] : []);
  if (mgrs.length === 0) return true;
  const rowMgr = (rowManager || '').toString().trim().toUpperCase();
  if (mgrs.some((m) => m.trim().toUpperCase() === rowMgr)) return true;

  // Fallback: check if row supervisor belongs to one of the selected managers
  if (rowSupervisor && managerSupervisorMap) {
    const rowSup = (rowSupervisor || '').toString().trim().toUpperCase();
    for (const m of mgrs) {
      const supsForMgr = managerSupervisorMap[m.trim().toUpperCase()] || [];
      if (supsForMgr.some((s) => s.trim().toUpperCase() === rowSup)) {
        return true;
      }
    }
  }

  return false;
}

function matchSingleSupervisor(rowSupervisor: string, selSup: string): boolean {
  const rowSup = (rowSupervisor || '').trim().toUpperCase();
  const targetSup = selSup.trim().toUpperCase();
  return rowSup === targetSup;
}

function isSupervisorMatch(
  rowSupervisor: string | undefined | null,
  selectedSupervisors: string[] | string,
  selectedManagers?: string[] | string
): boolean {
  const sups = Array.isArray(selectedSupervisors)
    ? selectedSupervisors.filter(Boolean)
    : (selectedSupervisors ? [selectedSupervisors] : []);
  if (sups.length === 0) return true;

  const mgrs = Array.isArray(selectedManagers)
    ? selectedManagers.filter(Boolean)
    : (selectedManagers ? [selectedManagers] : []);

  return sups.some((s) => matchSingleSupervisor(rowSupervisor || '', s));
}

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
  const [fMgr, setFMgr] = useState<string[]>([]);
  const [fSuper, setFSuper] = useState<string[]>([]);
  const [fChannel, setFChannel] = useState('');
  const [fClass, setFClass] = useState('');
  const [fCust, setFCust] = useState('');
  const [fRoute, setFRoute] = useState('');
  const [fSku, setFSku] = useState('');
  const [fVertical, setFVertical] = useState('');
  const [fAssetCategory, setFAssetCategory] = useState('All');
  const [fSizeModels, setFSizeModels] = useState<string[]>([]);
  const [masters, setMasters] = useState<any>(null);

  const latestDateRef = useRef<string>('');
  const initialDateApplied = useRef<boolean>(false);

  // Helper to extract YYYY-MM-DD from row date
  const getRowDateStr = (r: any): string => {
    const raw = r.createdAt || r.date;
    if (!raw) return '';
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      return raw.trim();
    }
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).split('T')[0];
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getLatestDateFromRows = (rowList: any[]): string => {
    let latest = '';
    for (const r of rowList) {
      const dStr = getRowDateStr(r);
      if (dStr && (!latest || dStr > latest)) {
        latest = dStr;
      }
    }
    return latest;
  };

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

  // Initialize cached data immediately from sessionStorage to eliminate skeleton hangs & 0-data flash
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('admin_dashboard_cache_v5');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
          setRows(parsed.rows);
          if (parsed.reportRows) setReportRows(parsed.reportRows);
          if (parsed.managerSupervisorMap) setManagerSupervisorMap(parsed.managerSupervisorMap);
          if (parsed.photos) setPhotos(parsed.photos);
          if (parsed.masters) setMasters(parsed.masters);
          const cLatest = parsed.latestDate || getLatestDateFromRows(parsed.rows);
          if (cLatest) {
            latestDateRef.current = cLatest;
            if (!initialDateApplied.current) {
              setFFrom(cLatest);
              setFTo(cLatest);
              initialDateApplied.current = true;
            }
          }
          setIsLoading(false);
        }
      }
    } catch (e) {
      // Ignore cache parse errors
    }
  }, []);

  // Fetch real data on mount & smooth non-blocking update on date filter changes
  useEffect(() => {
    let active = true;
    async function loadData(silent = false) {
      if (!silent && rows.length === 0) setIsLoading(true);
      else setIsSyncing(true);
      try {
        const params = new URLSearchParams();
        if (userRole) params.set('role', userRole);
        if (fFrom) params.set('startDate', fFrom);
        if (fTo) params.set('endDate', fTo);
        const res = await fetch(`/api/dashboard${params.toString() ? `?${params.toString()}` : ''}`);
        if (!res.ok) {
          console.warn('Dashboard fetch failed with status:', res.status);
          return;
        }
        const data = await res.json();
        if (data.success && active) {
          const newRows = data.rows || [];
          const newReportRows = data.reportRows || { npd: [], psku: [], 'cold-chain': [], classification: [] };
          const newMgrSupMap = data.managerSupervisorMap || {};
          const newPhotos = data.photos || [];
          const newMasters = data.masters || null;
          const foundLatestDate = data.latestDate || getLatestDateFromRows(newRows);

          if (foundLatestDate) {
            latestDateRef.current = foundLatestDate;
            if (!initialDateApplied.current) {
              setFFrom(foundLatestDate);
              setFTo(foundLatestDate);
              initialDateApplied.current = true;
            }
          }

          setRows(newRows);
          setReportRows(newReportRows);
          setManagerSupervisorMap(newMgrSupMap);
          setPhotos(newPhotos);
          setMasters(newMasters);
          setLastUpdated(new Date());

          try {
            sessionStorage.setItem('admin_dashboard_cache_v5', JSON.stringify({
              rows: newRows,
              reportRows: newReportRows,
              managerSupervisorMap: newMgrSupMap,
              photos: newPhotos,
              masters: newMasters,
              latestDate: foundLatestDate || latestDateRef.current,
            }));
          } catch (e) {
            // Ignore quota errors
          }
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

    const debounceTimer = setTimeout(() => {
      loadData(rows.length > 0);
    }, rows.length > 0 ? 300 : 0);

    // Refresh gently every 3 minutes only if tab is visible, and on window focus
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadData(true);
      }
    }, 180000);

    const handleFocus = () => {
      if (active) loadData(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fFrom, fTo, userRole]);

  const normalizeDate = (value: string) => value ? new Date(`${value}T00:00:00`) : null;

  // Compute dropdown values from unfiltered rows & dynamic DB manager map
  // 1. Manager Options: Strictly from CUSTMASTER
  const mgrOptions = useMemo<string[]>(() => {
    if (!masters) return [];
    return ((masters.managers || []) as string[]).filter(
      (m) => m !== 'EXP MANAGER' && m !== 'INST MANAGER' && m !== 'INTERNAL'
    );
  }, [masters]);

  // 2. Supervisor Options: Filtered strictly by Manager if selected, otherwise all supervisors from CUSTMASTER
  const supOptions = useMemo<string[]>(() => {
    if (!masters) return [];
    if (fMgr.length > 0) {
      const mgrUppers = fMgr.map((m) => m.toUpperCase());
      const supsSet = new Set<string>();

      mgrUppers.forEach((mgrUpper) => {
        if (masters.managerSupervisorMap && masters.managerSupervisorMap[mgrUpper]) {
          (masters.managerSupervisorMap[mgrUpper] as string[]).forEach((s) => {
            if (s && s !== 'INTERNAL') supsSet.add(s);
          });
        } else {
          (masters.routes || [])
            .filter((r: any) => (r.managerName || '').toUpperCase() === mgrUpper)
            .map((r: any) => r.superName)
            .forEach((s: string) => {
              if (s && s !== 'INTERNAL') supsSet.add(s);
            });
        }
      });
      return Array.from(supsSet).sort();
    }
    return ((masters.supervisors || []) as string[]).filter((s) => s !== 'INTERNAL');
  }, [masters, fMgr]);

  // 3. RTM Options: Strictly from CUSTMASTER Segment_Fin(120MT), filtered by selected Manager/Supervisor if applicable
  const rtmOptions = useMemo<string[]>(() => {
    if (!masters) return ['INST', 'MT', 'TT'];
    let custs = masters.customers || [];
    if (fSuper.length > 0) {
      custs = custs.filter((c: any) => isSupervisorMatch(c.superName, fSuper, fMgr));
    } else if (fMgr.length > 0) {
      custs = custs.filter((c: any) => isManagerMatch(c.managerName, fMgr));
    }
    const rtmList = Array.from(new Set(custs.map((c: any) => c.rtm || c.channel).filter(Boolean))).sort() as string[];
    if (rtmList.length > 0) return rtmList;
    return ((masters.rtms || masters.channels || ['INST', 'MT', 'TT']) as string[]);
  }, [masters, fSuper, fMgr]);

  // 4. Customer / Outlet Options: From CUSTMASTER, cascaded by Route, Supervisor, Manager, RTM, and Classification
  const custOptions = useMemo<string[]>(() => {
    if (!masters) return [];
    let routes = masters.routes || [];
    if (fSuper.length > 0) {
      routes = routes.filter((r: any) => isSupervisorMatch(r.superName, fSuper, fMgr));
    } else if (fMgr.length > 0) {
      routes = routes.filter((r: any) => isManagerMatch(r.managerName, fMgr));
    }
    const routeCodes = new Set(routes.map((r: any) => r.routeCode));

    let customersList = masters.customers || [];
    if (fRoute) {
      customersList = customersList.filter((c: any) => c.routeCode === fRoute);
    } else if (fSuper.length > 0 || fMgr.length > 0) {
      customersList = customersList.filter((c: any) => routeCodes.has(c.routeCode));
    }
    if (fChannel) {
      customersList = customersList.filter((c: any) => (c.rtm || c.channel) === fChannel);
    }
    if (fClass) {
      customersList = customersList.filter((c: any) => c.classification === fClass);
    }
    return Array.from(new Set(customersList.map((c: any) => c.customerName).filter(Boolean))).sort() as string[];
  }, [masters, fRoute, fSuper, fMgr, fChannel, fClass]);

  // 5. Classification Options: Strictly from CUSTMASTER, cascaded by Route, Supervisor, or Manager if selected
  const classOptions = useMemo<string[]>(() => {
    if (!masters) return ['A', 'B', 'C', 'D', 'E'];
    if (fRoute || fSuper.length > 0 || fMgr.length > 0) {
      let custs = masters.customers || [];
      if (fRoute) {
        custs = custs.filter((c: any) => c.routeCode === fRoute);
      } else if (fSuper.length > 0) {
        const supRoutes = new Set(
          (masters.routes || [])
            .filter((r: any) => isSupervisorMatch(r.superName, fSuper, fMgr))
            .map((r: any) => r.routeCode)
        );
        custs = custs.filter((c: any) => supRoutes.has(c.routeCode));
      } else if (fMgr.length > 0) {
        const mgrRoutes = new Set(
          (masters.routes || [])
            .filter((r: any) => isManagerMatch(r.managerName, fMgr))
            .map((r: any) => r.routeCode)
        );
        custs = custs.filter((c: any) => mgrRoutes.has(c.routeCode));
      }
      if (fChannel) {
        custs = custs.filter((c: any) => (c.rtm || c.channel) === fChannel);
      }
      const classes = Array.from(new Set(custs.map((c: any) => c.classification).filter(Boolean))).sort();
      return classes.length > 0 ? (classes as string[]) : ['A', 'B', 'C', 'D', 'E'];
    }
    return (masters.classifications || ['A', 'B', 'C', 'D', 'E']) as string[];
  }, [masters, fRoute, fSuper, fMgr, fChannel]);

  // 6. Route Options: Strictly from CUSTMASTER, cascaded by Supervisor, Manager, or RTM if selected
  const routeOptions = useMemo<string[]>(() => {
    if (!masters) return [];
    let routes = masters.routes || [];
    if (fSuper.length > 0) {
      routes = routes.filter((r: any) => isSupervisorMatch(r.superName, fSuper, fMgr));
    } else if (fMgr.length > 0) {
      routes = routes.filter((r: any) => isManagerMatch(r.managerName, fMgr));
    }
    if (fChannel && masters.customers) {
      const validRouteCodes = new Set(
        masters.customers
          .filter((c: any) => (c.rtm || c.channel) === fChannel)
          .map((c: any) => c.routeCode)
      );
      routes = routes.filter((r: any) => validRouteCodes.has(r.routeCode));
    }
    return Array.from(new Set(routes.map((r: any) => r.routeCode).filter((rt: string) => rt && rt !== 'DIS001'))).sort((a: any, b: any) => a.localeCompare(b, undefined, { numeric: true })) as string[];
  }, [masters, fSuper, fMgr, fChannel]);

  // Dynamic Size/Model options based on selected Asset Category
  const availableSizeModels = useMemo(() => {
    return getSizeModelsForCategory(fAssetCategory);
  }, [fAssetCategory]);

  // Reset helper
  const resetFilters = () => {
    const defaultDate = latestDateRef.current || '';
    setFFrom(defaultDate);
    setFTo(defaultDate);
    setFMgr([]);
    setFSuper([]);
    setFChannel('');
    setFClass('');
    setFCust('');
    setFRoute('');
    setFSku('');
    setFVertical('');
    setFAssetCategory('All');
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
      const mgrOk = isManagerMatch(r.manager || r.mgr, fMgr);
      const superOk = isSupervisorMatch(r.supervisor || r.sup, fSuper, fMgr);
      const channelOk = !fChannel || (r.channel || r.ch || '').toString().trim().toUpperCase() === fChannel.trim().toUpperCase();
      const classOk = !fClass || (r.classification || r.class || r.gr || '').toString().trim().toUpperCase() === fClass.trim().toUpperCase();
      const custOk = !fCust || (r.outletName || r.cust || '').toString().trim().toUpperCase() === fCust.trim().toUpperCase();
      const routeOk = !fRoute || (r.routeCode || r.route || r.rt || '').toString().trim().toUpperCase() === fRoute.trim().toUpperCase();
      return fromOk && toOk
        && mgrOk
        && superOk
        && channelOk
        && classOk
        && custOk
        && routeOk
        && (!fSku || r.skuName === fSku)
        && (!fVertical || r.businessVertical === fVertical);
    });
  }, [reportRows, fMgr, fSuper, fChannel, fClass, fCust, fRoute, fSku, fVertical, fFrom, fTo]);

  // Power SKU rows matching all active filters (date, manager, supervisor, channel, classification, outlet, route, SKU, business vertical)
  const filteredPskuRows = useMemo(() => {
    const rawPsku = (reportRows.psku && reportRows.psku.length > 0)
      ? reportRows.psku
      : rows.map((r: any) => {
          const [cCode, rCode] = (r.cust_rt_id || '').split('|');
          const isAvail = r.psku === 'A' || r.psku === 'YES' || r.status === 'Available';
          const isNotAvail = r.psku === 'N' || r.psku === 'NO' || r.status === 'Not Available';
          return {
            date: r.createdAt || r.date,
            visitId: r.visitId,
            channel: r.ch || r.channel || 'TT',
            manager: r.mgr || r.manager || '—',
            supervisor: r.sup || r.supervisor || '—',
            routeCode: r.rt || rCode || r.routeCode || '',
            outletCode: r.outletCode || r.custCode || cCode || '',
            outletName: r.cust || r.outletName || '',
            classification: r.gr || r.classification || 'C',
            class: r.gr || r.class || 'C',
            businessVertical: 'Dairy',
            skuName: 'All Power SKUs',
            skuCode: 'ALL-PSKU',
            status: isAvail ? 'Available' : 'Not Available',
            availability: isAvail ? 'YES' : 'NO',
            psku: isAvail ? 'A' : 'N',
          };
        });

    return rawPsku.filter((r: any) => {
      const rowDate = new Date(r.date);
      const from = normalizeDate(fFrom);
      const to = normalizeDate(fTo);
      const fromOk = !from || rowDate >= from;
      const toOk = !to || rowDate <= new Date(`${fTo}T23:59:59`);
      const mgrOk = isManagerMatch(r.manager || r.mgr, fMgr);
      const superOk = isSupervisorMatch(r.supervisor || r.sup, fSuper, fMgr);
      const channelOk = !fChannel || (r.channel || r.ch || '').toString().trim().toUpperCase() === fChannel.trim().toUpperCase();
      const classOk = !fClass || (r.classification || r.class || r.gr || '').toString().trim().toUpperCase() === fClass.trim().toUpperCase();
      const custOk = !fCust || (r.outletName || r.cust || '').toString().trim().toUpperCase() === fCust.trim().toUpperCase();
      const routeOk = !fRoute || (r.routeCode || r.route || r.rt || '').toString().trim().toUpperCase() === fRoute.trim().toUpperCase();
      return fromOk && toOk
        && mgrOk
        && superOk
        && channelOk
        && classOk
        && custOk
        && routeOk
        && (!fSku || r.skuName === fSku)
        && (!fVertical || r.businessVertical === fVertical);
    });
  }, [reportRows, rows, fMgr, fSuper, fChannel, fClass, fCust, fRoute, fSku, fVertical, fFrom, fTo]);

  // Cold Chain rows matching all active filters (date, manager, supervisor, channel, classification, outlet, route, asset category, size models)
  const filteredColdChainRows = useMemo(() => {
    const rawRows = (reportRows['cold-chain'] && reportRows['cold-chain'].length > 0)
      ? reportRows['cold-chain']
      : rows.map((r: any) => ({
          date: r.createdAt || r.date,
          visitId: r.visitId,
          channel: r.ch || r.channel || 'TT',
          manager: r.mgr || r.manager || '—',
          supervisor: r.sup || r.supervisor || '—',
          routeCode: r.rt || r.route || r.routeCode || '',
          outletCode: r.outletCode || r.custCode || (r.cust_rt_id ? r.cust_rt_id.split('|')[0] : ''),
          outletName: r.cust || r.outletName || '',
          classification: r.gr || r.classification || '',
          class: r.gr || r.class || '',
          assetType: r.atype || r.assetType || 'Chiller',
          sizeModel: r.sizeModel || 'Standard',
          temperature: r.tempVal !== undefined ? `${r.tempVal}°C` : (r.temperature || '—'),
          assetTemp: r.tempVal !== undefined ? `${r.tempVal}°C` : (r.temperature || '—'),
          formattedTemperature: r.tempVal !== undefined ? `${r.tempVal}°C` : (r.temperature || '—'),
          tempOk: r.ok ? 'OK' : 'Breach',
          tempStatus: r.ok ? 'In Range' : 'Breach',
          tempInRange: r.ok === true || r.ok === 1,
          tempRaw: r.tempVal ?? 0,
          actionRequired: r.action || 'None',
          observation: r.observation || '—',
          actionRemarks: r.action || r.observation || '—',
        }));

    return rawRows.filter((r: any) => {
      const rowDate = new Date(r.date);
      const from = normalizeDate(fFrom);
      const to = normalizeDate(fTo);
      const fromOk = !from || rowDate >= from;
      const toOk = !to || rowDate <= new Date(`${fTo}T23:59:59`);
      const mgrOk = isManagerMatch(r.manager, fMgr);
      const superOk = isSupervisorMatch(r.supervisor, fSuper, fMgr);
      const channelOk = !fChannel || (r.channel || '').toUpperCase().trim() === fChannel.toUpperCase().trim();
      const classOk = !fClass || (r.classification || r.class || '').toUpperCase().trim() === fClass.toUpperCase().trim();
      const custOk = !fCust || (r.outletName || '').toUpperCase().trim() === fCust.toUpperCase().trim();
      const routeOk = !fRoute || (r.routeCode || '').toUpperCase().trim() === fRoute.toUpperCase().trim();
      const catSearch = (fAssetCategory || '').toLowerCase().replace(/s$/, '');
      const catOk = !fAssetCategory || fAssetCategory === 'All' || (r.assetType || '').toLowerCase().includes(catSearch);
      const modelOk = fSizeModels.length === 0 || fSizeModels.includes(r.sizeModel) || (r.observation && fSizeModels.some(sm => (r.observation as string).toLowerCase().includes(sm.toLowerCase())));
      return fromOk && toOk && mgrOk && superOk && channelOk && classOk && custOk && routeOk && catOk && modelOk;
    });
  }, [reportRows, rows, fFrom, fTo, fMgr, fSuper, fChannel, fClass, fCust, fRoute, fAssetCategory, fSizeModels]);

  // Filtered rows matching selection (General market visits: not filtered by Cold Chain asset category)
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const rowDate = new Date(r.createdAt);
      const from = normalizeDate(fFrom);
      const to = normalizeDate(fTo);
      const fromOk = !from || rowDate >= from;
      const toOk = !to || rowDate <= new Date(`${fTo}T23:59:59`);

      const routeOk = !fRoute || (r.rt || r.route || r.routeCode || '').toString().trim().toUpperCase() === fRoute.trim().toUpperCase();
      const mgrOk = isManagerMatch(r.mgr || r.manager, fMgr, r.sup || r.supervisor, managerSupervisorMap);
      const superOk = isSupervisorMatch(r.sup || r.supervisor, fSuper, fMgr);
      const classOk = !fClass || (r.gr || r.classification || '').toString().trim().toUpperCase() === fClass.trim().toUpperCase();
      const custOk = !fCust || (r.cust || r.outletName || '').toString().trim().toUpperCase() === fCust.trim().toUpperCase();
      const channelOk = !fChannel || (r.ch || r.channel || '').toString().trim().toUpperCase() === fChannel.trim().toUpperCase();

      return mgrOk && superOk && channelOk && classOk && custOk && routeOk && fromOk && toOk;
    });
  }, [rows, fMgr, fSuper, fChannel, fClass, fCust, fRoute, fFrom, fTo, managerSupervisorMap]);

  // Visit set for the two per-vertical Classification charts: respects Manager,
  // Supervisor, Channel, Outlet/Customer, and Route Code.
  const filteredForClassCharts = useMemo(() => {
    return rows.filter((r) => {
      const rowDate = new Date(r.createdAt);
      const from = normalizeDate(fFrom);
      const to = normalizeDate(fTo);
      const fromOk = !from || rowDate >= from;
      const toOk = !to || rowDate <= new Date(`${fTo}T23:59:59`);
      const routeOk = !fRoute || (r.rt || r.route || r.routeCode || '').toString().trim().toUpperCase() === fRoute.trim().toUpperCase();
      const mgrOk = isManagerMatch(r.mgr || r.manager, fMgr, r.sup || r.supervisor, managerSupervisorMap);
      const superOk = isSupervisorMatch(r.sup || r.supervisor, fSuper, fMgr);
      const custOk = !fCust || (r.cust || r.outletName || '').toString().trim().toUpperCase() === fCust.trim().toUpperCase();
      const channelOk = !fChannel || (r.ch || r.channel || '').toString().trim().toUpperCase() === fChannel.trim().toUpperCase();
      return mgrOk && superOk && channelOk && custOk && routeOk && fromOk && toOk;
    });
  }, [rows, fMgr, fSuper, fChannel, fCust, fRoute, fFrom, fTo, managerSupervisorMap]);

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
    if (!allowedReports.includes(reportType)) return;
    const visitLookup = new Map(filtered.map((row) => [row.visitId, row]));
    let matched: any[] = [];
    if (reportType === 'cold-chain') {
      matched = filteredColdChainRows.filter((row: any) => filterFn(row) && (!row.visitId || visitLookup.has(row.visitId)));
    } else if (reportType === 'npd') {
      matched = filteredNpdRows.filter((row: any) => filterFn(row) && (!row.visitId || visitLookup.has(row.visitId)));
    } else if (reportType === 'psku') {
      const source = (filteredPskuRows && filteredPskuRows.length > 0)
        ? filteredPskuRows
        : filtered.map((r: any) => {
            const [cCode, rCode] = (r.cust_rt_id || '').split('|');
            const isAvail = r.psku === 'A' || r.psku === 'YES' || r.status === 'Available';
            const isNotAvail = r.psku === 'N' || r.psku === 'NO' || r.status === 'Not Available';
            return {
              date: r.createdAt,
              visitId: r.visitId,
              channel: r.ch || r.channel || 'TT',
              manager: r.mgr || r.manager || '—',
              supervisor: r.sup || r.supervisor || '—',
              routeCode: r.rt || rCode || '',
              outletCode: r.custCode || cCode || '',
              outletName: r.cust || r.outletName || '',
              classification: r.gr || r.classification || 'C',
              class: r.gr || r.class || 'C',
              businessVertical: 'Dairy',
              skuName: 'All Power SKUs',
              status: isAvail ? 'Available' : 'Not Available',
              availability: isAvail ? 'YES' : 'NO',
              psku: isAvail ? 'A' : 'N',
            };
          });
      matched = source.filter((row: any) => filterFn(row) && (!row.visitId || visitLookup.has(row.visitId)));
    } else {
      matched = (reportRows[reportType] || []).filter((row: any) => {
        const visit = visitLookup.get(row.visitId);
        return visit ? filterFn(visit) : false;
      });
    }
    setReportModalType(reportType);
    setReportModalSource(reportType);
    setReportModalTitle(chartTitle);
    setReportModalRows(matched);
    setReportFilterChip(chipLabel ? { key: 'segment', value: chipLabel, label: chipLabel } : null);
    setReportModalOpen(true);
  };

  const handleClearReportFilter = () => {
    const visitLookup = new Map(filtered.map((row) => [row.visitId, row]));
    if (reportModalSource === 'npd') {
      setReportModalRows(filteredNpdRows.filter((r: any) => !r.visitId || visitLookup.has(r.visitId)));
      setReportFilterChip(null);
      return;
    }
    if (reportModalSource === 'psku') {
      const source = (filteredPskuRows && filteredPskuRows.length > 0)
        ? filteredPskuRows
        : filtered.map((r: any) => {
            const [cCode, rCode] = (r.cust_rt_id || '').split('|');
            const isAvail = r.psku === 'A' || r.psku === 'YES' || r.status === 'Available';
            const isNotAvail = r.psku === 'N' || r.psku === 'NO' || r.status === 'Not Available';
            return {
              date: r.createdAt,
              visitId: r.visitId,
              channel: r.ch || r.channel || 'TT',
              manager: r.mgr || r.manager || '—',
              supervisor: r.sup || r.supervisor || '—',
              routeCode: r.rt || rCode || '',
              outletCode: r.custCode || cCode || '',
              outletName: r.cust || r.outletName || '',
              classification: r.gr || r.classification || 'C',
              class: r.gr || r.class || 'C',
              businessVertical: 'Dairy',
              skuName: 'All Power SKUs',
              status: isAvail ? 'Available' : 'Not Available',
              availability: isAvail ? 'YES' : 'NO',
              psku: isAvail ? 'A' : 'N',
            };
          });
      setReportModalRows(source.filter((r: any) => !r.visitId || visitLookup.has(r.visitId)));
      setReportFilterChip(null);
      return;
    }
    if (reportModalSource === 'cold-chain') {
      setReportModalRows(filteredColdChainRows.filter((r: any) => !r.visitId || visitLookup.has(r.visitId)));
      setReportFilterChip(null);
      return;
    }
    if (reportModalSource === 'classificationDairy' || reportModalSource === 'classificationIceCream') {
      const classLookup = new Map(filteredForClassCharts.map((row) => [row.visitId, row]));
      const sourceRows = reportModalSource === 'classificationDairy' ? reportRows.classificationDairy : reportRows.classificationIceCream;
      const matched = (sourceRows || []).filter((row: any) => classLookup.has(row.visitId));
      setReportModalRows(matched);
      setReportFilterChip(null);
      return;
    }
    const matched = (reportRows[reportModalSource] || []).filter((row: any) => visitLookup.has(row.visitId));
    setReportModalRows(matched);
    setReportFilterChip(null);
  };

  // Compute KPI values
  const outletsCount = useMemo(() => new Set(filtered.map((r) => r.cust)).size, [filtered]);
  const breachesCount = useMemo(() => filtered.filter((r) => !r.ok).length, [filtered]);
  const fefoCount = useMemo(() => filtered.filter((r) => r.fefo).length, [filtered]);
  const noVisitCount = useMemo(() => filtered.filter((r) => r.visitType === 'No Visit').length, [filtered]);
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
      // Exclude EXP Manager and INST Manager
      if (r.mgr === 'EXP MANAGER' || r.mgr === 'INST MANAGER') return;
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
    if (fMgr.length > 0) parts.push(`Manager: <b>${fMgr.join(', ')}</b>`);
    if (fSuper.length > 0) parts.push(`Supervisor: <b>${fSuper.join(', ')}</b>`);
    if (fChannel) parts.push(`RTM: <b>${fChannel}</b>`);
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
        { header: 'RTM', key: 'channel', formatter: (val: any, row: any) => val || row.ch || row.rtm || '—' },
        { header: 'Manager', key: 'manager', formatter: (val: any, row: any) => val || row.mgr || '—' },
        { header: 'Supervisor', key: 'supervisor', formatter: (val: any, row: any) => val || row.sup || '—' },
        { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.rt || row.route || (row.cust_rt_id ? row.cust_rt_id.split('|')[1] : '—') },
        { header: 'Outlet Code', key: 'outletCode', formatter: (val: any, row: any) => val || row.custCode || row.code || (row.cust_rt_id ? row.cust_rt_id.split('|')[0] : '—') },
        { header: 'Outlet Name', key: 'outletName', formatter: (val: any, row: any) => val || row.cust || '—' },
        { header: 'Classification', key: 'classification', formatter: (val: any, row: any) => val || row.gr || '—' },
        { header: 'Asset Type', key: 'assetType', formatter: (val: any, row: any) => val || row.atype || '—' },
        { header: 'Asset Temp (°C)', key: 'temp', formatter: (val) => val !== undefined && val !== null ? `${val}°C` : '—' },
        { header: 'Temp Status', key: 'ok', formatter: (val) => val ? 'OK / In Range' : 'Temp Breach' },
        // { header: 'FEFO Compliance', key: 'fefo', formatter: (val) => val ? 'Compliant' : 'Non-Compliant' },
        { header: 'Visit Type', key: 'visitType' },
        { header: 'Action Required', key: 'action', formatter: (val: any) => val || 'None' },
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
        // { metric: 'FEFO Compliance Rate', value: fefoPct, details: 'Assets following FEFO principles' },
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
    { header: 'Channel', key: 'channel', formatter: (val: any, row: any) => val || row.ch || '—' },
    { header: 'Manager', key: 'manager', formatter: (val: any, row: any) => val || row.mgr || '—' },
    { header: 'Supervisor', key: 'supervisor', formatter: (val: any, row: any) => val || row.sup || '—' },
    { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.rt || row.route || (row.cust_rt_id ? row.cust_rt_id.split('|')[1] : '—') },
    { header: 'Outlet Code', key: 'outletCode', formatter: (val: any, row: any) => val || row.custCode || row.code || (row.cust_rt_id ? row.cust_rt_id.split('|')[0] : '—') },
    { header: 'Outlet Name', key: 'outletName', formatter: (val: any, row: any) => val || row.cust || '—' },
    { header: 'Classification', key: 'classification', formatter: (val: any, row: any) => val || row.gr || '—' },
    { header: 'Asset Type', key: 'assetType', formatter: (val: any, row: any) => val || row.atype || '—' },
    { header: 'Temp (°C)', key: 'temp', formatter: (val: any) => val !== undefined && val !== null ? `${val}°C` : '—' },
    { header: 'Temp Status', key: 'ok', formatter: (val: any) => val ? 'OK' : 'Breach' },
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
    const dataToExport = filteredColdChainRows;

    exportToExcel({
      filename: `cold_chain_readings_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Cold Chain Status',
      title: 'Asset Temperature & Cold Chain Inspection Status',
      filterSummary: activeNote,
      userRole,
      columns: [
        { header: 'Inspection Date', key: 'date', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Channel', key: 'channel', formatter: (val: any, row: any) => val || row.ch || '—' },
        { header: 'Manager', key: 'manager', formatter: (val: any, row: any) => val || row.mgr || '—' },
        { header: 'Supervisor', key: 'supervisor', formatter: (val: any, row: any) => val || row.sup || '—' },
        { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.route || (row.cust_rt_id ? row.cust_rt_id.split('|')[1] : '—') },
        { header: 'Outlet Code', key: 'outletCode', formatter: (val: any, row: any) => val || row.custCode || (row.cust_rt_id ? row.cust_rt_id.split('|')[0] : '—') },
        { header: 'Outlet Name', key: 'outletName', formatter: (val: any, row: any) => val || row.cust || '—' },
        { header: 'Classification', key: 'classification', formatter: (val: any, row: any) => val || row.gr || '—' },
        { header: 'Asset Type', key: 'assetType', formatter: (val: any, row: any) => val || row.atype || '—' },
        { header: 'Asset Temp', key: 'assetTemp', formatter: (val: any, row: any) => val || (row.temperature !== undefined ? `${row.temperature}°C` : '—') },
        { header: 'Temp Status', key: 'tempStatus', formatter: (val: any, row: any) => val || (row.tempInRange ? 'In Range' : 'Breach') },
        { header: 'Action Required / Remarks', key: 'actionRemarks', formatter: (val: any, row: any) => val || row.actionRequired || '—' },
      ],
      data: dataToExport,
    });
  };

  const handleExportNpdChart = () => {
    const dataToExport = filteredNpdRows.length > 0
      ? filteredNpdRows
      : filtered.map((r) => {
          const [cCode, rCode] = (r.cust_rt_id || '').split('|');
          return {
            date: r.createdAt,
            channel: r.ch || r.channel || 'TT',
            manager: r.mgr || r.manager || '—',
            supervisor: r.sup || r.supervisor || '—',
            routeCode: r.rt || rCode || '',
            outletCode: r.outletCode || r.custCode || cCode || '',
            outletName: r.cust || r.outletName || '',
            classification: r.gr || r.classification || 'C',
            businessVertical: r.businessVertical || 'Dairy',
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
        { header: 'Channel', key: 'channel' },
        { header: 'Manager', key: 'manager' },
        { header: 'Supervisor', key: 'supervisor' },
        { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.route || (row.cust_rt_id ? row.cust_rt_id.split('|')[1] : '—') },
        { header: 'Outlet Code', key: 'outletCode', formatter: (val: any, row: any) => val || row.custCode || (row.cust_rt_id ? row.cust_rt_id.split('|')[0] : '—') },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Classification', key: 'classification' },
        { header: 'Business Vertical', key: 'businessVertical' },
        { header: 'SKU Name', key: 'skuName' },
        { header: 'NPD Availability', key: 'availability', formatter: (val: any, row: any) => val || row.status || '—' },
      ],
      data: dataToExport,
    });
  };

  const handleExportPowerSkuChart = () => {
    const dataToExport = filteredPskuRows.length > 0
      ? filteredPskuRows
      : filtered.map((r) => {
          const [cCode, rCode] = (r.cust_rt_id || '').split('|');
          return {
            date: r.createdAt,
            channel: r.ch || r.channel || 'TT',
            manager: r.mgr || r.manager || '—',
            supervisor: r.sup || r.supervisor || '—',
            routeCode: r.rt || rCode || '',
            outletCode: r.outletCode || r.custCode || cCode || '',
            outletName: r.cust || r.outletName || '',
            classification: r.gr || r.classification || 'C',
            businessVertical: 'Dairy',
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
        { header: 'Channel', key: 'channel' },
        { header: 'Manager', key: 'manager' },
        { header: 'Supervisor', key: 'supervisor' },
        { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.route || (row.cust_rt_id ? row.cust_rt_id.split('|')[1] : '—') },
        { header: 'Outlet Code', key: 'outletCode', formatter: (val: any, row: any) => val || row.custCode || (row.cust_rt_id ? row.cust_rt_id.split('|')[0] : '—') },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Classification', key: 'classification' },
        { header: 'Business Vertical', key: 'businessVertical' },
        { header: 'SKU Name', key: 'skuName' },
        { header: 'Power SKU Availability', key: 'availability', formatter: (val: any, row: any) => val || row.status || '—' },
      ],
      data: dataToExport,
    });
  };

  const handleExportClassificationDairyChart = () => {
    const visitLookup = new Map(filteredForClassCharts.map((row) => [row.visitId, row]));
    const dairyVisitRows = (reportRows.classificationDairy || []).filter((r: any) => visitLookup.has(r.visitId));

    const visitedMap = new Map<string, any>();
    dairyVisitRows.forEach((r: any) => {
      const key = r.outletCode || r.outletName;
      if (key) visitedMap.set(key, r);
    });

    const masterOutlets = (masters?.dairyOutlets || []).filter((o: any) => {
      const mgrOk = isManagerMatch(o.manager, fMgr);
      const supOk = isSupervisorMatch(o.supervisor, fSuper, fMgr);
      const chOk = !fChannel || (o.channel || '').toLowerCase() === fChannel.toLowerCase();
      const rtOk = !fRoute || o.route === fRoute;
      const custOk = !fCust || o.name === fCust || o.code === fCust;
      return mgrOk && supOk && chOk && rtOk && custOk;
    });

    const dataToExport = masterOutlets.length > 0
      ? masterOutlets.map((o: any) => {
          const visited = visitedMap.get(o.code) || visitedMap.get(o.name) || visitedMap.get(o.id);
          return {
            outletCode: o.code,
            outletName: o.name,
            routeCode: o.route,
            manager: o.manager,
            supervisor: o.supervisor,
            channel: o.channel,
            class: ['A', 'B', 'C', 'D'].includes(o.dairyGr) ? o.dairyGr : 'E',
            status: visited ? 'Visited' : 'Unvisited',
            lastVisitDate: visited?.date ? new Date(visited.date).toLocaleDateString() : '—',
          };
        })
      : dairyVisitRows;

    exportToExcel({
      filename: `classification_dairy_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Dairy Classification',
      title: 'Outlet Classification Coverage - Dairy Vertical',
      filterSummary: activeNote,
      userRole,
      columns: masterOutlets.length > 0 ? [
        { header: 'Outlet Code', key: 'outletCode' },
        { header: 'Outlet Name', key: 'outletName' },
        { header: 'Classification Grade', key: 'class' },
        { header: 'Visit Status', key: 'status' },
        { header: 'Last Visit Date', key: 'lastVisitDate' },
        { header: 'Route Code', key: 'routeCode' },
        { header: 'Channel', key: 'channel' },
        { header: 'Supervisor', key: 'supervisor' },
        { header: 'Manager', key: 'manager' },
      ] : [
        { header: 'Date', key: 'date', formatter: (val) => val ? new Date(val).toLocaleString() : '—' },
        { header: 'Channel', key: 'channel', formatter: (val: any, row: any) => val || row.ch || '—' },
        { header: 'Manager', key: 'manager', formatter: (val: any, row: any) => val || row.mgr || '—' },
        { header: 'Supervisor', key: 'supervisor', formatter: (val: any, row: any) => val || row.sup || '—' },
        { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.route || (row.cust_rt_id ? row.cust_rt_id.split('|')[1] : '—') },
        { header: 'Outlet Code', key: 'outletCode', formatter: (val: any, row: any) => val || row.custCode || (row.cust_rt_id ? row.cust_rt_id.split('|')[0] : '—') },
        { header: 'Outlet Name', key: 'outletName', formatter: (val: any, row: any) => val || row.cust || '—' },
        { header: 'Classification Grade', key: 'class', formatter: (val: any, row: any) => {
          const g = val || row.gr || row.class || 'E';
          return ['A', 'B', 'C', 'D'].includes(g) ? g : 'E';
        } },
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
        { header: 'Channel', key: 'channel', formatter: (val: any, row: any) => val || row.ch || '—' },
        { header: 'Manager', key: 'manager', formatter: (val: any, row: any) => val || row.mgr || '—' },
        { header: 'Supervisor', key: 'supervisor', formatter: (val: any, row: any) => val || row.sup || '—' },
        { header: 'Route Code', key: 'routeCode', formatter: (val: any, row: any) => val || row.route || (row.cust_rt_id ? row.cust_rt_id.split('|')[1] : '—') },
        { header: 'Outlet Code', key: 'outletCode', formatter: (val: any, row: any) => val || row.custCode || (row.cust_rt_id ? row.cust_rt_id.split('|')[0] : '—') },
        { header: 'Outlet Name', key: 'outletName', formatter: (val: any, row: any) => val || row.cust || '—' },
        { header: 'Classification Grade', key: 'class', formatter: (val: any, row: any) => {
          const g = val || row.gr || row.class || 'E';
          return ['A', 'B', 'C', 'D'].includes(g) ? g : 'E';
        } },
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
        // { header: 'FEFO Compliance (%)', key: 'fefoPct' },
      ],
      data: managerData,
    });
  };

  // Chart Rendering Hook
  useEffect(() => {
    if (isLoading || !filtered) return;

    const BLUE = '#4F46E5', BLUE_DEEP = '#3730A3', GREEN = '#059669', AMBER = '#D97706', RED = '#DC2626', GREY = '#94A3B8';
    const isDark = theme === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
    const textColor = isDark ? '#F1F5F9' : '#0F172A';

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
          ctx.font = '800 11.5px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = theme === 'dark' ? '#F8FAFC' : '#0F172A';
          ctx.shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)';
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
          ctx.font = '800 11.5px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = theme === 'dark' ? '#F8FAFC' : '#0F172A';
          ctx.shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)';
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
          ctx.font = '800 12px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 5;
          ctx.fillText(label, labelX, labelY);
          ctx.restore();
        });
      },
    });

    // 1. Trend Line Chart (Date-wise Daily Trend)
    if (canvasTrendRef.current) {
      if (chartsRef.current.cTrend) chartsRef.current.cTrend.destroy();

      const formatLocalDateKey = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const getDateKey = (r: any) => {
        const raw = r.createdAt || r.date;
        if (!raw) return '';
        if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
          return raw.trim();
        }
        const dt = new Date(raw);
        if (isNaN(dt.getTime())) {
          return String(raw).split('T')[0];
        }
        return formatLocalDateKey(dt);
      };

      const dateCounts: Record<string, number> = {};
      filtered.forEach((r) => {
        const d = getDateKey(r);
        if (d && d !== '—') {
          dateCounts[d] = (dateCounts[d] || 0) + 1;
        }
      });

      // Build sorted date sequence
      let sortedDates: string[] = [];
      if (fFrom && fTo && fFrom <= fTo) {
        const [fy, fm, fd] = fFrom.split('-').map(Number);
        const [ty, tm, td] = fTo.split('-').map(Number);
        const curr = new Date(fy, fm - 1, fd);
        const end = new Date(ty, tm - 1, td);
        const diffDays = Math.round((end.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 90) {
          while (curr <= end) {
            sortedDates.push(formatLocalDateKey(curr));
            curr.setDate(curr.getDate() + 1);
          }
        } else {
          sortedDates = Object.keys(dateCounts).sort();
        }
      } else {
        sortedDates = Object.keys(dateCounts).sort();
      }

      if (sortedDates.length === 0) {
        if (fFrom && fTo && fFrom === fTo) {
          sortedDates = [fFrom];
        } else {
          sortedDates = [formatLocalDateKey(new Date())];
        }
      }

      const formatDateShort = (dStr: string) => {
        try {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          }
        } catch (e) {}
        return dStr;
      };

      const formatDateFull = (dStr: string) => {
        try {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
          }
        } catch (e) {}
        return dStr;
      };

      const trendTotal = filtered.length;

      chartsRef.current.cTrend = new Chart(canvasTrendRef.current, {
        type: 'bar',
        data: {
          labels: sortedDates.map((d) => formatDateShort(d)),
          datasets: [
            {
              label: 'Visits',
              data: sortedDates.map((d) => dateCounts[d] || 0),
              backgroundColor: BLUE,
              hoverBackgroundColor: '#4338ca',
              borderRadius: 6,
              maxBarThickness: 48,
            },
          ],
        },
        plugins: [
          {
            id: 'trendBarValueLabels',
            afterDatasetsDraw(chart: any) {
              const { ctx } = chart;
              const dataset = chart.data.datasets[0];
              if (!dataset || !dataset.data) return;
              const meta = chart.getDatasetMeta(0);
              if (!meta || !meta.data) return;

              const fontSize = sortedDates.length > 25 ? 9 : (sortedDates.length > 15 ? 10 : 11);
              meta.data.forEach((bar: any, index: number) => {
                const value = dataset.data[index];
                if (typeof value !== 'number' || value <= 0) return;
                const label = `${value}`;
                ctx.save();
                ctx.font = `700 ${fontSize}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = theme === 'dark' ? '#f1f5f9' : '#0f172a';
                ctx.shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)';
                ctx.shadowBlur = 4;
                ctx.fillText(label, bar.x, bar.y - 4);
                ctx.restore();
              });
            },
          },
        ],
        options: {
          maintainAspectRatio: false,
          layout: {
            padding: { top: 20 },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  const dateStr = sortedDates[idx];
                  return dateStr ? formatDateFull(dateStr) : items[0]?.label || '';
                },
                label: (ctx) => {
                  const count = (ctx.raw as number) || 0;
                  const pct = trendTotal ? Math.round((count / trendTotal) * 100) : 0;
                  return ` Visits: ${count} (${pct}% of period total)`;
                },
              },
            },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0) {
              const idx = el[0].index;
              const dateStr = sortedDates[idx];
              const dateLabel = formatDateShort(dateStr);
              handleChartClick(`Visits for ${dateLabel}`, (r) => getDateKey(r) === dateStr);
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                font: { weight: 'bold' },
                maxRotation: 45,
                minRotation: 45,
                autoSkip: false,
              },
            },
            y: {
              beginAtZero: true,
              grace: '15%',
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                precision: 0,
              },
            },
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
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { weight: 'bold' } } },
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

      const isColdChainOk = (r: any) => {
        if (r.tempInRange !== undefined && r.tempInRange !== null) return r.tempInRange === true || r.tempInRange === 1;
        if (r.tempStatus) return r.tempStatus === 'In Range' || r.tempStatus === 'OK';
        if (r.tempOk) return r.tempOk === 'OK';
        if (r.ok !== undefined && r.ok !== null) return r.ok === true || r.ok === 1;
        return false;
      };

      const visitLookup = new Map(filtered.map((row) => [row.visitId, row]));
      const coldChainReportRows = (reportRows['cold-chain'] || []).filter((r: any) => visitLookup.has(r.visitId));
      if (coldChainReportRows.length > 0) {
        tempTotal = coldChainReportRows.length;
        coldChainReportRows.forEach((r: any) => {
          if (isColdChainOk(r)) okCount++;
          else breachCount++;
        });
      } else if (filtered && filtered.length > 0) {
        tempTotal = filtered.length;
        filtered.forEach((r: any) => {
          if (isColdChainOk(r)) okCount++;
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
                  isWithinRange ? isColdChainOk(r) : !isColdChainOk(r)
                );
                setReportModalType('cold-chain');
                setReportModalSource('cold-chain');
                setReportModalTitle(`Cold Chain Status · ${label}`);
                setReportModalRows(matched);
                setReportFilterChip({ key: 'segment', value: label, label: `Status: ${label}` });
                setReportModalOpen(true);
              } else {
                handleChartClick(`Cold Chain Status · ${label}`, (r) => (isWithinRange ? isColdChainOk(r) : !isColdChainOk(r)));
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
    /*
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
          labels: ['Available', 'Not Available'],
          datasets: [
            {
              data: [npdPct(availCount), npdPct(notAvailCount + notReqCount)],
              backgroundColor: [GREEN, RED],
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
              const targetCode = label === 'Available' ? 'Available' : 'Not Available';
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
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { weight: 'bold' } } },
            y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${v}%` } },
          },
        },
      });
    }
    */

    // 6. Focus SKU Availability Bar Chart (percentage-based)
    if (canvasPskuRef.current) {
      if (chartsRef.current.cPsku) chartsRef.current.cPsku.destroy();
      let availCount = 0;
      let notAvailCount = 0;
      filtered.forEach((r) => {
        const isA = r.psku === 'A' || (r.status || r.availability || '').toUpperCase() === 'AVAILABLE' || (r.status || r.availability || '').toUpperCase() === 'YES';
        if (isA) availCount++;
        else notAvailCount++;
      });
      const pskuTotal = filtered.length;
      const pskuPct = (count: number) => (pskuTotal ? Math.round((count / pskuTotal) * 100) : 0);

      chartsRef.current.cPsku = new Chart(canvasPskuRef.current, {
        type: 'bar',
        data: {
          labels: ['Available', 'Not Available'],
          datasets: [
            {
              data: [pskuPct(availCount), pskuPct(notAvailCount)],
              backgroundColor: [GREEN, RED],
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
              const pskuCode = label === 'Available' ? 'A' : 'N';
              handleDrilldownChartClick(
                'psku',
                `Power SKU Availability · ${label}`,
                (r: any) => {
                  const isA = r.psku === 'A' || (r.status || r.availability || '').toUpperCase() === 'AVAILABLE' || (r.status || r.availability || '').toUpperCase() === 'YES';
                  return pskuCode === 'A' ? isA : !isA;
                },
                label ? `Status: ${label}` : undefined
              );
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { weight: 'bold' } } },
            y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${v}%` } },
          },
        },
      });
    }

    // 7. Classification Bar Charts (Dairy & Ice Cream) - Stacked Visited vs Unvisited Outlets
    if (canvasClassDairyRef.current) {
      if (chartsRef.current.cClassDairy) chartsRef.current.cClassDairy.destroy();

      // Master outlets matching active upstream filters
      const masterOutlets = (masters?.dairyOutlets || []).filter((o: any) => {
        const mgrOk = isManagerMatch(o.manager, fMgr);
        const supOk = isSupervisorMatch(o.supervisor, fSuper, fMgr);
        const chOk = !fChannel || (o.channel || '').toLowerCase() === fChannel.toLowerCase();
        const rtOk = !fRoute || o.route === fRoute;
        const custOk = !fCust || o.name === fCust || o.code === fCust;
        return mgrOk && supOk && chOk && rtOk && custOk;
      });

      // Filtered visits during the selected period
      const visitLookup = new Map(filteredForClassCharts.map((row) => [row.visitId, row]));
      const dairyVisitRows = (reportRows.classificationDairy || []).filter((r: any) => visitLookup.has(r.visitId));

      const visitedOutletKeys = new Set<string>();
      const visitedByGrade: Record<string, Set<string>> = { A: new Set(), B: new Set(), C: new Set(), D: new Set(), E: new Set() };

      dairyVisitRows.forEach((r: any) => {
        const key = r.outletCode || r.outletName;
        if (key) {
          visitedOutletKeys.add(key);
          const gr = r.class || r.classification;
          const normalizedGr = ['A', 'B', 'C', 'D'].includes(gr) ? gr : 'E';
          if (!visitedByGrade[normalizedGr]) visitedByGrade[normalizedGr] = new Set();
          visitedByGrade[normalizedGr].add(key);
        }
      });

      const allGrades = ['A', 'B', 'C', 'D', 'E'];
      const gradeLabels = ['A', 'B', 'C', 'D', 'E'];

      const stats: Record<string, { total: number; visited: number; unvisited: number; coveragePct: number }> = {};
      allGrades.forEach((g) => {
        const outletsInGrade = masterOutlets.filter((o: any) => {
          const ogr = ['A', 'B', 'C', 'D'].includes(o.dairyGr) ? o.dairyGr : 'E';
          return ogr === g;
        });

        const masterTotal = outletsInGrade.length;
        const visitedMasterCount = outletsInGrade.filter((o: any) => visitedOutletKeys.has(o.code) || visitedOutletKeys.has(o.name) || visitedOutletKeys.has(o.id)).length;
        const visitedRowsCount = (visitedByGrade[g] || new Set()).size;

        const visited = Math.max(visitedMasterCount, visitedRowsCount);
        const total = Math.max(masterTotal, visited);
        const unvisited = Math.max(0, total - visited);
        const coveragePct = total > 0 ? Math.round((visited / total) * 100) : 0;

        stats[g] = { total, visited, unvisited, coveragePct };
      });

      const maxTotal = Math.max(...allGrades.map((g) => stats[g]?.total || 0), 10);
      const yMax = Math.ceil((maxTotal * 1.25) / 50) * 50;

      chartsRef.current.cClassDairy = new Chart(canvasClassDairyRef.current, {
        type: 'bar',
        data: {
          labels: gradeLabels,
          datasets: [
            {
              label: 'Visited Outlets',
              data: allGrades.map((g) => stats[g].visited),
              backgroundColor: '#10b981',
              hoverBackgroundColor: '#059669',
              borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
              borderSkipped: false,
              stack: 'dairyStack',
              barPercentage: 0.62,
              categoryPercentage: 0.8,
            },
            {
              label: 'Unvisited Outlets',
              data: allGrades.map((g) => stats[g].unvisited),
              backgroundColor: theme === 'dark' ? '#334155' : '#cbd5e1',
              hoverBackgroundColor: theme === 'dark' ? '#475569' : '#94a3b8',
              borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
              borderSkipped: false,
              stack: 'dairyStack',
              barPercentage: 0.62,
              categoryPercentage: 0.8,
            },
          ],
        },
        plugins: [
          {
            id: 'dairyStackedBarLabels',
            afterDatasetsDraw(chart: any) {
              const { ctx } = chart;
              const meta0 = chart.getDatasetMeta(0);
              const meta1 = chart.getDatasetMeta(1);
              if (!meta0 || !meta1) return;

              allGrades.forEach((g, i) => {
                const s = stats[g];
                if (!s || s.total === 0) return;

                const bar0 = meta0.data[i];
                const bar1 = meta1.data[i];
                const topBar = s.unvisited > 0 && bar1 ? bar1 : bar0;
                if (!topBar) return;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                // Line 1: Coverage %
                ctx.font = '800 11.5px Inter, sans-serif';
                ctx.fillStyle = s.coveragePct >= 50
                  ? (theme === 'dark' ? '#34d399' : '#059669')
                  : (theme === 'dark' ? '#fbbf24' : '#d97706');
                ctx.fillText(`${s.coveragePct}%`, topBar.x, topBar.y - 14);

                // Line 2: Ratio (visited/total)
                ctx.font = '700 10.5px Inter, sans-serif';
                ctx.fillStyle = theme === 'dark' ? '#CBD5E1' : '#0F172A';
                ctx.fillText(`${s.visited}/${s.total}`, topBar.x, topBar.y - 2);

                ctx.restore();
              });
            },
          },
        ],
        options: {
          maintainAspectRatio: false,
          layout: {
            padding: { top: 20, bottom: 4, left: 4, right: 6 },
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              align: 'end',
              labels: {
                color: textColor,
                font: { family: 'Inter, sans-serif', size: 11, weight: 'bold' },
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 10,
              },
            },
            tooltip: {
              backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a',
              titleColor: '#ffffff',
              bodyColor: '#e2e8f0',
              borderColor: theme === 'dark' ? '#334155' : '#475569',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                title: (items: any[]) => {
                  const raw = items[0]?.label;
                  const label = Array.isArray(raw) ? raw.join(' ') : String(raw || '');
                  return `Classification · Dairy: Class ${label}`;
                },
                label: (ctx: any) => {
                  const g = allGrades[ctx.dataIndex];
                  const s = stats[g];
                  if (!s) return '';
                  if (ctx.datasetIndex === 0) {
                    return ` Visited Outlets: ${s.visited.toLocaleString()} (${s.coveragePct}% coverage)`;
                  }
                  return ` Unvisited Outlets: ${s.unvisited.toLocaleString()}`;
                },
                afterBody: (items: any[]) => {
                  const g = allGrades[items[0]?.dataIndex];
                  const s = stats[g];
                  if (!s) return [];
                  return [
                    '───────────────────────',
                    ` Total Outlets: ${s.total.toLocaleString()}`,
                    ` Outlet Visit Coverage: ${s.coveragePct}% (${s.visited}/${s.total})`,
                  ];
                },
              },
            },
          },
          onClick: (e, el, chart) => {
            if (el.length > 0 && allowedReports.includes('classification')) {
              const rawLabel = chart.data.labels?.[el[0].index];
              const label = Array.isArray(rawLabel) ? rawLabel.join(' ') : String(rawLabel ?? '');
              const matched = (reportRows.classificationDairy || []).filter((row: any) => {
                const rClass = row.class || row.classification;
                const norm = ['A', 'B', 'C', 'D'].includes(rClass) ? rClass : 'E';
                return norm === label && visitLookup.has(row.visitId);
              });
              setReportModalType('classification');
              setReportModalSource('classificationDairy');
              setReportModalTitle(`Outlets by Classification · Dairy · Class ${label}`);
              setReportModalRows(matched);
              setReportFilterChip({ key: 'segment', value: `Class: ${label}`, label: `Class: ${label}` });
              setReportModalOpen(true);
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              ticks: {
                color: textColor,
                maxRotation: 0,
                minRotation: 0,
                autoSkip: false,
                font: { family: 'Inter, sans-serif', size: 11, weight: 'bold' },
              },
            },
            y: {
              stacked: true,
              beginAtZero: true,
              suggestedMax: yMax,
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                precision: 0,
                font: { family: 'Inter, sans-serif', size: 10 },
              },
            },
          },
        },
      });
    }

    /*
    if (canvasClassIceRef.current) {
      if (chartsRef.current.cClassIce) chartsRef.current.cClassIce.destroy();
      const visitLookup = new Map(filteredForClassCharts.map((row) => [row.visitId, row]));
      const iceRows = (reportRows.classificationIceCream || []).filter((r: any) => visitLookup.has(r.visitId));
      const allGrades = ['A', 'B', 'C', 'D', 'E'];
      const gradeLabels = ['A', 'B', 'C', 'D', 'E'];
      const cli: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
      iceRows.forEach((r: any) => {
        const norm = ['A', 'B', 'C', 'D'].includes(r.class) ? r.class : 'E';
        cli[norm] = (cli[norm] || 0) + 1;
      });
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
              backgroundColor: allGrades.map((g) => GCOL[g] || '#9aa9b4'),
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
              const matched = (reportRows.classificationIceCream || []).filter((row: any) => {
                const rClass = row.class || row.classification;
                const norm = ['A', 'B', 'C', 'D'].includes(rClass) ? rClass : 'E';
                return norm === label && visitLookup.has(row.visitId);
              });
              setReportModalType('classification');
              setReportModalSource('classificationIceCream');
              setReportModalTitle(`Outlets by Classification · Ice Cream · Class ${label}`);
              setReportModalRows(matched);
              setReportFilterChip({ key: 'segment', value: `Class: ${label}`, label: `Class: ${label}` });
              setReportModalOpen(true);
            }
          },
          onHover: (e, el, chart) => {
            chart.canvas.style.cursor = el.length ? 'pointer' : 'default';
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, font: { weight: 'bold' } } },
            y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${v}%` } },
          },
        },
      });
    }
    */
  }, [filtered, filteredForClassCharts, filteredNpdRows, isLoading, theme, masters, fMgr, fSuper, fChannel, fRoute, fCust]);

  return (
    <div className="dandy-dashboard-body">
      {isFleetRole(userRole) && (
        <div className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-700">
          Fleet / Maintenance view: only the Cold Chain report is available.
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .dandy-dashboard-body {
          --ink: var(--text-primary, #0F172A);
          --soft: var(--text-secondary, #334155);
          --line: var(--border, #CBD5E1);
          --card: var(--surface, #FFFFFF);
          --bg: var(--bg, #F8FAFC);
          --blue: #4F46E5;
          --blue-deep: #3730A3;
          --green: #059669;
          --amber: #D97706;
          --red: #DC2626;
          --cyan: #0284C7;
          --purple: #7C3AED;
          --shadow-subtle: 0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03);
          --shadow-elevated: 0 14px 34px -6px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.05);

          font-family: var(--font-sans), 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          background: radial-gradient(at 0% 0%, rgba(79, 70, 229, 0.04) 0px, transparent 45%),
                      radial-gradient(at 100% 0%, rgba(14, 165, 233, 0.04) 0px, transparent 40%),
                      var(--bg);
          color: var(--ink);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          padding-bottom: 32px;
          margin: -20px;
          min-height: 100vh;
        }

        :global(.dark) .dandy-dashboard-body {
          background: radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.10) 0px, transparent 45%),
                      radial-gradient(at 100% 0%, rgba(14, 165, 233, 0.07) 0px, transparent 40%),
                      var(--bg);
        }

        /* ── Flagship Executive Header Ribbon ── */
        .top {
          background: linear-gradient(135deg, #07172F 0%, #0C2854 38%, #133E7C 80%, #174E96 100%);
          color: #FFFFFF;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 18px;
          position: relative;
          overflow: hidden;
          border-bottom: 2px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 12px 32px -8px rgba(7, 23, 47, 0.4);
        }
        .top::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 80% 20%, rgba(56, 189, 248, 0.18) 0%, transparent 55%),
                      radial-gradient(circle at 10% 80%, rgba(99, 102, 241, 0.16) 0%, transparent 45%);
          pointer-events: none;
        }
        .top .logo {
          height: 48px;
          padding: 4px 10px;
          border-radius: 12px;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22), inset 0 0 0 1px rgba(255, 255, 255, 0.8);
          flex-shrink: 0;
          position: relative;
          z-index: 1;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .top .logo:hover {
          transform: scale(1.04);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
        .top .logo img {
          height: 38px;
          width: auto;
          object-fit: contain;
        }
        .top .title-block {
          position: relative;
          z-index: 1;
        }
        .top h1 {
          font-size: 19px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #FFFFFF;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .top .sub {
          font-size: 12px;
          color: rgba(241, 245, 249, 0.92);
          font-weight: 600;
          margin-top: 3px;
          letter-spacing: 0.01em;
        }
        .demo-tag {
          margin-left: auto;
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(16, 185, 129, 0.16);
          border: 1.5px solid rgba(52, 211, 153, 0.45);
          color: #A7F3D0;
          padding: 6px 14px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
          box-shadow: 0 0 18px rgba(16, 185, 129, 0.25);
        }
        .demo-tag::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #34D399;
          box-shadow: 0 0 8px #34D399;
          animation: pulse-dot 1.8s infinite;
        }

        /* ── Page Grid & Container ── */
        .wrap {
          max-width: 100%;
          padding: 16px 20px;
        }

        /* ── Frosted Command Deck (Filters) ── */
        .filters {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
          align-items: flex-end;
          background: var(--card);
          border: 1.5px solid var(--line);
          border-radius: 18px;
          padding: 14px 18px;
          box-shadow: var(--shadow-subtle);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .filters:focus-within {
          border-color: rgba(99, 102, 241, 0.4);
          box-shadow: 0 8px 24px -4px rgba(79, 70, 229, 0.08);
        }
        .fld {
          display: flex;
          flex-direction: column;
          gap: 5px;
          position: relative;
        }
        .fld label {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #0F172A; /* High contrast: deep charcoal in light mode */
          padding-left: 3px;
        }
        :global(.dark) .fld label {
          color: #F1F5F9; /* High contrast: bright slate-white in dark mode */
        }
        .filters select,
        .filters input {
          padding: 8px 12px;
          border: 1.5px solid var(--line);
          border-radius: 11px;
          background: var(--surface-2, #F8FAFC);
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          color: #0F172A;
          cursor: pointer;
          min-width: 125px;
          height: 38px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        :global(.dark) .filters select,
        :global(.dark) .filters input {
          color: #F8FAFC;
          background: var(--surface-2, #162033);
          border-color: #2A3A55;
        }
        .filters input {
          cursor: text;
        }
        .filters select:hover,
        .filters input:hover {
          border-color: #818CF8;
          background: var(--card);
        }
        .filters select:focus,
        .filters input:focus {
          outline: none;
          border-color: #4F46E5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.16);
          background: var(--card);
        }
        .reset {
          padding: 8px 16px;
          border: 1.5px solid #C7D2FE;
          border-radius: 11px;
          background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          color: #3730A3;
          cursor: pointer;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.08);
        }
        :global(.dark) .reset {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0.1) 100%);
          border-color: rgba(99, 102, 241, 0.4);
          color: #C7D2FE;
        }
        .reset:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
          border-color: #818CF8;
        }
        .reset:active {
          transform: translateY(0);
        }
        .live-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border: 1.5px solid var(--line);
          border-radius: 11px;
          background: var(--surface-2, #F8FAFC);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          font-weight: 800;
          color: #0F172A;
          user-select: none;
          height: 38px;
          margin-left: auto;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        :global(.dark) .live-badge {
          background: #111827;
          border-color: #2A3A55;
          color: #E2E8F0;
        }
        .live-dot {
          height: 9px;
          width: 9px;
          border-radius: 50%;
          display: inline-block;
        }
        .live-dot.active {
          background: #10B981;
          box-shadow: 0 0 10px #10B981;
          animation: pulse-dot 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .live-dot.syncing {
          background: #4F46E5;
          box-shadow: 0 0 10px #4F46E5;
          animation: pulse-dot 0.6s ease-in-out infinite alternate;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        /* ── Active Filter Note ── */
        .active-note {
          font-size: 11.5px;
          color: #1E293B;
          font-weight: 750;
          padding-left: 4px;
          min-height: 18px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
        }
        :global(.dark) .active-note {
          color: #E2E8F0;
        }
        .active-note b {
          color: #3730A3;
          background: #EEF2FF;
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid #C7D2FE;
          font-weight: 850;
        }
        :global(.dark) .active-note b {
          color: #E0E7FF;
          background: rgba(99, 102, 241, 0.22);
          border-color: rgba(99, 102, 241, 0.45);
        }

        /* ── Executive Metric Jewel Cards ── */
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .kpi {
          background: var(--card);
          border-radius: 16px;
          padding: 16px 18px;
          box-shadow: var(--shadow-subtle);
          border: 1.5px solid var(--line);
          position: relative;
          overflow: hidden;
          transition: all 0.26s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: default;
        }
        .kpi::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }
        .kpi.b::before { background: linear-gradient(90deg, #4F46E5 0%, #818CF8 100%); }
        .kpi.g::before { background: linear-gradient(90deg, #059669 0%, #34D399 100%); }
        .kpi.a::before { background: linear-gradient(90deg, #D97706 0%, #FBBF24 100%); }
        .kpi.c::before { background: linear-gradient(90deg, #0284C7 0%, #38BDF8 100%); }
        .kpi.r::before { background: linear-gradient(90deg, #DC2626 0%, #FB7185 100%); }

        .kpi:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-elevated);
        }
        .kpi.b:hover { border-color: rgba(99, 102, 241, 0.6); }
        .kpi.g:hover { border-color: rgba(16, 185, 129, 0.6); }
        .kpi.a:hover { border-color: rgba(245, 158, 11, 0.6); }
        .kpi.c:hover { border-color: rgba(14, 165, 233, 0.6); }
        .kpi.r:hover { border-color: rgba(239, 68, 68, 0.6); }

        .kpi .lbl {
          font-size: 11px;
          color: #0F172A;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        :global(.dark) .kpi .lbl {
          color: #F1F5F9;
        }
        .kpi .val {
          font-size: 32px;
          font-weight: 950;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-top: 6px;
        }
        .kpi.b .val { color: #3730A3; }
        :global(.dark) .kpi.b .val { color: #A5B4FC; }

        .kpi.g .val { color: #065F46; }
        :global(.dark) .kpi.g .val { color: #6EE7B7; }

        .kpi.a .val { color: #92400E; }
        :global(.dark) .kpi.a .val { color: #FCD34D; }

        .kpi.c .val { color: #075985; }
        :global(.dark) .kpi.c .val { color: #7DD3FC; }

        .kpi.r .val { color: #9F1239; }
        :global(.dark) .kpi.r .val { color: #FDA4AF; }

        .kpi .delta {
          font-size: 11.5px;
          font-weight: 750;
          margin-top: 5px;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        :global(.dark) .kpi .delta {
          color: #CBD5E1;
        }
        .kpi .delta .kpi-icon {
          font-size: 8px;
          opacity: 0.7;
        }

        /* ── Chart Panels ── */
        .grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        .grid3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        @media(max-width: 820px){
          .grid, .grid3 { grid-template-columns: 1fr; }
        }
        .panel {
          background: var(--card);
          border-radius: 18px;
          padding: 16px 18px 10px;
          box-shadow: var(--shadow-subtle);
          border: 1.5px solid var(--line);
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .panel:hover {
          border-color: rgba(99, 102, 241, 0.35);
          box-shadow: 0 10px 26px -6px rgba(15, 23, 42, 0.08);
        }
        .panel.tbl { padding-bottom: 14px; }
        .panel h3 {
          font-size: 14px;
          font-weight: 900;
          color: #0F172A;
          letter-spacing: -0.01em;
          margin-bottom: 3px;
        }
        :global(.dark) .panel h3 {
          color: #F8FAFC;
        }
        .panel .psub {
          font-size: 11.5px;
          color: #334155;
          font-weight: 700;
          margin-bottom: 10px;
        }
        :global(.dark) .panel .psub {
          color: #CBD5E1;
        }
        .chart-box { position: relative; height: 185px; }
        .chart-sm { position: relative; height: 155px; }

        /* ── Tables & Lists ── */
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th {
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #0F172A;
          padding: 9px 12px;
          border-bottom: 2px solid var(--line);
          font-weight: 900;
          position: sticky;
          top: 0;
          background: var(--surface-2, #F8FAFC);
          z-index: 5;
        }
        :global(.dark) th {
          color: #F1F5F9;
          background: #162033;
        }
        td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-soft, #EEF1F7);
          color: #0F172A;
          font-weight: 600;
        }
        :global(.dark) td {
          color: #E2E8F0;
        }
        tr:hover td { background: var(--surface-2, #F8FAFC); }
        .tbl-wrap {
          max-height: 260px;
          overflow-y: auto;
          overflow-x: auto;
          border-radius: 14px;
          border: 1.5px solid var(--line);
          -webkit-overflow-scrolling: touch;
        }
        .pill {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 850;
        }
        .pill.g { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
        .pill.r { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
        :global(.dark) .pill.g { background: rgba(5, 150, 105, 0.2); color: #6EE7B7; border-color: rgba(5, 150, 105, 0.4); }
        :global(.dark) .pill.r { background: rgba(220, 38, 38, 0.2); color: #FCA5A5; border-color: rgba(220, 38, 38, 0.4); }

        .foot {
          text-align: center;
          color: #475569;
          font-size: 11.5px;
          font-weight: 650;
          margin-top: 18px;
          line-height: 1.6;
        }
        :global(.dark) .foot {
          color: #94A3B8;
        }

        @media(max-width: 640px) {
          .top {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            padding: 14px 16px;
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
          .live-badge {
            width: 100%;
            justify-content: center;
          }
        }
      ` }} />

      {/* Flagship Executive Header Banner */}
      <div className="top">
        <div className="logo">
          <img src="/images/dandy-logo.png" alt="Dandy" />
        </div>
        <div className="title-block">
          <h1>
            <span>Dandy Market Visit</span>
            <span className="text-[rgba(255,255,255,0.4)] text-base font-normal">|</span>
            <span className="text-sky-300 font-extrabold text-[15px] tracking-normal uppercase bg-sky-500/20 px-2.5 py-0.5 rounded-md border border-sky-400/30">
              Executive Command
            </span>
          </h1>
          <div className="sub">Field-force visit compliance, cold chain telemetry & retail execution · Dandy Company Ltd</div>
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



          <div className="fld min-w-[155px]">
            <label>Manager</label>
            <MultiSelectDropdown
              placeholder="All Managers"
              options={mgrOptions}
              selectedValues={fMgr}
              onChange={(selected) => {
                setFMgr(selected);
                // Retain only supervisors that belong to selected managers, if any managers are selected
                if (selected.length > 0 && masters) {
                  const validSups = new Set<string>();
                  selected.forEach((m) => {
                    const mUpper = m.toUpperCase();
                    if (masters.managerSupervisorMap && masters.managerSupervisorMap[mUpper]) {
                      (masters.managerSupervisorMap[mUpper] as string[]).forEach((s) => validSups.add(s));
                    } else {
                      (masters.routes || [])
                        .filter((r: any) => (r.managerName || '').toUpperCase() === mUpper)
                        .forEach((r: any) => { if (r.superName) validSups.add(r.superName); });
                    }
                  });
                  setFSuper((prev) => prev.filter((s) => validSups.has(s)));
                }
                setFChannel('');
                setFClass('');
                setFCust('');
                setFRoute('');
              }}
            />
          </div>

          <div className="fld min-w-[165px]">
            <label>Supervisor</label>
            <MultiSelectDropdown
              placeholder="All Supervisors"
              options={supOptions}
              selectedValues={fSuper}
              onChange={(selected) => {
                setFSuper(selected);
                setFChannel('');
                setFClass('');
                setFCust('');
                setFRoute('');
                // If user selected supervisors and no manager was selected, check if they all belong to a single manager
                if (selected.length > 0 && masters?.routes && fMgr.length === 0) {
                  const matchingRoutes = (masters.routes as any[]).filter(
                    (r) => selected.some((s) => (r.superName || '').toUpperCase() === s.toUpperCase())
                  );
                  const mgrs = Array.from(new Set(matchingRoutes.map((r) => r.managerName).filter(Boolean)));
                  if (mgrs.length === 1) {
                    setFMgr([mgrs[0]]);
                  }
                }
              }}
            />
          </div>

          <div className="fld min-w-[120px]">
            <label>RTM</label>
            <select
              value={fChannel}
              onChange={(e) => {
                setFChannel(e.target.value);
                setFClass('');
                setFCust('');
              }}
            >
              <option value="">All RTM</option>
              {rtmOptions.map((c) => (
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
              const val = e.target.value;
              setFRoute(val);
              setFCust('');
              if (val && masters?.routes) {
                const rtInfo = (masters.routes as any[]).find((r) => r.routeCode === val);
                if (rtInfo) {
                  if (rtInfo.managerName && fMgr.length === 0) setFMgr([rtInfo.managerName]);
                  if (rtInfo.superName && fSuper.length === 0) setFSuper([rtInfo.superName]);
                }
              }
            }}>
              <option value="">All Route Codes</option>
              {routeOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* <div className="fld">
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
          </div> */}

          {/* <div className="fld min-w-[190px]">
            <label>Size / Model</label>
            <MultiSelectDropdown
              placeholder="Select Size/Model"
              options={availableSizeModels}
              selectedValues={fSizeModels}
              onChange={setFSizeModels}
            />
          </div> */}

          <button className="reset" onClick={resetFilters}>Reset</button>

          {/* <ExportButton onClick={handleExportAllFilteredVisits} label="Export Filtered Data" variant="default" /> */}

          <div className="live-badge">
            <span className={`live-dot ${isSyncing ? 'syncing' : 'active'}`} />
            <span>{isSyncing ? 'SYNCING...' : 'LIVE SYNC ACTIVE'}</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>UPDATED {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2.5 p-3 mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-600 dark:text-indigo-400 backdrop-blur-sm animate-pulse shadow-xs">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Synchronizing executive analytics & live telemetry...</span>
          </div>
        )}

        {/* Active Filter description */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="active-note flex-grow" dangerouslySetInnerHTML={{ __html: activeNote }} />
          <ExportButton onClick={handleExportKpis} label="Export KPI Summary" variant="compact" />
        </div>

        {/* KPI Row */}
        <div className="kpis">
          <div className="kpi b" title="Total Visits Logged in Filtered Period">
            <div className="lbl">Total Visits</div>
            <div className="val">{isLoading && rows.length === 0 ? '...' : filtered.length}</div>
            <div className="delta">
              <span className="kpi-icon">●</span> visits logged
            </div>
          </div>
          <div className="kpi g" title="Unique Outlets Visited in Filtered Period">
            <div className="lbl">Outlets Covered</div>
            <div className="val">{isLoading && rows.length === 0 ? '...' : outletsCount}</div>
            <div className="delta">
              <span className="kpi-icon">●</span> unique outlets
            </div>
          </div>
          <div className="kpi a" title="Skipped / No-Visit Outlets">
            <div className="lbl">No Visits</div>
            <div className="val">{isLoading && rows.length === 0 ? '...' : noVisitCount}</div>
            <div className="delta">
              <span className="kpi-icon">●</span> skipped outlet visits
            </div>
          </div>
          <div className="kpi c" title="Total Cold Chain & Chiller Assets Inspected">
            <div className="lbl">Assets Checked</div>
            <div className="val">{isLoading && rows.length === 0 ? '...' : filtered.length}</div>
            <div className="delta">
              <span className="kpi-icon">●</span> chillers/freezers
            </div>
          </div>
          <div className="kpi r" title="Temperature Violations Detected">
            <div className="lbl">Temp Breaches</div>
            <div className="val">{isLoading && rows.length === 0 ? '...' : breachesCount}</div>
            <div className="delta">
              <span className="kpi-icon">●</span> {isLoading && rows.length === 0 ? '...' : breachPct}
            </div>
          </div>
        </div>

        {/* Chart Row 1 */}
        <div style={{ marginBottom: '16px' }}>
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Visits Over Time</h3>
                <div className="psub">Daily visits (filtered)</div>
              </div>
              <ExportButton onClick={handleExportTrendChart} label="Export" variant="compact" />
            </div>
            <div className="chart-box">
              <canvas ref={canvasTrendRef}></canvas>
            </div>
          </div>
          {/* <div className="panel">
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
          </div> */}
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
        <div className="grid" style={{ gridTemplateColumns: 'minmax(280px, 1fr) minmax(360px, 1.5fr)' }}>
          {/* <div className="panel">
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
          </div> */}
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Power SKU Availability</h3>
                <div className="psub">Focus SKU presence</div>
              </div>
              <ExportButton onClick={handleExportPowerSkuChart} label="Export" variant="compact" />
            </div>
            <div style={{ position: 'relative', height: '210px' }}>
              <canvas ref={canvasPskuRef}></canvas>
            </div>
          </div>
          <div className="panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3>Outlets by Classification · Dairy</h3>
                <div className="psub">Outlet visit coverage (Visited vs Unvisited by Class)</div>
              </div>
              <ExportButton onClick={handleExportClassificationDairyChart} label="Export" variant="compact" />
            </div>
            <div style={{ position: 'relative', height: '210px' }}>
              <canvas ref={canvasClassDairyRef}></canvas>
            </div>
          </div>
          {/* <div className="panel">
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
          </div> */}
        </div>

        {/* Visit Summary Visual Table (Replaces Manager Table and Visit Details) */}
        <VisitSummaryTable
          rows={filtered}
          reportRows={reportRows}
          title="Visit Execution & Asset Summary"
          subtitle="Outlet-level audit details, SKU availability counts, and cold chain asset models"
        />

        {/* Audit Photo Gallery Section with Pagination */}
        {/* <PhotoGallerySection
          photos={photos}
          fFrom={fFrom}
          fTo={fTo}
          fMgr={fMgr}
          fSuper={fSuper}
          fChannel={fChannel}
          fCust={fCust}
          fRoute={fRoute}
        /> */}

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
