'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { useGeolocation } from '@/hooks/use-geolocation';
import { saveVisitDraftAction, submitVisitAction } from '@/actions/visit-actions';
import { isFleetRole } from '@/lib/roles';
import { compressImage } from '@/utils/image-compressor';
import { getSizeModelsForCategory } from '@/utils/asset-config';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  Camera,
  MapPin,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Trash2,
  Plus,
  Info,
} from 'lucide-react';
import { Route, Customer, SKU, PowerSKU, VisitWizardState, VisitPhoto, VisitAsset } from '@/types';

function generateVisitId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const dateStr = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `MV-${dateStr}-${randomStr}`;
}

const STEP_NAMES = [
  'Route & Customer Selection',
  'Power SKU Checklist',
  'NPD Checklist',
  'Capture Assets',
  'Capture Photos',
  'Review & Submit'
];

function VisitWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { showToast } = useToast();
  const { latitude, longitude, accuracy, error: gpsError, loading: gpsLoading, getCoordinates } = useGeolocation();

  useEffect(() => {
    if (isFleetRole((session?.user as any)?.role)) {
      router.replace('/supervisor');
    }
  }, [session, router]);

  // Wizard state parameters
  const [currentStep, setCurrentStep] = useState(0);
  const [visitId, setVisitId] = useState('');

  // Selections
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(''); // Stores cust_rt_id
  const [visitType, setVisitType] = useState<'Visit' | 'No Visit'>('Visit');
  const [reasonCategory, setReasonCategory] = useState('');
  const [reason, setReason] = useState('');
  const [visitObservation, setVisitObservation] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // Multiple assets list
  const [assets, setAssets] = useState<VisitAsset[]>([]);
  const [sosAsPerBda, setSosAsPerBda] = useState<boolean | null>(null);

  // Photos category split
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProcessingStatus, setPhotoProcessingStatus] = useState<string | null>(null);

  // SKU Checklists states
  const [powerSkuResults, setPowerSkuResults] = useState<Record<string, any>>({});
  const [npdResponses, setNpdResponses] = useState<Record<string, any>>({});

  // Submitting loaders
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingVisit, setSubmittingVisit] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // 1. Load masters
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ['routes'],
    queryFn: () => fetch('/api/routes').then((res) => {
      if (!res.ok) throw new Error('Failed to load routes');
      return res.json();
    }),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', selectedRoute],
    queryFn: () => {
      if (!selectedRoute) return [];
      return fetch(`/api/customers?routeCode=${selectedRoute}`).then((res) => {
        if (!res.ok) throw new Error('Failed to load customers');
        return res.json();
      });
    },
    enabled: !!selectedRoute,
  });

  const { data: powerSkus = [] } = useQuery<PowerSKU[]>({
    queryKey: ['powerSkus', selectedRoute],
    queryFn: () => {
      if (!selectedRoute) return [];
      return fetch(`/api/powerskus?routeCode=${selectedRoute}`).then((res) => {
        if (!res.ok) throw new Error('Failed to load Power SKUs');
        return res.json();
      });
    },
    enabled: !!selectedRoute,
  });

  const { data: npdSkus = [] } = useQuery<SKU[]>({
    queryKey: ['npdSkus'],
    queryFn: () => fetch('/api/skus').then((res) => {
      if (!res.ok) throw new Error('Failed to load NPD SKUs');
      return res.json();
    }),
  });

  const activeCustomer = selectedCustomer ? customers.find((c) => c.cust_rt_id === selectedCustomer) : null;

  const getEffectiveCustomerId = () => {
    const chosenCustomer = selectedCustomer || activeCustomer?.cust_rt_id || '';
    if (!chosenCustomer) return '';
    if (chosenCustomer.includes('|')) return chosenCustomer;
    return selectedRoute ? `${chosenCustomer}|${selectedRoute}` : chosenCustomer;
  };

  const effectiveCustomerId = getEffectiveCustomerId();
  const isNoVisitFlow = visitType === 'No Visit';

  // Initialize a new Visit ID or resume existing
  useEffect(() => {
    const resumeId = searchParams.get('resumeId');
    if (resumeId) {
      const stored = localStorage.getItem('supervisor_visit_drafts');
      let localMatch: VisitWizardState | undefined;
      if (stored) {
        const drafts: VisitWizardState[] = JSON.parse(stored);
        localMatch = drafts.find((d) => d.visitId === resumeId);
      }

      if (localMatch) {
        setVisitId(localMatch.visitId);
        setSelectedRoute(localMatch.routeCode);
        setSelectedCustomer(localMatch.customerCode); // stores cust_rt_id
        setVisitType(localMatch.visit_type || 'Visit');
        setReasonCategory(localMatch.reason_category || '');
        setReason(localMatch.reason || '');
        setVisitObservation(localMatch.observation || '');
        setAssets((localMatch.assets || []).map((a: any) => ({ ...a, visitId: resumeId })));
        setPhotos((localMatch.photos || []).map((p: any) => ({ ...p, visitId: resumeId })));
        setPowerSkuResults(localMatch.powerSkuResults || {});
        setNpdResponses(localMatch.npdResponses || {});
        setSosAsPerBda(localMatch.sosAsPerBda !== undefined ? localMatch.sosAsPerBda : null);
        setCurrentStep(localMatch.currentStep || 0);
      } else {
        setVisitId(generateVisitId());
      }
    } else {
      setVisitId(generateVisitId());
    }
  }, [searchParams]);

  // Pre-populate with 1 empty asset if assets array is empty
  useEffect(() => {
    if (visitId && assets.length === 0) {
      setAssets([
        {
          assetId: 'ast_' + Math.random().toString(36).substring(2, 9),
          visitId,
          assetType: 'Chiller',
          temperature: undefined as number | undefined,
          tempInRange: true,
          actionRequired: 'Select Status',
          observation: '',
          isFirstInFlow: false,
          fefoFollowed: false,
        },
      ]);
    }
  }, [visitId, assets]);

  useEffect(() => {
    getCoordinates();
  }, []);

  useEffect(() => {
    setIsMobileDevice(typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
  }, []);

  const getTempInRange = (type: 'Chiller' | 'Freezer', temp: number) => {
    return type === 'Chiller' ? (temp >= 0 && temp <= 8) : (temp <= -15);
  };

  const saveStateToLocalStorage = (stepIndex: number) => {
    try {
      const stored = localStorage.getItem('supervisor_visit_drafts');
      let draftsList: VisitWizardState[] = stored ? JSON.parse(stored) : [];

      const index = draftsList.findIndex((d) => d.visitId === visitId);

      const updatedDraft: VisitWizardState = {
        visitId,
        routeCode: selectedRoute,
        customerCode: selectedCustomer, // stores cust_rt_id
        visit_type: visitType,
        reason_category: reasonCategory,
        reason,
        observation: visitObservation,
        customerName: activeCustomer?.customerName || '',
        assets,
        photos,
        powerSkuResults,
        npdResponses,
        sosAsPerBda,
        currentStep: stepIndex,
        status: 'Draft',
      };

      if (index > -1) {
        draftsList[index] = updatedDraft;
      } else {
        draftsList.push(updatedDraft);
      }

      localStorage.setItem('supervisor_visit_drafts', JSON.stringify(draftsList));
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: 'Dairy' | 'Beverages' | 'Ice Cream' | 'Vegetables') => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setUploadingPhoto(true);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileNum = i + 1;
        const totalFiles = files.length;
        const origSizeMb = (file.size / (1024 * 1024)).toFixed(1);

        try {
          // 1. Show compression loading indicator
          setPhotoProcessingStatus(
            `Compressing photo ${fileNum} of ${totalFiles} (${origSizeMb} MB)...`
          );

          // 2. Perform client-side compression & resolution scaling
          const compressed = await compressImage(file);

          const compressedSizeKb = (compressed.size / 1024).toFixed(0);
          const ratio = compressed.compressionRatio;

          // 3. Show upload status
          setPhotoProcessingStatus(
            `Uploading photo ${fileNum} of ${totalFiles} (${compressedSizeKb} KB, -${ratio}%)...`
          );

          // 4. Send compressed base64 payload to server upload endpoint
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: JSON.stringify({ file: compressed.base64, category }),
            headers: { 'Content-Type': 'application/json' },
          });

          if (!res.ok) throw new Error('Upload failed');
          const uploaded = await res.json();

          const newPhoto: VisitPhoto = {
            photoId: uploaded.public_id,
            visitId,
            category,
            cloudinaryUrl: uploaded.secure_url,
            publicId: uploaded.public_id,
            uploadedAt: new Date().toISOString(),
          };

          setPhotos((prev) => [...prev, newPhoto]);
          successCount++;
        } catch (err) {
          console.error('Photo compression/upload error:', err);
          failCount++;
        }
      }

      if (successCount > 0) {
        showToast(`${successCount} photo(s) compressed & uploaded successfully to ${category === 'Vegetables' ? 'Assets' : category}.`, 'success');
      }
      if (failCount > 0) {
        showToast(`Failed to process/upload ${failCount} photo(s).`, 'error');
      }
      setUploadingPhoto(false);
      setPhotoProcessingStatus(null);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.photoId !== id));
    showToast('Photo removed.', 'info');
  };

  const nextStep = () => {
    if (currentStep === 0) {
      if (visitType === 'No Visit') {
        if (!reasonCategory) {
          showToast('Please select a reason category for no-visit reports.', 'warning');
          return;
        }
        saveStateToLocalStorage(0);
        return;
      }

      if (!selectedRoute) {
        showToast('Please select a route.', 'warning');
        return;
      }
      if (!effectiveCustomerId) {
        showToast('Please select a customer.', 'warning');
        return;
      }
    }

    if (currentStep === 1 && powerSkus.length > 0 && !powerSkus.every((s) => powerSkuResults[s.skuCode])) {
      showToast('Please respond to every item in the Power SKU Checklist before continuing.', 'warning');
      return;
    }

    if (currentStep === 2 && npdSkus.length > 0 && !npdSkus.every((s) => npdResponses[s.skuCode])) {
      showToast('Please respond to every item in the NPD Checklist before continuing.', 'warning');
      return;
    }

    const nextIndex = currentStep + 1;
    setCurrentStep(nextIndex);
    saveStateToLocalStorage(nextIndex);
  };

  const prevStep = () => {
    const prevIndex = currentStep - 1;
    setCurrentStep(prevIndex);
    saveStateToLocalStorage(prevIndex);
  };

  const handleSaveDraft = async () => {
    if (visitType === 'No Visit') {
      setSavingDraft(true);
    } else if (!effectiveCustomerId) {
      showToast('Please select both a route and a customer before saving.', 'warning');
      return;
    } else {
      setSavingDraft(true);
    }
    setSavingDraft(true);
    try {
      const draftPayload = {
        visitId,
        visit_type: visitType,
        reason_category: reasonCategory,
        reason,
        cust_rt_id: effectiveCustomerId,
        routeCode: selectedRoute,
        customerCode: activeCustomer?.customerCode || '',
        assets: assets.map(a => ({
          ...a,
          temperature: Number(a.temperature) || 0,
          tempInRange: getTempInRange(a.assetType, Number(a.temperature))
        })),
        photos,
        powerSkuResults,
        npdResponses,
        sosAsPerBda,
        status: 'Draft' as const,
      };

      await saveVisitDraftAction(draftPayload as any);
      showToast('Draft successfully synced to server.', 'success');
      saveStateToLocalStorage(currentStep);
      router.push('/supervisor');
    } catch (err: any) {
      showToast(err.message || 'Failed to sync draft to server.', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (visitType === 'No Visit') {
      if (!reasonCategory) {
        showToast('Please select a reason category for no-visit reports.', 'warning');
        return;
      }
    } else if (!effectiveCustomerId) {
      showToast('Please select both a route and a customer before submitting.', 'warning');
      return;
    }
    if (visitType === 'No Visit' && !reasonCategory) {
      showToast('Please select a reason category for no-visit reports.', 'warning');
      return;
    }
    // Auto-default any unselected Power SKU or NPD checklist items to 'Not Available'
    const finalPowerSkuResults = { ...powerSkuResults };
    powerSkus.forEach((s) => {
      if (!finalPowerSkuResults[s.skuCode]) {
        finalPowerSkuResults[s.skuCode] = 'Not Available';
      }
    });

    const finalNpdResponses = { ...npdResponses };
    npdSkus.forEach((s) => {
      if (!finalNpdResponses[s.skuCode]) {
        finalNpdResponses[s.skuCode] = 'Not Available';
      }
    });

    setSubmittingVisit(true);
    try {
      const validAssets = visitType === 'No Visit' ? [] : assets
        .filter(a => a.temperature !== undefined && a.temperature !== null && (a.temperature as any) !== '' && (a.temperature as any) !== '-')
        .map((a, idx) => ({
          ...a,
          assetId: a.assetId || `ast_${visitId}_${a.assetType}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          temperature: Number(a.temperature) || 0,
          tempInRange: getTempInRange(a.assetType, Number(a.temperature))
        }));

      const finalPayload = {
        visitId,
        visit_type: visitType,
        reason_category: reasonCategory,
        reason,
        observation: visitObservation,
        cust_rt_id: effectiveCustomerId,
        routeCode: selectedRoute,
        customerCode: activeCustomer?.customerCode || '',
        assets: validAssets,
        photos,
        powerSkuResults: finalPowerSkuResults,
        npdResponses: finalNpdResponses,
        sosAsPerBda,
        latitude: latitude || 0,
        longitude: longitude || 0,
        accuracy: accuracy || 0,
        status: 'Submitted' as const,
      };

      await submitVisitAction(finalPayload as any);
      showToast('Visit audit submitted successfully.', 'success');

      const stored = localStorage.getItem('supervisor_visit_drafts');
      if (stored) {
        const drafts: VisitWizardState[] = JSON.parse(stored);
        const filtered = drafts.filter((d) => d.visitId !== visitId);
        localStorage.setItem('supervisor_visit_drafts', JSON.stringify(filtered));
      }

      router.push('/supervisor');
    } catch (err: any) {
      showToast(err.message || 'Submission failed.', 'error');
    } finally {
      setSubmittingVisit(false);
    }
  };

  const addAsset = () => {
    setAssets((prev) => [
      ...prev,
      {
        assetId: 'ast_' + Math.random().toString(36).substring(2, 9),
        visitId,
        assetType: 'Chiller',
        temperature: undefined as number | undefined,
        tempInRange: true,
        actionRequired: 'Select Status',
        observation: '',
        isFirstInFlow: false,
        fefoFollowed: false,
      },
    ]);
  };

  const removeAsset = (assetId: string) => {
    if (assets.length <= 1) return;
    setAssets((prev) => prev.filter((a) => a.assetId !== assetId));
  };

  const updateAssetField = (assetId: string, field: keyof VisitAsset, value: any) => {
    setAssets((prev) =>
      prev.map((a) => (a.assetId === assetId ? { ...a, [field]: value } : a))
    );
  };

  // Filter customers by input search query
  const filteredCustomers = customers.filter((c) =>
    c.customerCode.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.customerName.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Item counts shown per step in the phase header
  const stepItemCounts: (string | null)[] = [
    `${filteredCustomers.length} outlets`,
    `${powerSkus.length} items`,
    `${npdSkus.length} items`,
    `${assets.length} assets`,
    `${photos.length} photos`,
    null,
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-28">

      {/* Wizard Header */}
      <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Visit Audit Wizard</h1>
          <p className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>ID: {visitId}</p>
        </div>
        <button
          onClick={handleSaveDraft}
          disabled={savingDraft || submittingVisit}
          className="btn-ghost"
          style={{ opacity: savingDraft || submittingVisit ? 0.5 : 1 }}
        >
          {savingDraft ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Save Draft</span>
        </button>
      </div>

      {/* Interactive Stepper Track */}
      <div className="space-y-4 card p-4">
        <div className="relative flex items-center justify-between w-full px-1 py-2">
          {/* Background track line */}
          <div
            className="absolute left-4 right-4 h-[2px] z-0"
            style={{ background: 'var(--border-soft)', top: '50%', transform: 'translateY(-50%)' }}
          />
          {/* Active progress track line */}
          <div
            className="absolute left-4 h-[2px] z-0 transition-all duration-300"
            style={{
              background: 'var(--accent)',
              top: '50%',
              transform: 'translateY(-50%)',
              width: currentStep === 0 ? '0px' : `calc(${(currentStep / 5) * 100}% - 8px)`
            }}
          />

          {Array.from({ length: 6 }).map((_, i) => {
            const isActive = i === currentStep;
            const isCompleted = i < currentStep;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (isCompleted) {
                    setCurrentStep(i);
                  }
                }}
                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold transition-all duration-200 z-10 relative cursor-pointer ${isCompleted ? 'hover:scale-105' : ''
                  }`}
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)'
                    : isCompleted
                      ? 'var(--accent)'
                      : 'var(--surface)',
                  color: isActive
                    ? 'white'
                    : isCompleted
                      ? 'white'
                      : 'var(--text-muted)',
                  border: `2px solid ${isActive
                      ? 'transparent'
                      : isCompleted
                        ? 'var(--accent)'
                        : 'var(--border)'
                    }`,
                  boxShadow: isActive ? '0 0 10px rgba(79,70,229,0.4)' : 'none',
                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                }}
                title={STEP_NAMES[i]}
              >
                {isCompleted ? '✓' : i + 1}
              </button>
            );
          })}
        </div>

        {/* Step Info Card Header */}
        <div
          className="p-3 rounded-lg flex items-center justify-between border border-solid border-[var(--border-soft)]"
          style={{ background: 'var(--surface-2)' }}
        >
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Current Phase</p>
            <h3 className="text-[13px] font-extrabold text-[var(--text-primary)] leading-none">{STEP_NAMES[currentStep]}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {stepItemCounts[currentStep] !== null && (
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                {stepItemCounts[currentStep]}
              </span>
            )}
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)' }}
            >
              Step {currentStep + 1} / 6
            </span>
          </div>
        </div>
      </div>

      {/* STEP 0: ROUTE & CUSTOMER SELECTION */}
      {currentStep === 0 && (
        <div className="card p-5 space-y-4 animate-slide-up">
          <span className="badge badge-accent">{visitType === 'No Visit' ? 'No Visit Report' : 'Route & Customer Selection'}</span>

          {visitType === 'No Visit' ? (
            <div className="rounded-xl p-4 border border-solid border-[var(--border-soft)] bg-[var(--surface-2)] space-y-3">
              <p className="text-[11px] font-bold text-[var(--text-primary)]">No Visit reason</p>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="form-input h-9 text-[12px]"
                >
                  <option value="">— Select Reason Category —</option>
                  <option value="Outlet Closed">Outlet Closed</option>
                  <option value="No Permission">No Permission</option>
                  <option value="Customer Absent">Customer Absent</option>
                  <option value="Safety Concern">Safety Concern</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Optional short note"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="form-input h-9 text-[12px]"
                />
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">This report will be submitted immediately with the selected reason and will not require the full asset or photo workflow.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="form-label mb-1">Select Available Route</label>
                <select
                  value={selectedRoute}
                  onChange={(e) => { setSelectedRoute(e.target.value); setSelectedCustomer(''); }}
                  className="form-input"
                >
                  <option value="">— Choose Route —</option>
                  {routes.map((r) => (
                    <option key={r.routeCode} value={r.routeCode}>{r.routeCode} – {r.routeName} ({r.channel})</option>
                  ))}
                </select>
              </div>

              {selectedRoute ? (
                <div className="space-y-3 pt-2" style={{ borderTop: '1px dashed var(--border-soft)' }}>
                  <div className="grid grid-cols-2 gap-3">
                    {(['Visit', 'No Visit'] as const).map((type) => {
                      const isSelected = visitType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setVisitType(type)}
                          className="h-10 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          style={{
                            background: isSelected ? 'var(--accent-light)' : 'var(--surface)',
                            color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                            border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                  <label className="form-label">Search & Select Customer Outlet</label>
                  <input
                    type="text"
                    placeholder="Type customer code or name to search..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="form-input"
                  />

                  <div className="space-y-2 mt-2 max-h-[250px] overflow-y-auto pr-1 border border-solid border-[var(--border-soft)] rounded-xl p-2 bg-[var(--surface-2)]">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-[12px] italic text-center py-8 text-[var(--text-muted)]">
                        No matching customers found for this route.
                      </p>
                    ) : (
                      filteredCustomers.map((c) => {
                        const isSelected = selectedCustomer === c.cust_rt_id;
                        return (
                          <button
                            key={c.cust_rt_id}
                            type="button"
                            onClick={() => setSelectedCustomer(c.cust_rt_id)}
                            className="w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center justify-between border border-solid cursor-pointer"
                            style={{
                              background: isSelected ? 'var(--accent-light)' : 'var(--surface)',
                              borderColor: isSelected ? 'var(--accent)' : 'var(--border-soft)',
                              boxShadow: isSelected ? '0 2px 8px rgba(79,70,229,0.08)' : 'none',
                            }}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--accent)] border border-solid border-[var(--border-soft)]">
                                  {c.customerCode}
                                </span>
                                {c.dairyClassification ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-solid border-emerald-100">
                                    {c.dairyClassification === '-' ? 'Not classified' : `Class ${c.dairyClassification}`} · Dairy
                                  </span>
                                ) : c.classification ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-solid border-emerald-100">
                                    {c.classification === '-' ? 'Not classified' : `Class ${c.classification}`} · Dairy
                                  </span>
                                ) : null}

                                {c.iceCreamClassification ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 border border-solid border-pink-100">
                                    {c.iceCreamClassification === '-' ? 'Not classified' : `Class ${c.iceCreamClassification}`} · Ice Cream
                                  </span>
                                ) : c.classification && !c.dairyClassification ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 border border-solid border-pink-100">
                                    {c.classification === '-' ? 'Not classified' : `Class ${c.classification}`} · Ice Cream
                                  </span>
                                ) : null}
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-solid border-blue-100">
                                  {c.channel}
                                </span>
                              </div>
                              <h4 className="text-[13px] font-extrabold text-[var(--text-primary)] mt-0.5">
                                {c.customerName}
                              </h4>
                            </div>
                            <div className="flex items-center justify-center h-5 w-5 rounded-full border border-solid transition-all"
                              style={{
                                background: isSelected ? 'var(--accent)' : 'transparent',
                                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                              }}
                            >
                              {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {activeCustomer && (
                    <div className="p-4 rounded-xl animate-fade-in border border-solid border-emerald-200/60 bg-emerald-50/30 flex items-start gap-3 mt-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 flex-shrink-0">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Selected Outlet</p>
                        <h3 className="text-[14px] font-extrabold text-[var(--text-primary)] leading-none mt-0.5">
                          {activeCustomer.customerName}
                        </h3>
                        <p className="text-[11.5px] text-[var(--text-secondary)]">
                          Code: <b>{activeCustomer.customerCode}</b> · Channel: <b>{activeCustomer.channel}</b>
                          {(activeCustomer.dairyClassification || activeCustomer.classification) && (
                            <>{' '}· Classification: <b>{(activeCustomer.dairyClassification || activeCustomer.classification) === '-' ? 'Not classified' : `Class ${activeCustomer.dairyClassification || activeCustomer.classification}`} · Dairy</b></>
                          )}
                          {(activeCustomer.iceCreamClassification || activeCustomer.classification) && (
                            <>{' '}· Classification: <b>{(activeCustomer.iceCreamClassification || activeCustomer.classification) === '-' ? 'Not classified' : `Class ${activeCustomer.iceCreamClassification || activeCustomer.classification}`} · Ice Cream</b></>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Observation & Action */}
                  <div className="mt-3 space-y-1">
                    <label className="form-label mb-1 font-bold text-black" style={{ color: '#000000', fontWeight: 700 }}>
                      Observation & Action
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Write observation & action details…"
                      value={visitObservation}
                      onChange={(e) => setVisitObservation(e.target.value)}
                      className="form-input text-[12px] w-full p-2.5 rounded-xl border border-solid border-[var(--border-soft)]"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] italic text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  Please select a route first to display available customer outlets.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* STEP 2: POWER SKU CHECKLIST */}
      {currentStep === 1 && (
        <div className="card p-5 space-y-4 animate-slide-up">
          <span className="badge badge-accent">Power SKU Checklist</span>
          <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
            {powerSkus.length === 0 ? (
              <p className="text-[12px] italic text-center py-4" style={{ color: 'var(--text-muted)' }}>
                No Power SKUs configured for channel &quot;{activeCustomer?.channel}&quot;.
              </p>
            ) : (
              powerSkus.map((sku) => {
                const currentStatus = powerSkuResults[sku.skuCode] || '';
                return (
                  <div key={sku.skuCode} className="p-3.5 rounded-xl space-y-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                    <div>
                      <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{sku.skuName}</p>
                      <p className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{sku.skuCode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {['Available', 'Not Available', 'Not Required'].map((opt) => {
                        const isChecked = currentStatus === opt;
                        const col = opt === 'Available'
                          ? 'var(--success)'
                          : opt === 'Not Available'
                            ? 'var(--danger)'
                            : '#d97706';
                        const bg = opt === 'Available'
                          ? 'var(--success-light)'
                          : opt === 'Not Available'
                            ? 'var(--danger-light)'
                            : '#fef3c7';
                        return (
                          <button key={opt} type="button"
                            onClick={() => setPowerSkuResults((prev) => ({ ...prev, [sku.skuCode]: opt }))}
                            className="flex-grow h-9 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                            style={{
                              background: isChecked ? bg : 'transparent',
                              color: isChecked ? col : 'var(--text-muted)',
                              border: `1px solid ${isChecked ? col : 'var(--border)'}`,
                            }}
                          >
                            {opt === 'Not Required' ? 'Not Applicable' : opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* STEP 3: NPD CHECKLIST */}
      {currentStep === 2 && (
        <div className="card p-5 space-y-4 animate-slide-up">
          <span className="badge badge-accent">NPD SKU Checklist</span>
          <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
            {npdSkus.length === 0 ? (
              <p className="text-[12px] italic text-center py-4" style={{ color: 'var(--text-muted)' }}>No NPD SKUs configured.</p>
            ) : (
              npdSkus.map((sku) => {
                const currentStatus = npdResponses[sku.skuCode] || '';
                return (
                  <div key={sku.skuCode} className="p-3.5 rounded-xl space-y-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                    <div>
                      <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{sku.skuName}</p>
                      <p className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{sku.skuCode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {['Available', 'Not Available', 'Not Required'].map((opt) => {
                        const isChecked = currentStatus === opt;
                        const col = opt === 'Available'
                          ? 'var(--success)'
                          : opt === 'Not Available'
                            ? 'var(--danger)'
                            : '#d97706';
                        const bg = opt === 'Available'
                          ? 'var(--success-light)'
                          : opt === 'Not Available'
                            ? 'var(--danger-light)'
                            : '#fef3c7';
                        return (
                          <button key={opt} type="button"
                            onClick={() => setNpdResponses((prev) => ({ ...prev, [sku.skuCode]: opt }))}
                            className="flex-grow h-9 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                            style={{
                              background: isChecked ? bg : 'transparent',
                              color: isChecked ? col : 'var(--text-muted)',
                              border: `1px solid ${isChecked ? col : 'var(--border)'}`,
                            }}
                          >
                            {opt === 'Not Required' ? 'Not Applicable' : opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* STEP 4: CAPTURE ASSETS */}
      {currentStep === 3 && (
        <div className="card p-5 space-y-4 animate-slide-up">

          <div className="space-y-4">
            {assets.map((ast, idx) => {
              const inRange = getTempInRange(ast.assetType, ast.temperature ?? 0);
              return (
                <div key={ast.assetId} className="p-4 rounded-xl space-y-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Asset #{idx + 1}</span>
                    {assets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAsset(ast.assetId)}
                        className="p-1 text-[var(--danger)] hover:bg-[var(--danger-light)] rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(['Chiller', 'Freezer'] as const).map(type => (
                      <button key={type} type="button" onClick={() => updateAssetField(ast.assetId, 'assetType', type)}
                        className="h-10 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                        style={{
                          background: ast.assetType === type ? 'var(--accent-light)' : 'var(--surface)',
                          color: ast.assetType === type ? 'var(--accent)' : 'var(--text-muted)',
                          border: `1px solid ${ast.assetType === type ? 'var(--accent)' : 'var(--border)'}`,
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Size / Model Presets */}
                  <div>
                    <label className="form-label mb-1 font-bold text-black" style={{ color: '#000000', fontWeight: 700 }}>Size / Model</label>
                    <div className="flex flex-wrap gap-1.5">
                      {getSizeModelsForCategory(ast.assetType || 'Chiller').map((modelOption) => {
                        const selectedModels = (ast.sizeModel || '').split(',').map((s) => s.trim()).filter(Boolean);
                        const isSelected = selectedModels.includes(modelOption);
                        return (
                          <button
                            key={modelOption}
                            type="button"
                            onClick={() => {
                              let updatedModels: string[];
                              if (isSelected) {
                                updatedModels = selectedModels.filter((m) => m !== modelOption);
                              } else {
                                updatedModels = [...selectedModels, modelOption];
                              }
                              updateAssetField(ast.assetId, 'sizeModel', updatedModels.join(', '));
                            }}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                            style={{
                              background: isSelected ? 'var(--accent-light)' : 'var(--surface)',
                              color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            }}
                          >
                            {modelOption} {isSelected ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label mb-1 font-bold text-black" style={{ color: '#000000', fontWeight: 700 }}>Temp (°C)</label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          inputMode="text"
                          placeholder="e.g. -18"
                          value={ast.temperature === undefined || ast.temperature === null ? '' : ast.temperature}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || val === '-' || !isNaN(Number(val))) {
                              updateAssetField(ast.assetId, 'temperature', val);
                            }
                          }}
                          className="form-input font-mono h-9 text-[12px] flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const currentStr = String(ast.temperature ?? '');
                            if (currentStr.startsWith('-')) {
                              updateAssetField(ast.assetId, 'temperature', currentStr.slice(1));
                            } else if (currentStr === '') {
                              updateAssetField(ast.assetId, 'temperature', '-');
                            } else {
                              updateAssetField(ast.assetId, 'temperature', `-${currentStr}`);
                            }
                          }}
                          className="h-9 px-2.5 text-[11px] font-extrabold rounded-lg bg-[var(--surface-2)] text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors flex-shrink-0 cursor-pointer border border-[var(--accent)]"
                          title="Toggle Minus (- / +)"
                        >
                          + / -
                        </button>
                      </div>

                      {/* Quick Temperature Presets */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(ast.assetType === 'Freezer' ? [-22, -18, -15, 0] : [2, 4, 6, 8]).map((tempVal) => (
                          <button
                            key={tempVal}
                            type="button"
                            onClick={() => updateAssetField(ast.assetId, 'temperature', String(tempVal))}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all cursor-pointer"
                          >
                            {tempVal > 0 ? `+${tempVal}` : tempVal}°C
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="form-label mb-1 font-bold text-black" style={{ color: '#000000', fontWeight: 700 }}>Asset Status / Reason</label>
                      <select value={ast.actionRequired || 'Select Status'} onChange={(e) => updateAssetField(ast.assetId, 'actionRequired', e.target.value)} className="form-input h-9 text-[12px]">
                        <option value="Select Status">Select Status</option>
                        <option value="Working">Working</option>
                        <option value="Not working">Not working</option>
                        <option value="Working But Service Required">Working But Service Required</option>
                        <option value="Outlet Own Asset Available">Outlet Own Asset Available</option>
                        <option value="No Dandy Asset">No Dandy Asset</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="form-label mb-1 font-bold text-black" style={{ color: '#000000', fontWeight: 700 }}>Observations / Notes (Optional)</label>
                    <input type="text" placeholder="Write observation details…" value={ast.observation}
                      onChange={(e) => updateAssetField(ast.assetId, 'observation', e.target.value)}
                      className="form-input h-9 text-[12px]" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label mb-1 font-bold text-black" style={{ color: '#000000', fontWeight: 700 }}>Asset is First in Flow?</label>
                      <div className="flex items-center gap-2">
                        {[true, false].map((val) => {
                          const isSelected = ast.isFirstInFlow === val;
                          const activeBg = val ? 'var(--success-light)' : 'var(--danger-light)';
                          const activeColor = val ? 'var(--success)' : 'var(--danger)';
                          return (
                            <button
                              key={String(val)}
                              type="button"
                              onClick={() => updateAssetField(ast.assetId, 'isFirstInFlow', val)}
                              className="flex-grow h-9 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                              style={{
                                background: isSelected ? activeBg : 'var(--surface)',
                                color: isSelected ? activeColor : 'var(--text-muted)',
                                border: `1px solid ${isSelected ? activeColor : 'var(--border)'}`,
                              }}
                            >
                              {val ? 'Yes' : 'No'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="form-label mb-1 font-bold text-black" style={{ color: '#000000', fontWeight: 700 }}>FEFO is Followed?</label>
                      <div className="flex items-center gap-2">
                        {[true, false].map((val) => {
                          const isSelected = ast.fefoFollowed === val;
                          const activeBg = val ? 'var(--success-light)' : 'var(--danger-light)';
                          const activeColor = val ? 'var(--success)' : 'var(--danger)';
                          return (
                            <button
                              key={String(val)}
                              type="button"
                              onClick={() => updateAssetField(ast.assetId, 'fefoFollowed', val)}
                              className="flex-grow h-9 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                              style={{
                                background: isSelected ? activeBg : 'var(--surface)',
                                color: isSelected ? activeColor : 'var(--text-muted)',
                                border: `1px solid ${isSelected ? activeColor : 'var(--border)'}`,
                              }}
                            >
                              {val ? 'Yes' : 'No'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Temperature Warning banner */}
                  {!inRange && (
                    <div className="flex gap-2 p-3 rounded-lg animate-slide-up" style={{ background: 'var(--danger-light)', border: '1px solid rgba(220,38,38,0.15)' }}>
                      <AlertTriangle className="h-4 w-4 text-[var(--danger)] mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold" style={{ color: 'var(--danger)' }}>Temperature Breach Warning</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Rule: Chiller [0 to 8°C] | Freezer [Below -15°C]</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl text-[11px]" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-soft)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Range Rules:</strong> Chiller: <span style={{ color: 'var(--accent)' }}>0°C to 8°C</span> · Freezer: <span style={{ color: '#7C3AED' }}>Below -15°C</span>
          </div>

          {/* Moved + Add Asset Button to Bottom */}
          <div className="pt-1">
            <button
              type="button"
              onClick={addAsset}
              className="w-full h-11 text-[12px] font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
              style={{
                background: 'var(--accent-light)',
                color: 'var(--accent)',
                border: '1.5px dashed var(--accent)',
              }}
            >
              <Plus className="h-4 w-4" />
              <span>+ Add Asset</span>
            </button>
          </div>

          {/* SOS option if MT */}
          {activeCustomer && activeCustomer.channel.toUpperCase() === 'MT' && (
            <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>SOS As per BDA?</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Is Share of Shelf (SOS) compliant with BDA guidelines?</p>
                </div>
                <div className="flex items-center gap-2">
                  {[true, false].map((v) => {
                    const isChecked = sosAsPerBda === v;
                    const label = v ? 'Yes' : 'No';
                    const col = v ? 'var(--success)' : 'var(--danger)';
                    const bg = v ? 'var(--success-light)' : 'var(--danger-light)';
                    return (
                      <button key={label} type="button" onClick={() => setSosAsPerBda(v)}
                        className="h-8 px-4 text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                        style={{
                          background: isChecked ? bg : 'var(--surface)',
                          color: isChecked ? col : 'var(--text-muted)',
                          border: `1px solid ${isChecked ? col : 'var(--border)'}`
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 5: CAPTURE PHOTOS */}
      {currentStep === 4 && (
        <div className="card p-5 space-y-4 animate-slide-up">
          <span className="badge badge-accent">Camera Capture</span>
          <div className="space-y-3">
            {(['Dairy', 'Beverages', 'Ice Cream', 'Vegetables'] as const).map((cat) => {
              const catPhotos = photos.filter((p) => p.category === cat);
              const displayName = cat === 'Vegetables' ? 'Assets' : cat;
              return (
                <div key={cat} className="p-4 rounded-xl space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[12px] font-bold uppercase" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
                    <div className="flex items-center gap-2">
                      <label className="btn-ghost cursor-pointer" style={{ height: '32px', padding: '0 12px' }}>
                        <Camera className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                        <span>{isMobileDevice ? 'Camera' : 'Add Photos'}</span>
                        <input type="file" accept="image/*" capture={isMobileDevice ? 'environment' : undefined} multiple disabled={uploadingPhoto} onChange={(e) => handlePhotoUpload(e, cat)} className="hidden" />
                      </label>
                      <label className="btn-ghost cursor-pointer" style={{ height: '32px', padding: '0 12px' }}>
                        <Camera className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                        <span>Gallery</span>
                        <input type="file" accept="image/*" multiple disabled={uploadingPhoto} onChange={(e) => handlePhotoUpload(e, cat)} className="hidden" />
                      </label>
                    </div>
                  </div>
                  {catPhotos.length === 0 ? (
                    <div className="border-2 border-dashed rounded-xl p-4 text-center" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>No photos for {displayName} yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {catPhotos.map((p) => (
                        <div key={p.photoId} className="relative aspect-square rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          <img src={p.cloudinaryUrl} alt="captured" className="h-full w-full object-cover" />
                          <button onClick={() => handleRemovePhoto(p.photoId)}
                            className="absolute top-1 right-1 p-1.5 rounded-lg cursor-pointer"
                            style={{ background: 'var(--danger)', color: 'white' }}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {uploadingPhoto && (
              <div className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl text-[12px] font-bold animate-pulse" style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-soft)' }}>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>{photoProcessingStatus || 'Optimizing & uploading photo...'}</span>
                </div>
                <p className="text-[10.5px] font-normal opacity-80">Images are compressed on-device before uploading to minimize data usage.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW AUDIT SUMMARY */}
      {currentStep === 5 && (
        <div className="card p-5 space-y-4 animate-slide-up">
          <span className="badge badge-success">Summary Readback</span>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {[
              ['Route Code', selectedRoute, 'mono'],
              ['Customer Outlet', activeCustomer ? `${activeCustomer.customerCode} - ${activeCustomer.customerName}` : '—', 'bold'],
              ['Classification', [
                activeCustomer?.dairyClassification ? (activeCustomer.dairyClassification === '-' ? 'Not classified · Dairy' : `Class ${activeCustomer.dairyClassification} · Dairy`) : null,
                activeCustomer?.iceCreamClassification ? (activeCustomer.iceCreamClassification === '-' ? 'Not classified · Ice Cream' : `Class ${activeCustomer.iceCreamClassification} · Ice Cream`) : null,
              ].filter(Boolean).join(', ') || '—', 'accent'],
              ['Channel', activeCustomer?.channel || '—', 'accent'],
              ['Assets Monitored', `${assets.length} items`, 'bold'],
              ...assets.flatMap((ast, idx) => [
                [`Asset #${idx + 1} (${ast.assetType})`, `${ast.temperature}°C (${getTempInRange(ast.assetType, Number(ast.temperature)) ? 'OK' : 'Breach'})`, getTempInRange(ast.assetType, Number(ast.temperature)) ? 'success' : 'danger'],
                [`Asset #${idx + 1} Flow / FEFO`, `Flow: ${ast.isFirstInFlow ? 'Yes' : 'No'} | FEFO: ${ast.fefoFollowed ? 'Yes' : 'No'}`, 'mono']
              ]),
              ['GPS Status', latitude ? `Acquired (${latitude.toFixed(4)}, ${longitude?.toFixed(4)})` : (gpsLoading ? 'Acquiring...' : 'Not Acquired ⚠'), latitude ? 'success' : 'danger'],
              ['Photos Captured', `${photos.length} images`, 'bold'],
              ['Power SKUs checked', `${Object.keys(powerSkuResults).length} items`, 'mono'],
              ['NPD SKUs checked', `${Object.keys(npdResponses).length} items`, 'mono'],
              ...(activeCustomer?.channel.toUpperCase() === 'MT' ? [['SOS Compliant', sosAsPerBda === null ? '—' : (sosAsPerBda ? 'Yes ✓' : 'No ⚠'), sosAsPerBda ? 'success' : 'danger']] : [])
            ].map(([label, value, style], i, arr) => (
              <div key={label as string} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-soft)' : 'none', background: i % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}>
                <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: 'black' }}>{label}</span>
                <span className="text-[12px] font-bold font-mono"
                  style={{
                    color: style === 'accent' ? 'var(--accent)' : style === 'success' ? 'var(--success)' : style === 'danger' ? 'var(--danger)' : 'var(--text-primary)',
                  }}>
                  {value as string}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleFinalSubmit}
            disabled={submittingVisit || savingDraft}
            className="btn-primary w-full justify-center"
            style={{
              height: '48px', fontSize: '13px', opacity: submittingVisit || savingDraft ? 0.6 : 1,
              background: 'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)',
              boxShadow: '0 4px 20px rgba(79,70,229,0.35)',
            }}
          >
            {submittingVisit ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4.5 w-4.5" />}
            {submittingVisit ? 'Submitting…' : 'Submit Final Audit'}
          </button>
        </div>
      )}

      {/* Wizard Navigation Footer */}
      <div
        className="flex items-center justify-between gap-4 p-4 rounded-xl border border-solid border-[var(--border-soft)] mt-4"
        style={{
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <button
          onClick={prevStep}
          disabled={currentStep === 0 || savingDraft || submittingVisit}
          className="btn-ghost cursor-pointer"
          style={{ height: '40px', padding: '0 16px', opacity: currentStep === 0 ? 0.35 : 1 }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {currentStep > 0 ? STEP_NAMES[currentStep - 1] : 'Back'}
        </button>
        {currentStep < 5 && (
          <button
            onClick={isNoVisitFlow ? handleFinalSubmit : nextStep}
            disabled={savingDraft || submittingVisit || (currentStep === 0 && (visitType === 'No Visit' ? !reasonCategory : (!selectedRoute || !effectiveCustomerId)))}
            className="btn-primary cursor-pointer"
            style={{
              height: '40px', padding: '0 20px',
              background: 'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)',
              boxShadow: '0 4px 16px rgba(79,70,229,0.3)',
              opacity: (savingDraft || submittingVisit) ? 0.5 : 1,
            }}
          >
            {isNoVisitFlow ? 'Submit' : currentStep === 4 ? 'Review Summary' : STEP_NAMES[currentStep + 1]}
            {isNoVisitFlow ? <ShieldCheck className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function VisitWizardPage() {
  return (
    <Suspense fallback={
      <div className="card p-10 text-center max-w-md mx-auto my-12 animate-pulse" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
        Initializing Audit Wizard…
      </div>
    }>
      <VisitWizardContent />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
