'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  HelpCircle,
  Printer,
  Eye,
  Columns,
  TableProperties,
  X,
} from 'lucide-react';
import { exportToExcel, ExcelColumn } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';

export interface SummaryVisitRow {
  date: string;
  supervisor: string;
  routeCode: string;
  outletCode: string;
  outletName: string;
  channel?: string;
  classification?: string;
  visitType?: string;
  pskuAvailableCount: number;
  totalPskuCount: number;
  pskuRatioDisplay: string;
  chillerModels: string[];
  freezerModels: string[];
  chillerModelDisplay: string;
  freezerModelDisplay: string;
  tempDisplay: string;
  tempOk: boolean;
  assetStatuses: { assetType: string; status: string; label: string }[];
  assetStatusDisplay: string;
  observationActionDisplay: string;
  visitId?: string;
  id?: string;
  raw?: any;
}

interface VisitSummaryTableProps {
  rows: any[];
  reportRows?: { psku?: any[]; npd?: any[]; 'cold-chain'?: any[] };
  title?: string;
  subtitle?: string;
  onRowClick?: (row: any) => void;
  itemsPerPageDefault?: number;
}

type SortField =
  | 'date'
  | 'supervisor'
  | 'routeCode'
  | 'outletCode'
  | 'outletName'
  | 'pskuAvailableCount'
  | 'chillerModelDisplay'
  | 'freezerModelDisplay'
  | 'tempDisplay'
  | 'assetStatusDisplay'
  | 'observationActionDisplay';

function formatDateDisplay(rawDate: any): string {
  if (!rawDate) return '—';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return String(rawDate).slice(0, 10);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return String(rawDate).slice(0, 10);
  }
}

export function cleanModelName(val: any, assetType?: 'Chiller' | 'Freezer', isMT?: boolean, index: number = 0): string {
  const s = String(val || '').trim();
  const lower = s.toLowerCase();

  // Any empty, dash, or generic 'standard' variant must be normalized
  const isGenericOrStandard =
    !s ||
    s === '—' ||
    lower.includes('standard') ||
    lower === 'asset' ||
    lower === 'model' ||
    lower === 'null' ||
    lower === 'undefined';

  if (assetType === 'Chiller') {
    if (!isGenericOrStandard) {
      if (lower.includes('open')) return 'Open Chiller';
      if (lower.includes('double')) return 'Double Door';
      if (lower.includes('single')) return 'Single Door';
      if (['Double Door', 'Open Chiller', 'Single Door'].includes(s)) return s;
    }
    return isMT ? 'Double Door' : 'Single Door';
  }

  if (assetType === 'Freezer') {
    if (!isGenericOrStandard) {
      if (lower.includes('vert')) return 'VERTICAL';
      if (lower.includes('600')) return '600';
      if (lower.includes('400')) return '400';
      if (lower.includes('300')) return '300';
      if (lower.includes('200')) return '200';
      if (lower.includes('100')) return '100';
      if (['100', '200', '300', '400', '600', 'VERTICAL'].includes(s.toUpperCase())) return s.toUpperCase();
    }
    if (isMT) return index > 0 ? '400' : '600';
    return index > 0 ? '300' : '400';
  }

  // Fallback if assetType is unspecified
  if (lower.includes('open')) return 'Open Chiller';
  if (lower.includes('double')) return 'Double Door';
  if (lower.includes('single')) return 'Single Door';
  if (lower.includes('vert')) return 'VERTICAL';
  if (lower.includes('600')) return '600';
  if (lower.includes('400')) return '400';
  if (lower.includes('300')) return '300';
  if (lower.includes('200')) return '200';
  if (lower.includes('100')) return '100';

  if (isGenericOrStandard) {
    return isMT ? 'Double Door' : 'Single Door';
  }

  return s;
}

export default function VisitSummaryTable({
  rows = [],
  reportRows,
  title = 'Recent Visit Records',
  subtitle = 'Outlet-level audit details, visit status, and cold chain performance',
  onRowClick,
  itemsPerPageDefault = 10,
}: VisitSummaryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(itemsPerPageDefault);
  const [viewMode, setViewMode] = useState<'fit' | 'wide'>('fit');
  const [selectedModalRow, setSelectedModalRow] = useState<SummaryVisitRow | null>(null);

  // Pre-calculate SKU availability & total lookup maps for fast fallback
  const pskuTotalsLookup = useMemo(() => {
    const availMap = new Map<string, number>();
    const totalMap = new Map<string, number>();
    if (Array.isArray(reportRows?.psku)) {
      reportRows.psku.forEach((p: any) => {
        const vId = p.visitId;
        if (!vId) return;
        totalMap.set(vId, (totalMap.get(vId) || 0) + 1);
        const isAvail = p.status === 'Available' || p.availability === 'YES' || p.psku === 'A';
        if (isAvail) {
          availMap.set(vId, (availMap.get(vId) || 0) + 1);
        }
      });
    }
    return { availMap, totalMap };
  }, [reportRows?.psku]);

  // Transform incoming row objects into normalized summary row items
  const normalizedData: SummaryVisitRow[] = useMemo(() => {
    return rows.map((r: any) => {
      const vId = r.visitId || r.id || '';
      const dateVal = r.date || r.createdAt || r.visit_datetime;
      const formattedDate = formatDateDisplay(dateVal);

      const supervisor = (r.supervisor || r.sup || '—').trim();
      const routeCode = (r.routeCode || r.route || r.rt || '—').trim();
      const cleanRoute = routeCode.toUpperCase().trim();
      const outletCode = (
        r.outletCode ||
        r.customerCode ||
        (r.cust_rt_id ? r.cust_rt_id.split('|')[0] : '') ||
        '—'
      ).trim();
      const cleanCustCode = outletCode.toUpperCase().trim();
      const outletName = (r.outletName || r.cust || r.customerName || '—').trim();
      const cleanCustName = outletName.toUpperCase().trim();

      // Channel determination for Power SKU standard and asset sizing
      const ch = (r.channel || r.ch || r.rtm || '').toString().toUpperCase().trim();
      const isTT = ch === 'TT' || cleanRoute.startsWith('TR') || cleanRoute.startsWith('TRI');
      const isMT =
        !isTT &&
        (ch === 'MT' ||
          ch.includes('MODERN') ||
          cleanCustCode.startsWith('MTD') ||
          cleanRoute.startsWith('C') ||
          cleanCustName.includes('LULU') ||
          cleanCustName.includes('CARREFOUR') ||
          cleanCustName.includes('MEGAMART') ||
          cleanCustName.includes('AL MEERA') ||
          cleanCustName.includes('HYPER'));

      // User instruction: "power sku should not 41. for MT its 24 and for TT its 27, correct these 2."
      const totalPskuCount = isMT ? 24 : 27;

      const rawAvail =
        typeof r.pskuAvailableCount === 'number'
          ? r.pskuAvailableCount
          : (pskuTotalsLookup.availMap.get(vId) ?? (r.psku === 'A' ? 1 : 0));

      const pskuAvailableCount = Math.min(rawAvail, totalPskuCount);
      const pskuRatioDisplay = `${pskuAvailableCount} / ${totalPskuCount}`;

      // Chiller models extraction (handles 1 or 2+ assets in same outlet)
      let chillerModels: string[] = [];
      if (Array.isArray(r.chillerModels) && r.chillerModels.length > 0) {
        chillerModels = r.chillerModels
          .map((m: string, idx: number) => cleanModelName(m, 'Chiller', isMT, idx))
          .filter(Boolean);
      } else if (Array.isArray(r.allAssets)) {
        const chillers = r.allAssets.filter((a: any) => (a.assetType || '').toLowerCase() === 'chiller');
        chillerModels = chillers
          .map((c: any, idx: number) => cleanModelName(c.sizeModel, 'Chiller', isMT, idx))
          .filter(Boolean);
      }
      if (chillerModels.length === 0 && r.chillerModel && r.chillerModel !== '—') {
        chillerModels = r.chillerModel
          .split(',')
          .map((s: string, idx: number) => cleanModelName(s, 'Chiller', isMT, idx))
          .filter(Boolean);
      }
      if (chillerModels.length === 0 && (r.atype || r.assetType || '').toLowerCase() === 'chiller') {
        chillerModels = [cleanModelName(r.sizeModel, 'Chiller', isMT, 0)].filter(Boolean);
      }

      // Freezer models extraction (handles 1 or 2+ assets in same outlet)
      let freezerModels: string[] = [];
      if (Array.isArray(r.freezerModels) && r.freezerModels.length > 0) {
        freezerModels = r.freezerModels
          .map((m: string, idx: number) => cleanModelName(m, 'Freezer', isMT, idx))
          .filter(Boolean);
      } else if (Array.isArray(r.allAssets)) {
        const freezers = r.allAssets.filter((a: any) => (a.assetType || '').toLowerCase() === 'freezer');
        freezerModels = freezers
          .map((f: any, idx: number) => cleanModelName(f.sizeModel, 'Freezer', isMT, idx))
          .filter(Boolean);
      }
      if (freezerModels.length === 0 && r.freezerModel && r.freezerModel !== '—') {
        freezerModels = r.freezerModel
          .split(',')
          .map((s: string, idx: number) => cleanModelName(s, 'Freezer', isMT, idx))
          .filter(Boolean);
      }
      if (freezerModels.length === 0 && (r.atype || r.assetType || '').toLowerCase() === 'freezer') {
        freezerModels = [cleanModelName(r.sizeModel, 'Freezer', isMT, 0)].filter(Boolean);
      }

      const chillerModelDisplay = chillerModels.length > 0 ? chillerModels.join(', ') : '—';
      const freezerModelDisplay = freezerModels.length > 0 ? freezerModels.join(', ') : '—';

      // Asset Status resolution
      let assetStatuses: { assetType: string; status: string; label: string }[] = [];
      if (Array.isArray(r.assetStatuses) && r.assetStatuses.length > 0) {
        assetStatuses = r.assetStatuses;
      } else if (Array.isArray(r.allAssets) && r.allAssets.length > 0) {
        assetStatuses = r.allAssets.map((a: any) => {
          const st = (a.actionRequired && a.actionRequired !== 'Select Status' && a.actionRequired !== 'None')
            ? a.actionRequired
            : 'Working';
          return {
            assetType: a.assetType || 'Asset',
            status: st,
            label: r.allAssets.length > 1 ? `${a.assetType}: ${st}` : st,
          };
        });
      } else if (r.assetStatus && r.assetStatus !== '—') {
        assetStatuses = [{ assetType: 'Asset', status: r.assetStatus, label: r.assetStatus }];
      } else if (r.action && r.action !== 'None') {
        assetStatuses = [{ assetType: 'Asset', status: r.action, label: r.action }];
      } else if (r.atype || r.assetType) {
        assetStatuses = [{ assetType: r.atype || r.assetType, status: 'Working', label: 'Working' }];
      }

      let assetStatusDisplay = r.assetStatus || '—';
      if (assetStatusDisplay === '—' && assetStatuses.length > 0) {
        assetStatusDisplay = assetStatuses.map((s) => s.label).join(' | ');
      }

      // Observation & Action resolution
      let observationActionDisplay = r.observationAction || '';
      if (!observationActionDisplay || observationActionDisplay === '—') {
        const obsList: string[] = [];
        if (Array.isArray(r.allAssets)) {
          r.allAssets.forEach((a: any) => {
            const parts: string[] = [];
            if (a.actionRequired && a.actionRequired !== 'Select Status' && a.actionRequired !== 'Working' && a.actionRequired !== 'None') {
              parts.push(a.actionRequired);
            }
            if (a.observation && a.observation.trim() && a.observation.trim() !== '—') {
              parts.push(a.observation.trim());
            }
            if (parts.length > 0) {
              obsList.push(r.allAssets.length > 1 ? `${a.assetType}: ${parts.join(' - ')}` : parts.join(' - '));
            }
          });
        }
        if (r.observation && r.observation.trim() && !obsList.some((p) => p.includes(r.observation.trim()))) {
          obsList.push(r.observation.trim());
        }
        if (r.reason && r.reason !== '—' && !obsList.some((p) => p.includes(r.reason.trim()))) {
          obsList.push(`Reason: ${r.reason.trim()}`);
        }
        observationActionDisplay = obsList.length > 0 ? obsList.join('; ') : '—';
      }

      // Temp formatting
      let tempDisplay = r.tempDisplay;
      if (!tempDisplay || tempDisplay === '—') {
        const ca = r.allAssets?.find((a: any) => (a.assetType || '').toLowerCase() === 'chiller');
        const fa = r.allAssets?.find((a: any) => (a.assetType || '').toLowerCase() === 'freezer');
        if (ca && fa) {
          tempDisplay = `C: ${ca.temperature}°C | F: ${fa.temperature}°C`;
        } else if (ca) {
          tempDisplay = `${ca.temperature}°C`;
        } else if (fa) {
          tempDisplay = `${fa.temperature}°C`;
        } else if (r.tempVal !== undefined && r.tempVal !== null && !isNaN(Number(r.tempVal))) {
          tempDisplay = `${Number(r.tempVal).toFixed(1)}°C`;
        } else if (r.temp && r.temp !== 'OK' && r.temp !== 'Breach') {
          tempDisplay = `${r.temp}°C`;
        } else {
          tempDisplay = '—';
        }
      }

      const tempOk = r.ok === true || r.ok === 1 || r.tempInRange === true || r.temp === 'OK';
      const channel = r.ch || r.channel || 'TT';
      const classification = r.gr || r.classification || r.class || 'C';
      const visitType = r.visitType || (r.status === 'No Visit' ? 'No Visit' : 'Visited');

      return {
        date: formattedDate,
        supervisor,
        routeCode,
        outletCode,
        outletName,
        channel,
        classification,
        visitType,
        pskuAvailableCount,
        totalPskuCount,
        pskuRatioDisplay,
        chillerModels,
        freezerModels,
        chillerModelDisplay,
        freezerModelDisplay,
        tempDisplay,
        tempOk,
        assetStatuses,
        assetStatusDisplay,
        observationActionDisplay,
        visitId: vId,
        id: vId,
        raw: r,
      };
    });
  }, [rows, pskuTotalsLookup]);

  // Filtering
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return normalizedData;
    const term = searchTerm.toLowerCase().trim();
    return normalizedData.filter((item) => {
      return (
        item.date.toLowerCase().includes(term) ||
        item.supervisor.toLowerCase().includes(term) ||
        item.routeCode.toLowerCase().includes(term) ||
        item.outletCode.toLowerCase().includes(term) ||
        item.outletName.toLowerCase().includes(term) ||
        item.chillerModelDisplay.toLowerCase().includes(term) ||
        item.freezerModelDisplay.toLowerCase().includes(term) ||
        item.tempDisplay.toLowerCase().includes(term) ||
        item.assetStatusDisplay.toLowerCase().includes(term) ||
        item.observationActionDisplay.toLowerCase().includes(term) ||
        item.pskuRatioDisplay.toLowerCase().includes(term) ||
        String(item.pskuAvailableCount).includes(term)
      );
    });
  }, [normalizedData, searchTerm]);

  // Sorting
  const sortedData = useMemo(() => {
    const list = [...filteredData];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      valA = (valA ?? '').toString().toLowerCase();
      valB = (valB ?? '').toString().toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredData, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPageClamped = Math.min(currentPage, totalPages);
  const startIndex = (currentPageClamped - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'date' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-30 hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-[var(--accent)]" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[var(--accent)]" />
    );
  };

  // Export to Excel with all detailed columns including Asset Status and Observation & Action
  const handleExportExcel = () => {
    const columns: ExcelColumn<SummaryVisitRow>[] = [
      { header: 'Date', key: 'date' },
      { header: 'Supervisor', key: 'supervisor' },
      { header: 'Route Code', key: 'routeCode' },
      { header: 'Outlet Code', key: 'outletCode' },
      { header: 'Outlet Name', key: 'outletName' },
      { header: 'Power SKUs (Available / Total)', key: 'pskuRatioDisplay' },
      { header: 'Chiller Model', key: 'chillerModelDisplay' },
      { header: 'Freezer Model', key: 'freezerModelDisplay' },
      { header: 'Temp', key: 'tempDisplay' },
      { header: 'Asset Status', key: 'assetStatusDisplay' },
      { header: 'Observation & Action', key: 'observationActionDisplay' },
    ];

    exportToExcel({
      filename: `Visit_Execution_Asset_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Execution & Assets',
      columns,
      data: sortedData,
    });
  };

  return (
    <div className="panel tbl" style={{ marginBottom: '16px' }}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-soft)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight m-0">{title}</h3>
            <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
              {filteredData.length} {filteredData.length === 1 ? 'visit' : 'visits'}
            </span>
          </div>
          <div className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">{subtitle}</div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by outlet, customer, route code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 pl-8 pr-3 text-[12px] font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all w-52 md:w-68"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle (Fit to Screen No Scroll vs Wide Grid) */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('fit')}
              className={`flex items-center gap-1.5 px-3 h-7.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'fit'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Fit to Screen: Consolidated view without any horizontal scroll"
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Fit Screen (No Scroll)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('wide')}
              className={`flex items-center gap-1.5 px-3 h-7.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'wide'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Wide Grid: Individual columns with horizontal scroll"
            >
              <TableProperties className="h-3.5 w-3.5" />
              <span>Wide Grid</span>
            </button>
          </div>

          {/* Page Size Selector */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-8.5 px-2.5 text-[11.5px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>

          {/* Export to Excel */}
          <ExportButton
            onClick={handleExportExcel}
            label="Export"
            variant="compact"
            title="Export summary table to Excel (.xlsx)"
          />

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="h-8.5 px-3 inline-flex items-center gap-1.5 text-[11.5px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
            title="Print visit records"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Print</span>
          </button>

          {/* View All Button */}
          <button
            type="button"
            onClick={() => {
              setPageSize(100);
              setCurrentPage(1);
            }}
            className="h-8.5 px-3 inline-flex items-center gap-1 text-[11.5px] rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all cursor-pointer shadow-2xs"
          >
            <span>View All</span>
          </button>
        </div>
      </div>

      {/* Interactive Table Container - No Horizontal Scroll in Fit Mode */}
      <div
        className="tbl-wrap w-full"
        style={{
          overflowX: viewMode === 'fit' ? 'hidden' : 'auto',
          maxHeight: '580px',
          overflowY: 'auto',
        }}
      >
        {viewMode === 'fit' ? (
          /* =========================================================================
             FIT TO SCREEN (NO X-AXIS SCROLL) - 6 PROPORTIONATELY GROUPED COLUMNS
             ========================================================================= */
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                <th
                  onClick={() => handleSort('date')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ width: '17%' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Visit & Supervisor</span>
                    {renderSortIcon('date')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('outletName')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ width: '27%' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Outlet / Customer</span>
                    {renderSortIcon('outletName')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pskuAvailableCount')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ width: '14%' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status & SKUs</span>
                    {renderSortIcon('pskuAvailableCount')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('tempDisplay')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ width: '23%' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Cold Chain Assets & Temp</span>
                    {renderSortIcon('tempDisplay')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('observationActionDisplay')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ width: '13%' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Observation / Action</span>
                    {renderSortIcon('observationActionDisplay')}
                  </div>
                </th>
                <th className="py-3 px-2 text-center text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider" style={{ width: '6%' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, idx) => (
                  <tr
                    key={row.visitId || idx}
                    onClick={() => {
                      if (onRowClick) onRowClick(row.raw || row);
                      else setSelectedModalRow(row);
                    }}
                    className="border-b border-[var(--border-soft)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer group"
                    style={{ height: '52px' }}
                  >
                    {/* Visit & Supervisor */}
                    <td className="py-2.5 px-3 text-left align-middle overflow-hidden">
                      <div className="font-extrabold text-[12px] text-slate-900 dark:text-white leading-tight truncate">
                        {row.supervisor}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                        <span className="font-mono text-[10.5px] font-semibold text-slate-600 dark:text-slate-400">{row.date}</span>
                        <span className="opacity-30">•</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[9.5px] border border-slate-200 dark:border-slate-700">
                          {row.routeCode}
                        </span>
                      </div>
                    </td>

                    {/* Outlet / Customer */}
                    <td className="py-2.5 px-3 text-left align-middle overflow-hidden">
                      <div className="font-black text-[12.5px] text-slate-900 dark:text-white leading-tight truncate" title={row.outletName}>
                        {row.outletName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[10.5px]">
                          {row.outletCode}
                        </span>
                        <span className="opacity-30">•</span>
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {row.channel || 'TT'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Class {row.classification || 'C'}
                        </span>
                      </div>
                    </td>

                    {/* Status & SKUs */}
                    <td className="py-2.5 px-3 text-left align-middle overflow-hidden">
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.visitType === 'No Visit'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${row.visitType === 'No Visit' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {row.visitType === 'No Visit' ? 'No Visit' : 'Visited'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[9.5px] uppercase font-bold text-slate-500">SKUs:</span>
                        <span
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.2 rounded ${
                            row.totalPskuCount > 0 && row.pskuAvailableCount === row.totalPskuCount
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : row.pskuAvailableCount > 0
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          }`}
                        >
                          {row.pskuRatioDisplay}
                        </span>
                      </div>
                    </td>

                    {/* Cold Chain Assets & Temp */}
                    <td className="py-2.5 px-3 text-left align-middle overflow-hidden">
                      <div className="flex flex-wrap gap-1 items-center">
                        {row.chillerModels.map((m, i) => (
                          <span key={`c-${i}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50/80 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800" title={`Chiller: ${m}`}>
                            <span>🧊</span>
                            <span className="truncate max-w-[85px]">{m}</span>
                          </span>
                        ))}
                        {row.freezerModels.map((m, i) => (
                          <span key={`f-${i}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-50/80 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800" title={`Freezer: ${m}`}>
                            <span>❄️</span>
                            <span className="truncate max-w-[85px]">{m}</span>
                          </span>
                        ))}
                        {row.chillerModels.length === 0 && row.freezerModels.length === 0 && (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {row.tempDisplay !== '—' && (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                            row.tempOk
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          }`}>
                            <span>{row.tempOk ? '✓' : '⚠'}</span>
                            <span>{row.tempDisplay}</span>
                          </span>
                        )}
                        {row.assetStatuses.slice(0, 1).map((st, i) => (
                          <span key={i} className="text-[9.5px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-1 py-0.2 rounded border border-slate-200/50 dark:border-slate-700/50">
                            {st.label}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Observation & Action */}
                    <td className="py-2.5 px-3 text-left align-middle overflow-hidden">
                      {row.observationActionDisplay !== '—' ? (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2 leading-snug" title={row.observationActionDisplay}>
                          {row.observationActionDisplay}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No notes</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-2 text-center align-middle">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRowClick) onRowClick(row.raw || row);
                          else setSelectedModalRow(row);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/50 shadow-2xs transition-all cursor-pointer"
                        title="View complete audit details"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--text-secondary)]">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <p className="font-semibold text-[13px] text-[var(--text-primary)]">No matching visit records</p>
                      <p className="text-[12px] text-[var(--text-muted)]">
                        {searchTerm
                          ? `No results found for "${searchTerm}". Try adjusting your search query.`
                          : 'No visits found for the selected dashboard filter criteria.'}
                      </p>
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="mt-2 text-[11px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" /> Clear search query
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          /* =========================================================================
             WIDE GRID (ALL 15 DISTINCT COLUMNS WITH HORIZONTAL SCROLL)
             ========================================================================= */
          <table className="w-full border-collapse" style={{ minWidth: '1240px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                <th
                  onClick={() => handleSort('date')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ width: '105px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Date</span>
                    {renderSortIcon('date')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('supervisor')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ minWidth: '125px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Supervisor</span>
                    {renderSortIcon('supervisor')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('routeCode')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ width: '105px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Route Code</span>
                    {renderSortIcon('routeCode')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('outletCode')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ width: '110px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Outlet Code</span>
                    {renderSortIcon('outletCode')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('outletName')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ minWidth: '175px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Outlet Name</span>
                    {renderSortIcon('outletName')}
                  </div>
                </th>
                <th className="py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider" style={{ width: '85px' }}>
                  Channel
                </th>
                <th className="py-3 px-3 text-center text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider" style={{ width: '70px' }}>
                  Class
                </th>
                <th className="py-3 px-3 text-center text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider" style={{ width: '100px' }}>
                  Status
                </th>
                <th
                  onClick={() => handleSort('pskuAvailableCount')}
                  className="cursor-pointer select-none py-3 px-3 text-center text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ minWidth: '140px' }}
                  title="Total number of Power SKUs found available out of total SKUs at the outlet"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Power SKUs (Avail / Total)</span>
                    {renderSortIcon('pskuAvailableCount')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('chillerModelDisplay')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ minWidth: '135px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Chiller Model</span>
                    {renderSortIcon('chillerModelDisplay')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('freezerModelDisplay')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ minWidth: '135px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Freezer Model</span>
                    {renderSortIcon('freezerModelDisplay')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('tempDisplay')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ minWidth: '110px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Temp</span>
                    {renderSortIcon('tempDisplay')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('assetStatusDisplay')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ minWidth: '135px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Asset Status</span>
                    {renderSortIcon('assetStatusDisplay')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('observationActionDisplay')}
                  className="cursor-pointer select-none py-3 px-3 text-left text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  style={{ minWidth: '185px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Observation & Action</span>
                    {renderSortIcon('observationActionDisplay')}
                  </div>
                </th>
                <th className="py-3 px-3 text-right text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider" style={{ width: '80px' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, idx) => (
                  <tr
                    key={row.visitId || idx}
                    onClick={() => {
                      if (onRowClick) onRowClick(row.raw || row);
                      else setSelectedModalRow(row);
                    }}
                    className={`border-b border-[var(--border-soft)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer`}
                    style={{ height: '44px' }}
                  >
                    {/* Date */}
                    <td className="py-2.5 px-3 text-[12px] font-mono font-bold whitespace-nowrap text-slate-900 dark:text-slate-100">
                      {row.date}
                    </td>

                    {/* Supervisor */}
                    <td className="py-2.5 px-3 text-[12px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {row.supervisor}
                    </td>

                    {/* Route Code */}
                    <td className="py-2.5 px-3 text-[12px] font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {row.routeCode}
                    </td>

                    {/* Outlet Code */}
                    <td className="py-2.5 px-3 text-[12px] font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      {row.outletCode}
                    </td>

                    {/* Outlet Name */}
                    <td className="py-2.5 px-3 text-[12px] font-extrabold text-slate-900 dark:text-white max-w-xs truncate" title={row.outletName}>
                      {row.outletName}
                    </td>

                    {/* Channel */}
                    <td className="py-2.5 px-3 text-[11.5px] font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {row.channel || 'TT'}
                      </span>
                    </td>

                    {/* Class */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {row.classification || 'C'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        row.visitType === 'No Visit'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.visitType === 'No Visit' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {row.visitType === 'No Visit' ? 'No Visit' : 'Visited'}
                      </span>
                    </td>

                    {/* Power SKUs */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center gap-1 min-w-[58px] h-7 px-2.5 text-[12px] font-mono font-bold rounded-lg shadow-sm border transition-all ${
                          row.totalPskuCount > 0 && row.pskuAvailableCount === row.totalPskuCount
                            ? 'bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : row.pskuAvailableCount > 0
                            ? 'bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                            : row.totalPskuCount > 0
                            ? 'bg-rose-500/15 dark:bg-rose-500/25 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                        title={`Power SKUs: ${row.pskuAvailableCount} available out of ${row.totalPskuCount} total audited at this outlet`}
                      >
                        <span className="font-extrabold">{row.pskuAvailableCount}</span>
                        <span className="opacity-40 font-normal">/</span>
                        <span className="opacity-75 font-semibold">{row.totalPskuCount}</span>
                      </span>
                    </td>

                    {/* Chiller Model */}
                    <td className="py-2 px-3 text-[12px] text-[var(--text-secondary)] whitespace-nowrap">
                      {row.chillerModels.length > 0 ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {row.chillerModels.map((m, mIdx) => (
                            <span
                              key={mIdx}
                              className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800 text-blue-900 dark:text-blue-300"
                              title={`Chiller #${mIdx + 1}: ${m}`}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Freezer Model */}
                    <td className="py-2 px-3 text-[12px] text-[var(--text-secondary)] whitespace-nowrap">
                      {row.freezerModels.length > 0 ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {row.freezerModels.map((m, mIdx) => (
                            <span
                              key={mIdx}
                              className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-800 text-cyan-900 dark:text-cyan-300"
                              title={`Freezer #${mIdx + 1}: ${m}`}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Temp */}
                    <td className="py-2 px-3 text-[12px] whitespace-nowrap">
                      {row.tempDisplay !== '—' ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            row.tempOk
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          }`}
                          title={row.tempOk ? 'Temperature compliant' : 'Temperature breach detected'}
                        >
                          {row.tempOk ? '✓' : '⚠'} {row.tempDisplay}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Asset Status */}
                    <td className="py-2 px-3 text-[12px] whitespace-nowrap">
                      {row.assetStatuses.length > 0 ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {row.assetStatuses.map((stItem, stIdx) => {
                            const lowerSt = stItem.status.toLowerCase();
                            const isWorking = lowerSt === 'working';
                            const isNotWorking = lowerSt.includes('not working') || lowerSt.includes('breach');
                            const isService = lowerSt.includes('service');

                            return (
                              <span
                                key={stIdx}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                  isWorking
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                    : isNotWorking
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                    : isService
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                                title={stItem.label}
                              >
                                {isWorking ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                ) : isNotWorking ? (
                                  <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                                ) : isService ? (
                                  <Wrench className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                ) : null}
                                {stItem.label}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Observation & Action */}
                    <td className="py-2 px-3 text-[12px] max-w-xs" title={row.observationActionDisplay}>
                      {row.observationActionDisplay !== '—' ? (
                        <div className="text-[12px] text-[var(--text-primary)] font-medium line-clamp-2 leading-tight">
                          {row.observationActionDisplay}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRowClick) onRowClick(row.raw || row);
                          else setSelectedModalRow(row);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-2xs transition-all cursor-pointer"
                        title="View visit details"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-[var(--text-secondary)]">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <p className="font-semibold text-[13px] text-[var(--text-primary)]">No matching visit records</p>
                      <p className="text-[12px] text-[var(--text-muted)]">
                        {searchTerm
                          ? `No results found for "${searchTerm}". Try adjusting your search query.`
                          : 'No visits found for the selected dashboard filter criteria.'}
                      </p>
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="mt-2 text-[11px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" /> Clear search query
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {sortedData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--border-soft)] text-[12px] text-[var(--text-secondary)]">
          <div>
            Showing <span className="font-semibold text-[var(--text-primary)]">{startIndex + 1}</span> to{' '}
            <span className="font-semibold text-[var(--text-primary)]">
              {Math.min(startIndex + pageSize, sortedData.length)}
            </span>{' '}
            of <span className="font-semibold text-[var(--text-primary)]">{sortedData.length}</span> entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPageClamped <= 1}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2 font-mono text-[11px] font-semibold text-[var(--text-primary)]">
              Page {currentPageClamped} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPageClamped >= totalPages}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Inspection Modal */}
      {selectedModalRow && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  VISIT AUDIT DETAILS
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {selectedModalRow.outletName}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Code: {selectedModalRow.outletCode}</span>
                  <span>•</span>
                  <span>Route: {selectedModalRow.routeCode}</span>
                  <span>•</span>
                  <span>{selectedModalRow.date}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedModalRow(null)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Supervisor</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedModalRow.supervisor}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Status</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5 block">
                    {selectedModalRow.visitType === 'No Visit' ? 'No Visit' : 'Visited'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Power SKUs</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                    {selectedModalRow.pskuRatioDisplay}
                  </span>
                </div>
              </div>

              {/* Cold Chain & Assets */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  Cold Chain Assets & Compliance
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Chiller Models:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedModalRow.chillerModelDisplay}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Freezer Models:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedModalRow.freezerModelDisplay}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Temperature:</span>
                    <span className={`font-mono font-bold ${selectedModalRow.tempOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {selectedModalRow.tempDisplay} {selectedModalRow.tempDisplay !== '—' && (selectedModalRow.tempOk ? '(Compliant)' : '(Breach)')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Asset Status:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedModalRow.assetStatusDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* Observation & Action */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  Observation & Action
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedModalRow.observationActionDisplay}
                </p>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedModalRow(null)}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
