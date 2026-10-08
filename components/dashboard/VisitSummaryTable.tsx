'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { exportToExcel, ExcelColumn } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';

export interface SummaryVisitRow {
  date: string;
  supervisor: string;
  routeCode: string;
  outletCode: string;
  outletName: string;
  pskuAvailableCount: number;
  totalPskuCount: number;
  pskuRatioDisplay: string;
  chillerModel: string;
  freezerModel: string;
  tempDisplay: string;
  tempOk: boolean;
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
  | 'chillerModel'
  | 'freezerModel'
  | 'tempDisplay';

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

export default function VisitSummaryTable({
  rows = [],
  reportRows,
  title = 'Visit Execution & Asset Summary',
  subtitle = 'Outlet-level audit details, SKU availability counts, and cold chain asset models',
  onRowClick,
  itemsPerPageDefault = 20,
}: VisitSummaryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(itemsPerPageDefault);

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
      const outletCode = (
        r.outletCode ||
        r.customerCode ||
        (r.cust_rt_id ? r.cust_rt_id.split('|')[0] : '') ||
        '—'
      ).trim();
      const outletName = (r.outletName || r.cust || r.customerName || '—').trim();

      // Total count of PSKU available out of total SKUs at outlet
      const pskuAvailableCount =
        typeof r.pskuAvailableCount === 'number'
          ? r.pskuAvailableCount
          : (pskuTotalsLookup.availMap.get(vId) ?? (r.psku === 'A' ? 1 : 0));

      let totalPskuCount =
        typeof r.totalPskuCount === 'number' && r.totalPskuCount > 0
          ? r.totalPskuCount
          : (pskuTotalsLookup.totalMap.get(vId) ?? 0);

      if (totalPskuCount < pskuAvailableCount) {
        totalPskuCount = pskuAvailableCount;
      }

      const pskuRatioDisplay = `${pskuAvailableCount} / ${totalPskuCount}`;

      // Chiller & Freezer model resolution
      let chillerModel = r.chillerModel || '—';
      let freezerModel = r.freezerModel || '—';

      if (chillerModel === '—' && Array.isArray(r.allAssets)) {
        const ca = r.allAssets.find((a: any) => (a.assetType || '').toLowerCase() === 'chiller');
        if (ca) chillerModel = ca.sizeModel || 'Standard';
      }
      if (chillerModel === '—' && (r.atype || r.assetType || '').toLowerCase() === 'chiller') {
        chillerModel = r.sizeModel || 'Standard';
      }

      if (freezerModel === '—' && Array.isArray(r.allAssets)) {
        const fa = r.allAssets.find((a: any) => (a.assetType || '').toLowerCase() === 'freezer');
        if (fa) freezerModel = fa.sizeModel || 'Standard';
      }
      if (freezerModel === '—' && (r.atype || r.assetType || '').toLowerCase() === 'freezer') {
        freezerModel = r.sizeModel || 'Standard';
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

      return {
        date: formattedDate,
        supervisor,
        routeCode,
        outletCode,
        outletName,
        pskuAvailableCount,
        totalPskuCount,
        pskuRatioDisplay,
        chillerModel,
        freezerModel,
        tempDisplay,
        tempOk,
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
        item.chillerModel.toLowerCase().includes(term) ||
        item.freezerModel.toLowerCase().includes(term) ||
        item.tempDisplay.toLowerCase().includes(term) ||
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

  // Export to Excel with columns strictly formatted as required
  const handleExportExcel = () => {
    const columns: ExcelColumn<SummaryVisitRow>[] = [
      { header: 'Date', key: 'date' },
      { header: 'Supervisor', key: 'supervisor' },
      { header: 'Route Code', key: 'routeCode' },
      { header: 'outlet code', key: 'outletCode' },
      { header: 'outlet name', key: 'outletName' },
      { header: 'Power SKUs (Available / Total)', key: 'pskuRatioDisplay' },
      { header: 'Chiller Model', key: 'chillerModel' },
      { header: 'Freezer Model', key: 'freezerModel' },
      { header: 'Temp', key: 'tempDisplay' },
    ];

    exportToExcel({
      filename: `Visit_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Visit Summary',
      columns,
      data: sortedData,
    });
  };

  return (
    <div className="panel tbl" style={{ marginBottom: '16px' }}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-soft)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--text-primary)] m-0">{title}</h3>
            <span className="badge font-mono text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]">
              {filteredData.length} {filteredData.length === 1 ? 'visit' : 'visits'}
            </span>
          </div>
          <div className="psub text-[12px] text-[var(--text-secondary)] mt-0.5">{subtitle}</div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search visits, outlets..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 pl-8 pr-3 text-[12px] rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all w-44 md:w-56"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Page Size Selector */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-8 px-2 text-[11px] rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] font-medium focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>

          {/* Export to Excel */}
          <ExportButton
            onClick={handleExportExcel}
            label="Export Excel"
            variant="compact"
            title="Export summary table to Excel (.xlsx)"
          />
        </div>
      </div>

      {/* Interactive Table */}
      <div className="tbl-wrap" style={{ overflowX: 'auto', maxHeight: '520px' }}>
        <table className="w-full border-collapse" style={{ minWidth: '950px' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th
                onClick={() => handleSort('date')}
                className="cursor-pointer select-none py-2.5 px-3 text-left text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                style={{ width: '105px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Date</span>
                  {renderSortIcon('date')}
                </div>
              </th>
              <th
                onClick={() => handleSort('supervisor')}
                className="cursor-pointer select-none py-2.5 px-3 text-left text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                style={{ minWidth: '130px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Supervisor</span>
                  {renderSortIcon('supervisor')}
                </div>
              </th>
              <th
                onClick={() => handleSort('routeCode')}
                className="cursor-pointer select-none py-2.5 px-3 text-left text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                style={{ width: '105px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Route Code</span>
                  {renderSortIcon('routeCode')}
                </div>
              </th>
              <th
                onClick={() => handleSort('outletCode')}
                className="cursor-pointer select-none py-2.5 px-3 text-left text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                style={{ width: '110px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Outlet Code</span>
                  {renderSortIcon('outletCode')}
                </div>
              </th>
              <th
                onClick={() => handleSort('outletName')}
                className="cursor-pointer select-none py-2.5 px-3 text-left text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                style={{ minWidth: '180px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Outlet Name</span>
                  {renderSortIcon('outletName')}
                </div>
              </th>
              <th
                onClick={() => handleSort('pskuAvailableCount')}
                className="cursor-pointer select-none py-2.5 px-3 text-center text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                style={{ minWidth: '140px' }}
                title="Total number of Power SKUs found available out of total SKUs at the outlet"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Power SKUs (Avail / Total)</span>
                  {renderSortIcon('pskuAvailableCount')}
                </div>
              </th>
              <th
                onClick={() => handleSort('chillerModel')}
                className="cursor-pointer select-none py-2.5 px-3 text-left text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                style={{ minWidth: '120px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Chiller Model</span>
                  {renderSortIcon('chillerModel')}
                </div>
              </th>
              <th
                onClick={() => handleSort('freezerModel')}
                className="cursor-pointer select-none py-2.5 px-3 text-left text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                style={{ minWidth: '120px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Freezer Model</span>
                  {renderSortIcon('freezerModel')}
                </div>
              </th>
              <th
                onClick={() => handleSort('tempDisplay')}
                className="cursor-pointer select-none py-2.5 px-3 text-left text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                style={{ minWidth: '110px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>Temp</span>
                  {renderSortIcon('tempDisplay')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => (
                <tr
                  key={row.visitId || idx}
                  onClick={() => onRowClick && onRowClick(row.raw || row)}
                  className={`border-b border-[var(--border-soft)] hover:bg-[var(--surface-2)] transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  style={{ height: '40px' }}
                >
                  {/* Date */}
                  <td className="py-2 px-3 text-[12px] font-mono whitespace-nowrap text-[var(--text-secondary)]">
                    {row.date}
                  </td>

                  {/* Supervisor */}
                  <td className="py-2 px-3 text-[12px] font-semibold text-[var(--text-primary)] whitespace-nowrap">
                    {row.supervisor}
                  </td>

                  {/* Route Code */}
                  <td className="py-2 px-3 text-[12px] font-mono text-[var(--text-secondary)] whitespace-nowrap">
                    {row.routeCode}
                  </td>

                  {/* Outlet Code */}
                  <td className="py-2 px-3 text-[12px] font-mono font-medium text-[var(--accent)] whitespace-nowrap">
                    {row.outletCode}
                  </td>

                  {/* Outlet Name */}
                  <td className="py-2 px-3 text-[12px] font-bold text-[var(--text-primary)] max-w-xs truncate" title={row.outletName}>
                    {row.outletName}
                  </td>

                  {/* Total number of Power SKUs found available out of total SKUs at the outlet (highlighted badge) */}
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
                    {row.chillerModel !== '—' ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]">
                        {row.chillerModel}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>

                  {/* Freezer Model */}
                  <td className="py-2 px-3 text-[12px] text-[var(--text-secondary)] whitespace-nowrap">
                    {row.freezerModel !== '—' ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]">
                        {row.freezerModel}
                      </span>
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
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[var(--text-secondary)]">
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
    </div>
  );
}
