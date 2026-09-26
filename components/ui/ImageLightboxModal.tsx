'use client';

import React, { useEffect, useCallback, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  MapPin,
  User,
  AppWindow,
  Flag,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Upload,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Camera,
  Check,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { AuditActionItem } from '@/lib/audit-actions';

export interface LightboxItem {
  photoId?: string;
  url?: string;
  cloudinaryUrl?: string;
  category?: string;
  outlet?: string;
  outletCode?: string;
  customerCode?: string;
  custCode?: string;
  supervisor?: string;
  manager?: string;
  route?: string;
  channel?: string;
  uploadedAt?: string;
  visitId?: string;
  appName?: string;
  [key: string]: any;
}

export interface ImageLightboxModalProps {
  photos: LightboxItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  title?: string;
  userRole?: string;
  actionItems?: Record<string, AuditActionItem>;
  onActionUpdated?: () => void;
}

export default function ImageLightboxModal({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  title,
  userRole,
  actionItems = {},
  onActionUpdated,
}: ImageLightboxModalProps) {
  const total = photos.length;
  const current = photos[currentIndex] || null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;

  // Directive Form States
  const [isFlagging, setIsFlagging] = useState(false);
  const [gmComment, setGmComment] = useState('');
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [deadline, setDeadline] = useState('24h');
  const [isSubmittingDirective, setIsSubmittingDirective] = useState(false);

  // Supervisor Proof Form States
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [supervisorComment, setSupervisorComment] = useState('');
  const [proofPhotoUrl, setProofPhotoUrl] = useState('');
  const [isSavingProof, setIsSavingProof] = useState(false);

  // GM Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'before_after'>('details');

  const currentAction = current?.photoId ? actionItems[current.photoId] : null;

  // Role Detection
  const { data: session } = useSession();
  const effectiveRole = userRole || (session?.user as any)?.role || 'Admin';
  const isSupervisor = effectiveRole.toLowerCase().includes('supervisor');

  // Outlet Code Detection
  const outletCode =
    current?.outletCode ||
    current?.customerCode ||
    current?.custCode ||
    (current?.visitId?.includes('|') ? current.visitId.split('|')[0] : '');

  // Zoom & Rotation States
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Reset local form states and image transforms when current image changes
  useEffect(() => {
    setIsFlagging(false);
    setIsSubmittingProof(false);
    setGmComment('');
    setSupervisorComment('');
    setProofPhotoUrl('');
    setZoom(1);
    setRotation(0);
    setActiveTab(currentAction?.proofPhotoUrl ? 'before_after' : 'details');
  }, [currentIndex, current?.photoId, currentAction?.proofPhotoUrl]);

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(currentIndex - 1);
    }
  }, [hasPrev, currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNavigate(currentIndex + 1);
    }
  }, [hasNext, currentIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && !isFlagging && !isSubmittingProof) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && !isFlagging && !isSubmittingProof) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext, isFlagging, isSubmittingProof]);

  // Handle GM Directive Submission
  const handleSubmitDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current?.photoId || !gmComment.trim()) return;

    setIsSubmittingDirective(true);
    try {
      const res = await fetch('/api/admin/audit-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: current.photoId,
          visitId: current.visitId || 'VISIT-N/A',
          outlet: current.outlet || 'General Outlet',
          route: current.route || 'N/A',
          supervisor: current.supervisor || 'Field Supervisor',
          manager: current.manager || '',
          category: current.category || 'Audit Photo',
          originalPhotoUrl: current.cloudinaryUrl || current.url || '',
          gmComment: gmComment.trim(),
          priority,
          deadline,
        }),
      });

      if (res.ok) {
        setIsFlagging(false);
        setGmComment('');
        if (onActionUpdated) onActionUpdated();
      }
    } catch (err) {
      console.error('Failed to submit GM directive:', err);
    } finally {
      setIsSubmittingDirective(false);
    }
  };

  // Handle Supervisor Proof Submission
  const handleSubmitSupervisorProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAction?.id) return;

    setIsSavingProof(true);
    try {
      // Use provided image URL or standard resolution proof fallback
      const finalProofUrl =
        proofPhotoUrl ||
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';

      const res = await fetch('/api/admin/audit-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentAction.id,
          actionStatus: 'SUBMITTED',
          supervisorComment: supervisorComment.trim() || 'Corrective action executed as instructed.',
          proofPhotoUrl: finalProofUrl,
        }),
      });

      if (res.ok) {
        setIsSubmittingProof(false);
        setActiveTab('before_after');
        if (onActionUpdated) onActionUpdated();
      }
    } catch (err) {
      console.error('Failed to submit proof:', err);
    } finally {
      setIsSavingProof(false);
    }
  };

  // Handle GM Verification (Approve or Reject)
  const handleVerifyAction = async (status: 'RESOLVED' | 'PENDING') => {
    if (!currentAction?.id) return;
    setIsVerifying(true);
    try {
      const res = await fetch('/api/admin/audit-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentAction.id,
          actionStatus: status,
          gmResolutionNotes:
            status === 'RESOLVED'
              ? 'Approved by General Manager. Corrective action verified with photo proof.'
              : 'Re-opened. Proof insufficient, please rectify and re-submit.',
        }),
      });
      if (res.ok && onActionUpdated) {
        onActionUpdated();
      }
    } catch (err) {
      console.error('Failed to verify action:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Quick Preset Proof Photo for demonstration
  const handleSelectSampleProof = (url: string) => {
    setProofPhotoUrl(url);
  };

  if (!isOpen || !current || total === 0) return null;

  const imageUrl = current.cloudinaryUrl || current.url || '';
  const categoryName = current.category || 'Audit Photo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Dark Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Lightbox Dialog Container */}
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col lg:flex-row max-h-[94vh] text-white">
        
        {/* Left Side: Image Container */}
        <div className="flex-1 bg-black/95 relative flex items-center justify-center min-h-[320px] max-h-[55vh] lg:max-h-[92vh] select-none overflow-hidden group">
          {activeTab === 'before_after' && currentAction?.proofPhotoUrl ? (
            /* Side-by-Side Comparison Mode */
            <div className="w-full h-full p-4 grid grid-cols-2 gap-3 items-center justify-center">
              {/* Left: Original Audit Photo */}
              <div className="relative h-full flex flex-col items-center justify-center rounded-xl bg-slate-950/80 border border-amber-500/30 overflow-hidden">
                <span className="absolute top-2.5 left-2.5 z-10 px-2 py-1 rounded text-[10px] font-bold bg-amber-500/90 text-black uppercase tracking-wider shadow">
                  Before: Audit Issue
                </span>
                <img
                  src={imageUrl}
                  alt="Original Issue"
                  className="max-h-[75vh] w-full object-contain"
                />
              </div>

              {/* Right: Supervisor Proof Photo */}
              <div className="relative h-full flex flex-col items-center justify-center rounded-xl bg-slate-950/80 border border-emerald-500/30 overflow-hidden">
                <span className="absolute top-2.5 left-2.5 z-10 px-2 py-1 rounded text-[10px] font-bold bg-emerald-500 text-white uppercase tracking-wider shadow flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> After: Supervisor Proof
                </span>
                <img
                  src={currentAction.proofPhotoUrl}
                  alt="Resolution Proof"
                  className="max-h-[75vh] w-full object-contain"
                />
              </div>
            </div>
          ) : (
            /* Standard Single Image View with Zoom & Rotation */
            <div className="w-full h-full flex items-center justify-center overflow-hidden p-2">
              <img
                key={imageUrl}
                src={imageUrl}
                alt={categoryName}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transformOrigin: 'center center',
                }}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
                draggable={false}
              />
            </div>
          )}

          {/* Floating Image Zoom & Rotation Controls */}
          {activeTab !== 'before_after' && (
            <div className="absolute bottom-14 inset-x-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-950/85 border border-slate-700/80 backdrop-blur-md shadow-2xl pointer-events-auto text-slate-200">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                  title="Zoom Out"
                  className="p-1 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold min-w-[40px] text-center text-slate-300 select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
                  title="Zoom In"
                  className="p-1 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <div className="h-3.5 w-px bg-slate-700 mx-1" />
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r - 90) % 360)}
                  title="Rotate Counter-Clockwise (-90°)"
                  className="p-1 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate Clockwise (+90°)"
                  className="p-1 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                {(zoom !== 1 || rotation !== 0) && (
                  <>
                    <div className="h-3.5 w-px bg-slate-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setZoom(1);
                        setRotation(0);
                      }}
                      title="Reset Zoom & Rotation"
                      className="px-2 py-0.5 text-[10px] font-bold bg-white/10 hover:bg-white/20 rounded-md text-amber-300 transition-colors"
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Top Overlay Badge & Action Status */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-black/60 text-sky-400 border border-sky-500/30 backdrop-blur-md shadow-md">
              {categoryName}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-black/60 text-slate-200 border border-slate-700 backdrop-blur-md shadow-md">
              {currentIndex + 1} / {total}
            </span>
            {currentAction && (
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-md border ${
                  currentAction.actionStatus === 'RESOLVED'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : currentAction.actionStatus === 'SUBMITTED'
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
                }`}
              >
                <Flag className="h-3 w-3" />
                {currentAction.actionStatus === 'RESOLVED'
                  ? 'Verified Closed'
                  : currentAction.actionStatus === 'SUBMITTED'
                  ? 'Proof Submitted'
                  : 'Action Required'}
              </span>
            )}
          </div>

          {/* View Toggle (If proof exists) */}
          {currentAction?.proofPhotoUrl && (
            <div className="absolute top-3 right-3 z-20 flex items-center bg-black/60 p-1 rounded-xl border border-slate-700 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'details' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('before_after')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  activeTab === 'before_after' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="h-3 w-3 text-amber-300" /> Before / After
              </button>
            </div>
          )}

          {/* Previous Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            disabled={!hasPrev}
            aria-label="Previous Image"
            className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full backdrop-blur-md shadow-xl transition-all duration-200 cursor-pointer ${
              hasPrev
                ? 'bg-black/60 hover:bg-sky-600/80 text-white border border-white/20 hover:scale-110'
                : 'bg-black/20 text-white/20 border border-white/5 cursor-not-allowed opacity-30'
            }`}
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Next Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            disabled={!hasNext}
            aria-label="Next Image"
            className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full backdrop-blur-md shadow-xl transition-all duration-200 cursor-pointer ${
              hasNext
                ? 'bg-black/60 hover:bg-sky-600/80 text-white border border-white/20 hover:scale-110'
                : 'bg-black/20 text-white/20 border border-white/5 cursor-not-allowed opacity-30'
            }`}
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Bottom Bar: Mini Navigation Controls */}
          <div className="absolute bottom-3 inset-x-0 z-20 flex items-center justify-center gap-4 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 backdrop-blur-md shadow-lg pointer-events-auto">
              <button
                onClick={handlePrev}
                disabled={!hasPrev}
                className="text-xs font-semibold px-2 py-0.5 rounded text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                {currentIndex + 1} of {total}
              </span>
              <button
                onClick={handleNext}
                disabled={!hasNext}
                className="text-xs font-semibold px-2 py-0.5 rounded text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: GM Directive, Supervisor Proof & Metadata Panel */}
        <div className="w-full lg:w-[420px] p-5 sm:p-6 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between space-y-4 overflow-y-auto max-h-[94vh]">
          <div className="space-y-4">
            {/* Header with Title and Close Button */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  {title || 'Image Audit & Action'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {outletCode ? <span className="font-mono text-sky-400 font-bold mr-1">[{outletCode}]</span> : null}
                  {current.outlet || 'Store Attachment'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* SECTION 1: GM DIRECTIVE & SUPERVISOR RESOLUTION PROOF */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5" /> GM Action & Tracking
                </span>
                {!currentAction && !isFlagging && (
                  isSupervisor ? (
                    <button
                      type="button"
                      disabled
                      title="Directives are created by Admin or Sub-Admin roles"
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed flex items-center gap-1 opacity-60"
                    >
                      <Flag className="h-3 w-3" /> Flag for Action
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsFlagging(true)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-all cursor-pointer flex items-center gap-1 shadow"
                    >
                      <Flag className="h-3 w-3" /> Flag for Action
                    </button>
                  )
                )}
              </div>

              {/* Form to Create GM Directive */}
              {isFlagging && (
                <form onSubmit={handleSubmitDirective} className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      GM Remark / Directive for Supervisor:
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={gmComment}
                      onChange={(e) => setGmComment(e.target.value)}
                      placeholder="e.g. Planogram breach: Dandy 2L displaced on top shelf. Please rectify and upload proof."
                      className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmittingDirective || !gmComment.trim()}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {isSubmittingDirective ? 'Assigning...' : 'Assign to Supervisor'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFlagging(false)}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Display Active Action Item */}
              {currentAction && (
                <div className="space-y-2.5 text-xs">
                  {/* Status Banner */}
                  <div
                    className={`p-2 rounded-lg border flex items-center justify-between text-[11px] font-bold ${
                      currentAction.actionStatus === 'RESOLVED'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : currentAction.actionStatus === 'SUBMITTED'
                        ? 'bg-sky-950/40 border-sky-500/40 text-sky-300'
                        : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {currentAction.actionStatus === 'RESOLVED' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : currentAction.actionStatus === 'SUBMITTED' ? (
                        <Upload className="h-3.5 w-3.5 text-sky-400" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      )}
                      Status: {currentAction.actionStatus === 'RESOLVED' ? 'Verified & Closed' : currentAction.actionStatus === 'SUBMITTED' ? 'Proof Uploaded (Review)' : 'Pending Supervisor Action'}
                    </span>
                  </div>

                  {/* GM Remark Block */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                      <span>GM Directive ({currentAction.gmName}):</span>
                      <span className="font-mono text-slate-500">{new Date(currentAction.createdAt).toLocaleDateString()}</span>
                    </p>
                    <p className="text-amber-200 font-medium italic">"{currentAction.gmComment}"</p>
                    <p className="text-[10px] text-slate-400 pt-1">
                      Assigned to: <strong className="text-slate-200">{currentAction.supervisor}</strong>
                    </p>
                  </div>

                  {/* SUPERVISOR RESOLUTION PROOF SECTION */}
                  {currentAction.proofPhotoUrl ? (
                    <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                      <p className="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Supervisor Action Proof:
                        </span>
                        {currentAction.actionTakenAt && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(currentAction.actionTakenAt).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                      {currentAction.supervisorComment && (
                        <p className="text-slate-300 text-[11px] italic bg-black/30 p-2 rounded">
                          "{currentAction.supervisorComment}"
                        </p>
                      )}
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-emerald-500/40">
                        <img
                          src={currentAction.proofPhotoUrl}
                          alt="Supervisor Proof"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* GM Closure Action Buttons */}
                      {currentAction.actionStatus !== 'RESOLVED' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isVerifying}
                            onClick={() => handleVerifyAction('RESOLVED')}
                            className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-all flex items-center justify-center gap-1 cursor-pointer shadow"
                          >
                            <Check className="h-3.5 w-3.5" /> {isVerifying ? 'Saving...' : 'Approve & Close'}
                          </button>
                          <button
                            type="button"
                            disabled={isVerifying}
                            onClick={() => handleVerifyAction('PENDING')}
                            className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 transition-all cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="h-3 w-3" /> Re-open
                          </button>
                        </div>
                      )}
                    </div>
                  ) : isSupervisor ? (
                    /* Supervisor Proof Form / Submission (Supervisor Only) */
                    <div>
                      {!isSubmittingProof ? (
                        <button
                          type="button"
                          onClick={() => setIsSubmittingProof(true)}
                          className="w-full py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
                        >
                          <Camera className="h-3.5 w-3.5" /> Submit Resolution Proof (Supervisor Flow)
                        </button>
                      ) : (
                        <form onSubmit={handleSubmitSupervisorProof} className="p-3 rounded-xl bg-slate-900 border border-sky-500/40 space-y-2.5">
                          <p className="text-xs font-bold text-sky-400 flex items-center gap-1">
                            <Upload className="h-3.5 w-3.5" /> Supervisor Resolution Submission
                          </p>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">
                              Action Taken Notes:
                            </label>
                            <textarea
                              rows={2}
                              required
                              value={supervisorComment}
                              onChange={(e) => setSupervisorComment(e.target.value)}
                              placeholder="e.g. Cleaned chiller shelf, re-arranged Dandy 2L milk facing and verified expiry."
                              className="w-full text-xs p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">
                              Proof Photo (Attach or Pick Sample):
                            </label>
                            <div className="flex gap-1.5 mb-1.5">
                              <button
                                type="button"
                                onClick={() => handleSelectSampleProof('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80')}
                                className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700"
                              >
                                Clean Shelf Proof
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectSampleProof('https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?auto=format&fit=crop&w=800&q=80')}
                                className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700"
                              >
                                Rectified Display
                              </button>
                            </div>
                            <input
                              type="text"
                              value={proofPhotoUrl}
                              onChange={(e) => setProofPhotoUrl(e.target.value)}
                              placeholder="Photo URL or preset selected above"
                              className="w-full text-[11px] p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="submit"
                              disabled={isSavingProof || !supervisorComment.trim()}
                              className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-black transition-all cursor-pointer"
                            >
                              {isSavingProof ? 'Submitting...' : 'Confirm Resolution'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsSubmittingProof(false)}
                              className="py-1.5 px-2.5 rounded-lg text-xs bg-slate-800 text-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    /* Admin / Sub-Admin View: Awaiting Supervisor Proof */
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                      <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-400" /> Awaiting Supervisor Corrective Action
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Directive is assigned to <strong className="text-slate-200">{currentAction.supervisor}</strong>. Resolution proof is strictly submitted by the supervisor.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: METADATA DETAILS */}
            <div className="space-y-3 text-xs pt-1">
              {current.outlet && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Outlet / Store
                  </label>
                  <p className="text-sm font-semibold text-slate-100 mt-0.5">
                    {outletCode ? <span className="font-mono text-sky-400 font-bold mr-1.5">{outletCode} -</span> : null}
                    {current.outlet}
                  </p>
                </div>
              )}

              {(current.supervisor || current.manager) && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Supervisor / Manager
                  </label>
                  <p className="text-xs font-medium text-slate-200 mt-0.5">
                    {current.supervisor || 'N/A'}{' '}
                    {current.manager && (
                      <span className="text-slate-400">({current.manager})</span>
                    )}
                  </p>
                </div>
              )}

              {(current.route || current.channel) && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Route
                    </label>
                    <p className="text-xs font-mono font-medium text-slate-300 mt-0.5">
                      {current.route || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Channel
                    </label>
                    <p className="text-xs font-medium text-slate-300 mt-0.5">
                      {current.channel || 'GT'}
                    </p>
                  </div>
                </div>
              )}

              {current.uploadedAt && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Date & Time
                  </label>
                  <p className="text-xs font-mono text-slate-300 mt-0.5">
                    {new Date(current.uploadedAt).toLocaleString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}

              {current.visitId && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Visit Reference
                  </label>
                  <p className="text-[11px] font-mono text-slate-400 break-all mt-0.5">
                    {current.visitId}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Navigation Actions */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={handlePrev}
                disabled={!hasPrev}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button
                onClick={handleNext}
                disabled={!hasNext}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-sky-400 text-xs font-semibold transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Full Image
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
