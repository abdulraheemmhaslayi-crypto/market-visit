'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getVisitsAction, getVisitDetailsAction } from '@/actions/visit-actions';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2, Eye, MapPin, Calendar, Thermometer, ChevronRight, X, AlertTriangle
} from 'lucide-react';
import BackHeader from '../components/BackHeader';
import { Visit, VisitPhoto, NPDResponse, VisitAsset, VisitPowerSkuResult } from '@/types';
import { isFleetRole } from '@/lib/roles';

export default function MyVisitsPage() {
  const { showToast } = useToast();
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isFleetRole((session?.user as any)?.role)) {
      router.replace('/supervisor');
    }
  }, [session, router]);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewData, setReviewData] = useState<{
    visit: Visit;
    assets: VisitAsset[];
    photos: VisitPhoto[];
    powerSkuResults?: VisitPowerSkuResult[];
    npdResponses: NPDResponse[];
  } | null>(null);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const data = await getVisitsAction();
      setVisits((data as Visit[]).filter(v => v.status === 'Submitted'));
    } catch (e: any) {
      showToast(e.message || 'Failed to fetch visits.', 'error');
    } finally {
      setLoading(false);
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
    fetchVisits();
  }, []);

  const handleOpenReview = async (id: string) => {
    setReviewId(id);
    setDetailLoading(true);
    try {
      setReviewData(await getVisitDetailsAction(id) as any);
    } catch (e: any) {
      showToast(e.message || 'Failed to load details.', 'error');
      setReviewId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6 max-w-4xl mx-auto">
      <BackHeader title="My Visits" hideBack />

      <div className="card p-0 overflow-hidden">
        <div className="section-header">
          <span className="section-title">
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
            Submitted Audits Logs ({visits.length})
          </span>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-2)' }}>
                {['Visit ID', 'Date', 'Type', 'Route', 'Customer', 'Action'].map((h, i) => (
                  <th key={h} className={`px-5 py-3 ${i === 5 ? 'text-right' : 'text-left'}`} style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    No submitted audits found.
                  </td>
                </tr>
              ) : (
                visits.map(v => {
                  const display = getVisitDisplay(v);
                  return (
                    <tr key={v.visitId} style={{ borderBottom: '1px solid var(--border-soft)' }} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[12px] font-semibold" style={{ color: 'var(--accent)' }}>
                        {v.visitId}
                      </td>
                      <td className="px-5 py-3.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        {new Date(v.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <span className={`badge ${display.typeClass}`}>
                            {display.typeLabel}
                          </span>
                          {display.isNoVisit && v.reason_category && (
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{v.reason_category}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-[var(--text-secondary)]">
                        {display.routeLabel}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {display.customerLabel}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => handleOpenReview(v.visitId)} className="btn-ghost" style={{ height: '30px', padding: '0 12px', fontSize: '12px' }}>
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-[var(--border-soft)]">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-4 px-4 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          ) : visits.length === 0 ? (
            <div className="py-12 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
              No submitted audits found.
            </div>
          ) : (
            visits.map(v => {
              const display = getVisitDisplay(v);
              return (
                <div key={v.visitId} onClick={() => handleOpenReview(v.visitId)} className="py-3.5 px-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors">
                  <div className="min-w-0 flex-grow">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[var(--accent)]">{v.visitId}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(v.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`badge ${display.typeClass}`}>{display.typeLabel}</span>
                      {display.isNoVisit && v.reason_category && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{v.reason_category}</span>
                      )}
                    </div>
                    <h4 className="text-[13px] font-bold mt-1.5 truncate text-[var(--text-primary)]">
                      {display.customerLabel}
                    </h4>
                    <p className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5">
                      Route: {display.routeLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className={`badge ${display.tempClass}`}>
                      {display.tempLabel}
                    </span>
                    <ChevronRight className="h-4.5 w-4.5 text-[var(--text-muted)]" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewId && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setReviewId(null); setReviewData(null); }} />
          <div className="relative w-full md:max-w-3xl flex flex-col bg-[var(--surface)] md:rounded-2xl shadow-xl overflow-hidden animate-slide-up" style={{ maxHeight: '85vh', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-soft)]">
              <div>
                <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>Audit Details</h3>
                <p className="font-mono text-[11px] text-[var(--text-muted)] mt-0.5">ID: {reviewId}</p>
              </div>
              <button onClick={() => { setReviewId(null); setReviewData(null); }} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--text-muted)' }}>
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-5 space-y-5 text-[13px]">
              {detailLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : reviewData ? (
                <>
                  {/* Basic Metadata */}
                  <div className="grid grid-cols-2 gap-3 bg-[var(--surface-2)] p-4 rounded-xl border border-[var(--border-soft)]">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>Route</p>
                      <p className="font-mono font-bold mt-1 text-[13px]" style={{ color: 'var(--text-primary)' }}>{reviewData.visit.routeCode}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>Customer</p>
                      <p className="font-semibold mt-1 text-[13px]" style={{ color: 'var(--text-primary)' }}>{reviewData.visit.customerCode}</p>
                    </div>
                    {reviewData.visit.sosAsPerBda !== null && reviewData.visit.sosAsPerBda !== undefined && (
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>Share of Shelf (SOS)</p>
                        <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                          {reviewData.visit.sosAsPerBda ? 'Compliant ✓' : 'Non-Compliant ⚠'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Temperature Range Reference */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-700/30 space-y-2">
                    <div className="flex items-start gap-2">
                      <Thermometer className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--info)' }} />
                      <div className="flex-1">
                        <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>Temperature Ranges</p>
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between text-[12px] bg-white dark:bg-surface p-2 rounded border border-blue-100 dark:border-blue-700/50">
                            <span className="font-semibold text-[var(--text-primary)]">Chiller</span>
                            <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>0 - 5 °C</span>
                          </div>
                          <div className="flex items-center justify-between text-[12px] bg-white dark:bg-surface p-2 rounded border border-blue-100 dark:border-blue-700/50">
                            <span className="font-semibold text-[var(--text-primary)]">Freezer</span>
                            <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>≤ -18 °C</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="form-label mb-2">Assets Audited</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(reviewData.assets || []).map((ast, index) => (
                        <div key={ast.assetId} className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border-soft)] space-y-1.5 text-[12px]">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase text-[var(--text-primary)]">{ast.assetType} #{index + 1}</span>
                            <span className={`badge text-[10px] ${ast.tempInRange ? 'badge-success' : 'badge-danger'}`}>
                              {ast.temperature}°C {ast.tempInRange ? '✓' : '⚠'}
                            </span>
                          </div>
                          {ast.observation && (
                            <p className="text-[11px] text-[var(--text-secondary)] italic">
                              &ldquo;{ast.observation}&rdquo;
                            </p>
                          )}
                          {ast.actionRequired !== 'None' && (
                            <div className="text-[10px] font-bold text-red-500">
                              Action Required: {ast.actionRequired}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Photo logs */}
                  {reviewData.photos.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-[14px]" style={{ color: 'var(--text-primary)' }}>Audit Photos</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {reviewData.photos.map((p, i) => (
                          <div key={i} className="aspect-square rounded-xl overflow-hidden border border-[var(--border-soft)] relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.cloudinaryUrl} alt="Audit upload" className="h-full w-full object-cover" />
                            <div className="absolute bottom-0 inset-x-0 p-2 text-white text-[9px] font-mono bg-black/40 backdrop-blur-xs flex items-center justify-between">
                              <span>Photo #{i + 1}</span>
                              <Calendar className="h-3 w-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SKU checklist logs */}
                  {reviewData.npdResponses.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-[14px]" style={{ color: 'var(--text-primary)' }}>Checklist Responses</h4>
                      <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border-soft)]">
                        {reviewData.npdResponses.map(r => (
                          <div key={r.responseId} className="flex items-center justify-between p-3 bg-[var(--surface-2)]">
                            <div>
                              <p className="font-bold text-[13px]" style={{ color: 'var(--text-primary)' }}>{r.skuCode}</p>
                              <p className="text-[11px] text-[var(--text-muted)]">NPD Status Audit</p>
                            </div>
                            <span className={`badge ${r.status === 'Available' ? 'badge-success' : r.status === 'Not Available' ? 'badge-danger' : 'badge-info'}`}>
                              {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-[var(--text-muted)]">Failed to load details.</div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--border-soft)] flex justify-end">
              <button onClick={() => { setReviewId(null); setReviewData(null); }} className="btn-ghost h-9 px-4">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
