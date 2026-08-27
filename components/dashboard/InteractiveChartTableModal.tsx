'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';

interface VisitData {
  visitId: string;
  sup: string;
  mgr: string;
  ch: string;
  rt: string;
  cust: string;
  code: string;
  gr: string;
  week: number;
  atype: string;
  temp: number;
  ok: boolean;
  action: string;
  createdAt?: string;
  [key: string]: any;
}

interface InteractiveChartTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: VisitData[];
}

const GCOL: Record<string, string> = {
  A: '#0b7a4c',
  B: '#2b9c62',
  C: '#c8801a',
  D: '#d9663a',
  E: '#c0392b',
};

export default function InteractiveChartTableModal({
  isOpen,
  onClose,
  title,
  data,
}: InteractiveChartTableModalProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page, search and sorting when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setPage(1);
      setSortField('createdAt');
      setSortOrder('desc');
    }
  }, [isOpen, data]);

  // Search Filter
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const s = search.toLowerCase();
    return data.filter(
      (r) =>
        (r.sup || '').toLowerCase().includes(s) ||
        (r.mgr || '').toLowerCase().includes(s) ||
        (r.cust || '').toLowerCase().includes(s) ||
        (r.rt || '').toLowerCase().includes(s) ||
        (r.ch || '').toLowerCase().includes(s) ||
        (r.atype || '').toLowerCase().includes(s) ||
        (r.action || '').toLowerCase().includes(s) ||
        (r.visitId || '').toLowerCase().includes(s) ||
        (r.code || '').toLowerCase().includes(s)
    );
  }, [data, search]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'createdAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  if (!isOpen) return null;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 inline-block ml-1 opacity-40" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3 w-3 inline-block ml-1 text-[var(--accent)]" />
    ) : (
      <ArrowDown className="h-3 w-3 inline-block ml-1 text-[var(--accent)]" />
    );
  };

  const formatVisitDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleExportModalData = () => {
    exportToExcel({
      filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_records`,
      sheetName: 'Visit Drilldown',
      title: title,
      filterSummary: search ? `Search query: "${search}"` : undefined,
      columns: [
        { header: 'Date', key: 'createdAt', formatter: (val) => val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Manager', key: 'mgr' },
        { header: 'Supervisor', key: 'sup' },
        { header: 'Outlet', key: 'cust' },
        { header: 'Shop Code', key: 'code' },
        { header: 'Route', key: 'rt' },
        { header: 'Channel', key: 'ch' },
        { header: 'Class', key: 'gr' },
        { header: 'Asset', key: 'atype' },
        { header: 'Temp (°C)', key: 'temp', formatter: (val) => val !== undefined && val !== null ? `${val}°C` : '—' },
        { header: 'Status', key: 'ok', formatter: (val) => val ? 'OK' : 'Breach' },
        { header: 'Action Required', key: 'action', formatter: (val) => val || 'None' },
      ],
      data: sortedData,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div 
        className="relative w-full md:max-w-5xl flex flex-col bg-[var(--surface)] md:rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{ 
          height: '85vh', 
          maxHeight: '85vh', 
          border: '1px solid var(--border)',
          color: 'var(--text-primary)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--surface)] flex-shrink-0">
          <div>
            <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{title}</h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Drill-down visit records ({sortedData.length} matches)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton onClick={handleExportModalData} label="Export to Excel" variant="compact" />
            <button 
              onClick={onClose} 
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Toolbar (Search & Page size selection) */}
        <div className="px-5 py-3 border-b border-[var(--border-soft)] bg-[var(--surface-2)] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
            </span>
            <input
              type="text"
              placeholder="Search supervisor, customer, route..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="form-input pl-9 w-full text-xs font-semibold bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2 px-3 focus:outline-none focus:border-[var(--accent)]"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-semibold text-[var(--text-muted)]">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] cursor-pointer"
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} items
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Area (Desktop Table vs Mobile List Cards) */}
        <div className="flex-grow overflow-y-auto min-h-0 bg-[var(--bg)]">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto h-full">
            <table className="w-full text-[12px] border-collapse">
              <thead className="sticky top-0 bg-[var(--surface)] z-10">
                <tr className="border-b border-[var(--border-soft)] text-[var(--text-muted)]">
                  <th 
                    onClick={() => handleSort('createdAt')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Date {renderSortIcon('createdAt')}
                  </th>
                  <th 
                    onClick={() => handleSort('visitId')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Visit ID {renderSortIcon('visitId')}
                  </th>
                  <th 
                    onClick={() => handleSort('mgr')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Manager {renderSortIcon('mgr')}
                  </th>
                  <th 
                    onClick={() => handleSort('sup')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Supervisor {renderSortIcon('sup')}
                  </th>
                  <th 
                    onClick={() => handleSort('cust')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Outlet {renderSortIcon('cust')}
                  </th>
                  <th 
                    onClick={() => handleSort('rt')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Route {renderSortIcon('rt')}
                  </th>
                  <th 
                    onClick={() => handleSort('ch')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Ch {renderSortIcon('ch')}
                  </th>
                  <th 
                    onClick={() => handleSort('gr')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Class {renderSortIcon('gr')}
                  </th>
                  <th 
                    onClick={() => handleSort('atype')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Asset {renderSortIcon('atype')}
                  </th>
                  <th 
                    onClick={() => handleSort('temp')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Temp {renderSortIcon('temp')}
                  </th>
                  <th 
                    onClick={() => handleSort('ok')}
                    className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    Status {renderSortIcon('ok')}
                  </th>
                  <th className="px-5 py-3 text-left font-bold text-[10.5px] uppercase tracking-wider">
                    Action Required
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {paginatedData.length > 0 ? (
                  paginatedData.map((r) => (
                    <tr key={r.visitId} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-5 py-3 text-[12px] whitespace-nowrap text-[var(--text-muted)]">
                        {formatVisitDate(r.createdAt)}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] font-bold text-[var(--accent)]">
                        {r.visitId}
                      </td>
                      <td className="px-5 py-3 font-medium">{r.mgr}</td>
                      <td className="px-5 py-3 font-medium">{r.sup}</td>
                      <td className="px-5 py-3 font-bold text-[var(--text-primary)]">{r.cust}</td>
                      <td className="px-5 py-3 font-mono text-[11px] text-[var(--text-secondary)]">{r.rt}</td>
                      <td className="px-5 py-3 text-[11px] font-bold">{r.ch}</td>
                      <td className="px-5 py-3">
                        <span 
                          className="inline-grid place-items-center w-6 h-6 rounded-md text-white font-bold text-[10px]"
                          style={{ background: GCOL[r.gr] || '#9aa9b4' }}
                        >
                          {r.gr}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--text-muted)]">{r.atype}</td>
                      <td className="px-5 py-3 font-bold">{r.temp}°C</td>
                      <td className="px-5 py-3">
                        <span className={`pill ${r.ok ? 'g' : 'r'}`}>
                          {r.ok ? 'OK' : 'Breach'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--text-muted)] truncate max-w-xs">{r.action || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="px-5 py-12 text-center text-[13px] text-[var(--text-muted)]">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards List View */}
          <div className="md:hidden divide-y divide-[var(--border-soft)] h-full overflow-y-auto">
            {paginatedData.length > 0 ? (
              paginatedData.map((r) => (
                <div key={r.visitId} className="p-4 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[var(--accent)]">{r.visitId}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {formatVisitDate(r.createdAt)}
                      </span>
                    </div>
                    <span className={`badge ${r.ok ? 'badge-success' : 'badge-danger'} text-[10px]`}>
                      {r.temp}°C {r.ok ? '✓' : '⚠'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-[13px] font-bold text-[var(--text-primary)] truncate">{r.cust}</h4>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[11.5px] text-[var(--text-muted)] font-medium">
                      <div><span className="font-semibold text-[10px] uppercase block tracking-wider text-[var(--text-muted)]">Route</span> <span className="font-mono text-[var(--text-primary)]">{r.rt}</span></div>
                      <div><span className="font-semibold text-[10px] uppercase block tracking-wider text-[var(--text-muted)]">Channel</span> <span className="text-[var(--text-primary)]">{r.ch}</span></div>
                      <div><span className="font-semibold text-[10px] uppercase block tracking-wider text-[var(--text-muted)]">Supervisor</span> <span className="text-[var(--text-primary)]">{r.sup}</span></div>
                      <div><span className="font-semibold text-[10px] uppercase block tracking-wider text-[var(--text-muted)]">Manager</span> <span className="text-[var(--text-primary)]">{r.mgr}</span></div>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-[var(--border-soft)] flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">Class:</span>
                      <span 
                        className="inline-grid place-items-center w-4 h-4 rounded text-white font-bold text-[9px]"
                        style={{ background: GCOL[r.gr] || '#9aa9b4' }}
                      >
                        {r.gr}
                      </span>
                    </div>
                    <div className="truncate max-w-[200px]"><span className="font-semibold">Action:</span> {r.action || 'None'}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-[13px] text-[var(--text-muted)]">
                No matching records found.
              </div>
            )}
          </div>
        </div>

        {/* Footer with Pagination */}
        <div className="px-5 py-4 border-t border-[var(--border-soft)] bg-[var(--surface)] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="text-[11.5px] text-[var(--text-muted)] font-semibold">
            Showing {sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
          </div>

          <div className="flex items-center gap-1.5 font-semibold">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Previous</span>
            </button>
            
            <div className="text-xs px-3 py-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-primary)]">
              Page {currentPage} of {totalPages}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="hidden sm:inline text-xs">Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
