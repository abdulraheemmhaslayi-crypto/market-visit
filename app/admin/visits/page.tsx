'use client';

import React, { useState, useEffect } from 'react';
import { getVisitsAction, deleteVisitAction, getVisitDetailsAction } from '@/actions/visit-actions';
import { useToast } from '@/components/ui/toast';
import { ConfirmationDialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Trash2, Eye, MapPin, Calendar, X,
  AlertTriangle, FileText, Thermometer,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  CheckCircle2, Clock, Filter,
} from 'lucide-react';
import { Visit, VisitPhoto, NPDResponse, VisitAsset, VisitPowerSkuResult } from '@/types';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';

// ─── Shared table helpers ────────────────────────────────────
function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-5 py-3 text-left ${right ? 'text-right' : ''}`}
      style={{
        fontSize: '10px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--text-muted)', whiteSpace: 'nowrap',
        background: 'var(--surface-2)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {children}
    </th>
  );
}

function PageHeader({ title, sub, count }: { title: string; sub: string; count?: number }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {count !== undefined && (
          <span className="badge badge-accent">{count}</span>
        )}
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</p>
    </div>
  );
}

function Pagination({ current, total, filtered, onChange }: {
  current: number; total: number; filtered: number; onChange: (p: number) => void;
}) {
  if (total <= 1) return null;
  const btn = (onClick: () => void, disabled: boolean, children: React.ReactNode) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-ghost"
      style={{ height: '32px', padding: '0 10px', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  );
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        Page {current} of {total} · {filtered} records
      </span>
      <div className="flex items-center gap-1">
        {btn(() => onChange(1), current === 1, <ChevronsLeft className="h-3.5 w-3.5" />)}
        {btn(() => onChange(current - 1), current === 1, <ChevronLeft className="h-3.5 w-3.5" />)}
        {btn(() => onChange(current + 1), current === total, <ChevronRight className="h-3.5 w-3.5" />)}
        {btn(() => onChange(total), current === total, <ChevronsRight className="h-3.5 w-3.5" />)}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function VisitLogsPage() {
  const { showToast } = useToast();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewData, setReviewData] = useState<{
    visit: Visit;
    assets: VisitAsset[];
    photos: VisitPhoto[];
    powerSkuResults?: VisitPowerSkuResult[];
    npdResponses: NPDResponse[];
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });

  const fetchVisits = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsSyncing(true);
    try {
      const data = await getVisitsAction();
      setVisits((data as Visit[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLastUpdated(new Date());
    } catch (err: any) {
      showToast(err.message || 'Failed to load visits.', 'error');
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const getVisitDisplay = (v: Visit) => {
    const isNoVisit = v.visit_type === 'No Visit';
    return {
      isNoVisit,
      typeLabel: isNoVisit ? 'No Visit' : 'Visit',
      typeClass: isNoVisit ? 'badge-warning' : 'badge-success',
      routeLabel: isNoVisit ? '—' : (v.routeCode || '—'),
      customerLabel: isNoVisit ? 'No outlet selected' : (v.customerCode || '—'),
      tempLabel: isNoVisit ? 'N/A' : `${v.temperature ?? 0}°C ${v.tempInRange ? '✓' : '⚠'}`,
      tempClass: isNoVisit ? 'badge-info' : (v.tempInRange ? 'badge-success' : 'badge-danger'),
    };
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (active) await fetchVisits(false);
    };
    load();

    const interval = setInterval(async () => {
      if (active) await fetchVisits(true);
    }, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleOpenReview = async (id: string) => {
    setReviewId(id);
    setDetailLoading(true);
    try {
      setReviewData(await getVisitDetailsAction(id) as any);
    } catch (error: any) {
      showToast(error.message || 'Failed to load visit details.', 'error');
      setReviewId(null);
    } finally { setDetailLoading(false); }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteVisitAction(deleteDialog.id);
      showToast('Visit deleted.', 'success');
      setDeleteDialog({ open: false, id: '' });
      if (reviewId === deleteDialog.id) { setReviewId(null); setReviewData(null); }
      fetchVisits();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete.', 'error');
    }
  };

  const filtered = visits.filter((v) => {
    const q = search.toLowerCase();
    return (
      (v.visitId.toLowerCase().includes(q) || v.supervisorId.toLowerCase().includes(q) ||
        v.routeCode.toLowerCase().includes(q) || v.customerCode.toLowerCase().includes(q) ||
        (v.visit_type || '').toLowerCase().includes(q) ||
        (v.reason_category || '').toLowerCase().includes(q) ||
        (v.reason || '').toLowerCase().includes(q)) &&
      (statusFilter === 'All' || v.status === statusFilter)
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  const handleExportVisits = () => {
    exportToExcel({
      filename: `visit_logs_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Visit Logs',
      title: 'Field Visit Audit Logs Report',
      filterSummary: search ? `Search: "${search}" | Status: ${statusFilter}` : `Status: ${statusFilter}`,
      columns: [
        { header: 'Visit Date', key: 'visit_datetime', formatter: (val: any, row: any) => val ? new Date(val).toLocaleString() : (row.createdAt ? new Date(row.createdAt).toLocaleString() : '—') },
        { header: 'Visit ID', key: 'visitId' },
        { header: 'Supervisor ID', key: 'supervisorId' },
        { header: 'Customer / Shop Code', key: 'customerCode' },
        { header: 'Route Code', key: 'routeCode' },
        { header: 'Visit Type', key: 'visit_type', formatter: (val: any) => val || 'Standard Visit' },
        { header: 'Reason / Category', key: 'reason_category', formatter: (val: any, row: any) => val || row.reason || '—' },
        { header: 'Latitude', key: 'latitude' },
        { header: 'Longitude', key: 'longitude' },
        { header: 'Status', key: 'status' },
      ],
      data: filtered,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Visit Logs" sub="Browse and inspect supervisor field visit audit entries." count={filtered.length} />
        <ExportButton onClick={handleExportVisits} label="Export Visit Logs" variant="default" />
      </div>

      {/* Toolbar */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by ID, supervisor, route…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9"
          />
        </div>

        {/* Live sync indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-solid border-[var(--border-soft)] bg-[var(--surface-2)] text-[11px] font-bold font-mono text-[var(--text-muted)] h-9">
          <span 
            className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--success)] animate-pulse'}`} 
            style={{
              boxShadow: isSyncing ? '0 0 8px var(--accent)' : '0 0 8px var(--success)'
            }}
          />
          <span>{isSyncing ? 'SYNCING...' : 'LIVE SYNC ACTIVE'}</span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span>UPDATED {lastUpdated.toLocaleTimeString()}</span>
        </div>

        {/* Status pills */}
        <div
          className="flex items-center gap-1 p-1 rounded-lg flex-shrink-0"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          {['All', 'Draft', 'Submitted'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 h-7 rounded-md text-[12px] font-semibold transition-all cursor-pointer"
              style={{
                background: statusFilter === s ? 'var(--surface)' : 'transparent',
                color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: statusFilter === s ? 'var(--shadow-card)' : 'none',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <TH>Visit ID</TH>
                <TH>Supervisor</TH>
                <TH>Route</TH>
                <TH>Type</TH>
                <TH>Customer</TH>
                <TH>Temperature</TH>
                <TH>Status</TH>
                <TH>Date</TH>
                <TH right>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    No visit records found.
                  </td>
                </tr>
              ) : (
                paginated.map((v) => {
                  const display = getVisitDisplay(v);
                  return (
                    <tr
                      key={v.visitId}
                      style={{ borderBottom: '1px solid var(--border-soft)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      className="transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[12px] font-medium" style={{ color: 'var(--accent)' }}>{v.visitId}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{v.supervisorId}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{display.routeLabel}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <span className={`badge ${display.typeClass}`}>{display.typeLabel}</span>
                          {display.isNoVisit && v.reason_category && (
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{v.reason_category}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{display.customerLabel}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {v.status === 'Submitted' ? (
                          <span className={`badge ${display.tempClass}`}>
                            {display.tempLabel}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${v.status === 'Submitted' ? 'badge-success' : 'badge-warning'}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          {new Date(v.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenReview(v.visitId)}
                            className="btn-ghost"
                            style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteDialog({ open: true, id: v.visitId })}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              height: '30px', padding: '0 10px',
                              background: 'var(--danger-light)', color: 'var(--danger)',
                              border: '1px solid rgba(220,38,38,0.15)', borderRadius: '6px',
                              fontSize: '12px', cursor: 'pointer',
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination current={currentPage} total={totalPages} filtered={filtered.length} onChange={setCurrentPage} />
      </div>

      {/* ── Detail Modal ──────────────────────────────────────── */}
      {reviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setReviewId(null); setReviewData(null); }} />
          <div
            className="relative w-full max-w-3xl flex flex-col max-h-[88vh] animate-slide-up overflow-hidden"
            style={{
              background: 'var(--surface)', borderRadius: '16px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-dropdown)',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <div>
                  <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Visit Audit Details</p>
                  <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{reviewId}</p>
                </div>
              </div>
              <button
                onClick={() => { setReviewId(null); setReviewData(null); }}
                className="btn-ghost"
                style={{ height: '32px', width: '32px', padding: 0, justifyContent: 'center' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-grow overflow-y-auto p-6 space-y-5">
              {detailLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : reviewData ? (
                <>
                  {/* Info grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        label: 'Supervisor', children: (
                          <>
                            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{reviewData.visit.supervisorId}</p>
                            <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <Clock className="h-3 w-3" />
                              {new Date(reviewData.visit.createdAt).toLocaleString()}
                            </p>
                          </>
                        )
                      },
                      {
                        label: 'Outlet', children: (
                          <>
                            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{reviewData.visit.customerCode}</p>
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Route: {reviewData.visit.routeCode}</p>
                          </>
                        )
                      },
                      {
                        label: 'GPS Location', children: (
                          <>
                            <p className="text-[12px] font-mono font-semibold flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                              <MapPin className="h-3 w-3" style={{ color: 'var(--accent)' }} />
                              {reviewData.visit.latitude.toFixed(4)}, {reviewData.visit.longitude.toFixed(4)}
                            </p>
                            <a
                              href={`https://www.google.com/maps?q=${reviewData.visit.latitude},${reviewData.visit.longitude}`}
                              target="_blank" rel="noreferrer"
                              className="text-[11px] font-semibold mt-1 block hover:underline"
                              style={{ color: 'var(--accent)' }}
                            >
                              Open in Maps (±{reviewData.visit.accuracy.toFixed(0)}m)
                            </a>
                          </>
                        )
                      },
                    ].map(({ label, children }) => (
                      <div key={label} className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                        <p className="form-label mb-2">{label}</p>
                        {children}
                      </div>
                    ))}
                  </div>

                  {/* Temperature + Action */}
                              {/* Assets and Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(reviewData.assets || []).map((ast, index) => (
                      <div key={ast.assetId} className="p-4 rounded-xl space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold uppercase" style={{ color: 'var(--text-primary)' }}>
                            {ast.assetType} #{index + 1}
                          </span>
                          <span className={`badge ${ast.tempInRange ? 'badge-success' : 'badge-danger'}`}>
                            {ast.temperature}°C {ast.tempInRange ? '✓ In Range' : '⚠ Breach'}
                          </span>
                        </div>
                        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          Action Required: <span className="font-semibold text-[var(--accent)]">{ast.actionRequired}</span>
                        </p>
                        {ast.observation && (
                          <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>
                            &ldquo;{ast.observation}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {reviewData.visit.sosAsPerBda !== null && reviewData.visit.sosAsPerBda !== undefined && (
                    <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                      <p className="form-label mb-1">Share of Shelf (SOS)</p>
                      <span className={`badge ${reviewData.visit.sosAsPerBda ? 'badge-success' : 'badge-danger'}`}>
                        {reviewData.visit.sosAsPerBda ? 'Compliant ✓' : 'Non-Compliant ⚠'}
                      </span>
                    </div>
                  )}

                  {/* Photos */}
                  <div>
                    <p className="form-label mb-3">Audit Attachments ({reviewData.photos.length})</p>
                    {reviewData.photos.length === 0 ? (
                      <p className="text-[12px] italic" style={{ color: 'var(--text-muted)' }}>No photos attached.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {reviewData.photos.map((photo) => (
                          <a
                            key={photo.photoId}
                            href={photo.cloudinaryUrl}
                            target="_blank" rel="noreferrer"
                            className="block rounded-xl overflow-hidden"
                            style={{ border: '1px solid var(--border)', aspectRatio: '1' }}
                          >
                            <img src={photo.cloudinaryUrl} alt={photo.category} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* NPD */}
                  <div>
                    <p className="form-label mb-3">NPD SKU Checklist ({reviewData.npdResponses.length})</p>
                    {reviewData.npdResponses.length === 0 ? (
                      <p className="text-[12px] italic" style={{ color: 'var(--text-muted)' }}>No SKU responses recorded.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {reviewData.npdResponses.map((npd) => (
                          <div
                            key={npd.responseId}
                            className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}
                          >
                            <span className="font-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{npd.skuCode}</span>
                            <span className={`badge ${npd.status === 'Available' ? 'badge-success' : npd.status === 'Not Available' ? 'badge-danger' : 'badge-info'}`}>
                              {npd.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>Failed to load visit data.</div>
              )}
            </div>

            <div className="px-6 py-4 flex justify-end flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => { setReviewId(null); setReviewData(null); }}
                className="btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Visit Log"
        description="Permanently delete this visit log and all related photos and NPD responses. This cannot be undone."
        confirmText="Delete permanently"
        variant="danger"
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
