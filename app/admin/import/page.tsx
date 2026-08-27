'use client';

import React, { useState, useRef } from 'react';
import { validateExcelAction, importExcelAction } from '@/actions/import-actions';
import { useToast } from '@/components/ui/toast';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2,
  AlertTriangle, ArrowRight, RefreshCw, Database,
  ArrowLeft, Map, Users, Package, Link2,
  CheckCheck, Info, X
} from 'lucide-react';
import { Route, Customer, CustomerRouteMapping, SKU, ImportSummary } from '@/types';

import { useSession } from 'next-auth/react';
import { canModifyMasterData } from '@/lib/roles';
import { Lock } from 'lucide-react';

type ImportStep = 'UPLOAD' | 'VALIDATE' | 'IMPORTING' | 'SUMMARY';

const STEPS = [
  { key: 'UPLOAD',    num: 1, label: 'Select Files' },
  { key: 'VALIDATE',  num: 2, label: 'Review & Check' },
  { key: 'IMPORTING', num: 3, label: 'Sync Database' },
  { key: 'SUMMARY',   num: 4, label: 'Summary' },
];

const STEP_ORDER: ImportStep[] = ['UPLOAD', 'VALIDATE', 'IMPORTING', 'SUMMARY'];

export default function MasterImportPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const canEdit = canModifyMasterData(userRole);
  const { showToast } = useToast();
  const [step, setStep] = useState<ImportStep>('UPLOAD');
  const [activeImportKey, setActiveImportKey] = useState<keyof typeof files | 'ALL'>('ALL');
  
  // Files selection state
  const [files, setFiles] = useState<{
    routeMaster: File | null;
    custMaster: File | null;
    skuMaster: File | null;
    classification: File | null;
    powerSkuMaster: File | null;
  }>({
    routeMaster: null,
    custMaster: null,
    skuMaster: null,
    classification: null,
    powerSkuMaster: null,
  });

  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ row: number; error: string }[]>([]);
  const [routesPreview, setRoutesPreview]       = useState<Route[]>([]);
  const [customersPreview, setCustomersPreview] = useState<Customer[]>([]);
  const [mappingsPreview, setMappingsPreview]   = useState<CustomerRouteMapping[]>([]);
  const [skusPreview, setSkusPreview]           = useState<SKU[]>([]);
  const [counts, setCounts] = useState({ routes: 0, customers: 0, mappings: 0, skus: 0 });
  const [importPayload, setImportPayload] = useState<{ routes: Route[]; customers: Customer[]; mappings: CustomerRouteMapping[]; skus: SKU[] } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // Individual file input refs
  const routeMasterRef = useRef<HTMLInputElement>(null);
  const custMasterRef = useRef<HTMLInputElement>(null);
  const skuMasterRef = useRef<HTMLInputElement>(null);
  const classificationRef = useRef<HTMLInputElement>(null);
  const powerSkuMasterRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (key: keyof typeof files, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      setFiles(prev => ({ ...prev, [key]: selectedFile }));
    }
  };

  const removeFile = (key: keyof typeof files, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles(prev => ({ ...prev, [key]: null }));
    if (key === 'routeMaster' && routeMasterRef.current) routeMasterRef.current.value = '';
    if (key === 'custMaster' && custMasterRef.current) custMasterRef.current.value = '';
    if (key === 'skuMaster' && skuMasterRef.current) skuMasterRef.current.value = '';
    if (key === 'classification' && classificationRef.current) classificationRef.current.value = '';
    if (key === 'powerSkuMaster' && powerSkuMasterRef.current) powerSkuMasterRef.current.value = '';
  };

  const canValidate = files.routeMaster && files.custMaster && files.skuMaster && files.classification;

  const fdDefLabel = (key: keyof typeof files) => {
    if (key === 'routeMaster') return 'Route Master File';
    if (key === 'custMaster') return 'Customer Mappings File';
    if (key === 'skuMaster') return 'SKU Master File';
    if (key === 'classification') return 'Customer Classification File';
    return 'Power SKU Master File';
  };

  const handleValidateSingle = async (key: keyof typeof files) => {
    const selectedFile = files[key];
    if (!selectedFile) {
      showToast('Please select a file first.', 'warning');
      return;
    }
    setLoading(true);
    setActiveImportKey(key);
    
    const fd = new FormData();
    fd.append(key, selectedFile);
    fd.append('individual', 'true');

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        body: fd,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Validation server returned ${response.status}`);
      }
      const res = await response.json();
      if (res.error) {
        throw new Error(res.error);
      }
      if (res.success) {
        setCounts({
          routes: res.routesCount,
          customers: res.customersCount,
          mappings: res.mappingsCount,
          skus: res.skusCount
        });
        setRoutesPreview(res.routesPreview as Route[]);
        setCustomersPreview(res.customersPreview as Customer[]);
        setMappingsPreview(res.mappingsPreview as CustomerRouteMapping[]);
        setSkusPreview(res.skusPreview as SKU[]);
        setValidationErrors(res.errors as any[]);
        setImportPayload(res.payload);
        setStep('VALIDATE');
        showToast(`${fdDefLabel(key)} parsed and validated.`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Validation failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!canValidate) {
      showToast('Please select all required files first.', 'warning');
      return;
    }
    setLoading(true);
    setActiveImportKey('ALL');
    const fd = new FormData();
    if (files.routeMaster) fd.append('routeMaster', files.routeMaster);
    if (files.custMaster) fd.append('custMaster', files.custMaster);
    if (files.skuMaster) fd.append('skuMaster', files.skuMaster);
    if (files.classification) fd.append('classification', files.classification);
    if (files.powerSkuMaster) fd.append('powerSkuMaster', files.powerSkuMaster);

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        body: fd,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Validation server returned ${response.status}`);
      }
      const res = await response.json();
      if (res.error) {
        throw new Error(res.error);
      }
      if (res.success) {
        setCounts({
          routes: res.routesCount,
          customers: res.customersCount,
          mappings: res.mappingsCount,
          skus: res.skusCount
        });
        setRoutesPreview(res.routesPreview as Route[]);
        setCustomersPreview(res.customersPreview as Customer[]);
        setMappingsPreview(res.mappingsPreview as CustomerRouteMapping[]);
        setSkusPreview(res.skusPreview as SKU[]);
        setValidationErrors(res.errors as any[]);
        setImportPayload(res.payload);
        setStep('VALIDATE');
        showToast('All spreadsheets parsed and validated.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Validation failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importPayload) return;
    setLoading(true);
    setStep('IMPORTING');
    try {
      const summaryResult = await importExcelAction({
        ...importPayload,
        clearObsolete: true,
      });
      setSummary(summaryResult);
      setStep('SUMMARY');
      showToast('Database synchronization complete.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Synchronization failed.', 'error');
      setStep('VALIDATE');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFiles({
      routeMaster: null,
      custMaster: null,
      skuMaster: null,
      classification: null,
      powerSkuMaster: null,
    });
    setValidationErrors([]);
    setImportPayload(null);
    setSummary(null);
    setActiveImportKey('ALL');
    setStep('UPLOAD');
  };

  const currentIdx = STEP_ORDER.indexOf(step);

  const fileDefinitions = [
    {
      key: 'routeMaster' as const,
      name: 'ROUTE MASTER.xlsx',
      label: 'Route Master ',
      description: 'Contains RouteCode and RouteName columns.',
      required: true,
      ref: routeMasterRef,
      icon: Map,
      color: 'var(--accent)',
      bg: 'var(--accent-light)',
    },
    {
      key: 'custMaster' as const,
      name: 'CUSTMASTER.xlsx',
      label: 'Customer Mappings ',
      description: 'Contains CustomerCode, CustomerName, and RouteCode columns.',
      required: true,
      ref: custMasterRef,
      icon: Users,
      color: '#8B5CF6',
      bg: '#F5F3FF',
    },
    {
      key: 'skuMaster' as const,
      name: 'SKUMASTER.xlsx',
      label: 'SKU Master ',
      description: 'Contains SKUCode and SKUName columns.',
      required: true,
      ref: skuMasterRef,
      icon: Package,
      color: 'var(--success)',
      bg: 'var(--success-light)',
    },
    {
      key: 'classification' as const,
      name: 'Customer_Classification_DUMMY.xlsx',
      label: 'Customer Classification ',
      description: 'Contains CustomerCode, Classification, Channel, and Business Vertical (Dairy / Ice Cream) columns. A customer may have one row per vertical.',
      required: true,
      ref: classificationRef,
      icon: Link2,
      color: 'var(--warning)',
      bg: 'var(--warning-light)',
    },
    {
      key: 'powerSkuMaster' as const,
      name: 'PowerSku_Master_DUMMY.xlsx',
      label: 'Power SKU Master  (Optional)',
      description: 'Contains additional Power SKU codes and names.',
      required: true,
      ref: powerSkuMasterRef,
      icon: Package,
      color: '#EC4899',
      bg: '#FDF2F8',
    },
  ];

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 my-12">
        <div className="h-16 w-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Access Restricted</h2>
        <p className="text-xs text-[var(--text-muted)] max-w-md">
          Master Data Import operations are restricted to full Administrators. Your account role ({userRole || 'Sub-Admin'}) does not have permission to view or execute master imports.
        </p>
        <a
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-white px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity mt-2"
        >
          Return to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Master Data Import Panel
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Upload separate Route, Customer Mappings, SKU lists, and Classification files to synchronize the database.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="card p-4">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const idx = STEP_ORDER.indexOf(s.key as ImportStep);
            const isDone = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <React.Fragment key={s.key}>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all"
                    style={{
                      background: isDone ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--border)',
                      color: isDone || isCurrent ? 'white' : 'var(--text-muted)',
                    }}
                  >
                    {isDone ? <CheckCheck className="h-3.5 w-3.5" /> : s.num}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold leading-none" style={{ color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      Step {s.num}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-grow h-px mx-3" style={{ background: idx < currentIdx ? 'var(--success)' : 'var(--border)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── STEP 1: Upload (Select Files) ─────────────────────── */}
      {step === 'UPLOAD' && (
        <div className="card p-6 space-y-6">
          <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--accent-light)', border: '1px solid rgba(59,130,246,0.1)' }}>
            <Info className="h-4.5 w-4.5 text-accent mt-0.5 flex-shrink-0" />
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <strong>Upload Requirements:</strong> Select the separate master files. The system will dynamically validate columns. The <strong>first 4 files</strong> are mandatory.
            </p>
          </div>

          <div className="space-y-3.5">
            {fileDefinitions.map((fdDef) => {
              const selectedFile = files[fdDef.key];
              const Icon = fdDef.icon;
              return (
                <div
                  key={fdDef.key}
                  onClick={() => fdDef.ref.current?.click()}
                  className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-accent"
                  style={{
                    borderColor: selectedFile ? 'var(--success)' : 'var(--border)',
                    background: selectedFile ? 'var(--success-light)' : 'var(--surface-2)',
                  }}
                >
                  <input
                    ref={fdDef.ref}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileChange(fdDef.key, e)}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3.5">
                    <div className="icon-wrap h-10 w-10 rounded-lg flex-shrink-0" style={{ background: fdDef.bg }}>
                      <Icon className="h-5 w-5" style={{ color: fdDef.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                          {fdDef.label}
                        </span>
                        {fdDef.required ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-100 text-red-600">
                            Required
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-gray-200 text-gray-600">
                            Optional
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {selectedFile ? `${selectedFile.name} · ${(selectedFile.size / 1024).toFixed(1)} KB` : fdDef.description}
                      </p>
                    </div>
                  </div>
                  {selectedFile ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleValidateSingle(fdDef.key);
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold text-blue-600 rounded-lg bg-accent hover:bg-accent-hover transition-all flex items-center gap-1 shadow-sm"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Import This
                      </button>
                      <button
                        onClick={(e) => removeFile(fdDef.key, e)}
                        className="h-7 w-7 rounded-full flex items-center justify-center transition-all hover:bg-red-100"
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  ) : (
                    <UploadCloud className="h-4.5 w-4.5" style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleValidate}
              disabled={!canValidate || loading || !canEdit}
              className="btn-primary"
              style={{ opacity: !canValidate || loading || !canEdit ? 0.6 : 1 }}
            >
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
              {loading ? 'Processing Files…' : 'Parse & Validate All'}
              {!loading && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Validate ──────────────────────────────────── */}
      {step === 'VALIDATE' && importPayload && (
        <div className="space-y-5">
          {/* Validation Alert */}
          <div
            className="flex items-start gap-3.5 p-4 rounded-xl"
            style={{
              background: validationErrors.length ? 'var(--danger-light)' : 'var(--success-light)',
              border: `1px solid ${validationErrors.length ? 'rgba(220,38,38,0.2)' : 'rgba(16,185,129,0.2)'}`,
            }}
          >
            {validationErrors.length ? (
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
            ) : (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
            )}
            <div>
              <p className="text-[13px] font-bold" style={{ color: validationErrors.length ? 'var(--danger)' : 'var(--success)' }}>
                {validationErrors.length ? `${validationErrors.length} Validation Error(s) Found` : 'All Checks Passed Successfully'}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {validationErrors.length
                  ? 'Aborted. Fix the following row-level errors in your Excel files and re-upload.'
                  : 'All structures and constraints validated. Data is ready to sync.'}
              </p>
              {validationErrors.length > 0 && (
                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {validationErrors.map((e, i) => (
                    <li key={i} className="font-mono text-[11px]" style={{ color: 'var(--danger)' }}>
                      Row {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Count Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Routes Detected', value: counts.routes, icon: Map, color: 'var(--accent)', bg: 'var(--accent-light)' },
              { label: 'Customers Constructed', value: counts.customers, icon: Users, color: '#8B5CF6', bg: '#F5F3FF' },
              { label: 'Mappings Extracted', value: counts.mappings, icon: Link2, color: 'var(--warning)', bg: 'var(--warning-light)' },
              { label: 'SKUs Extracted', value: counts.skus, icon: Package, color: 'var(--success)', bg: 'var(--success-light)' },
            ].map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="card p-4 flex items-center gap-3">
                  <div className="icon-wrap h-9 w-9 rounded-lg flex-shrink-0" style={{ background: k.bg }}>
                    <Icon className="h-4.5 w-4.5" style={{ color: k.color }} />
                  </div>
                  <div>
                    <p className="text-[20px] font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{k.value}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preview Tables */}
          <div className="card">
            <div className="section-header">
              <span className="section-title">
                <FileSpreadsheet className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                Data Preview (First 5 Rows)
              </span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                {
                  label: 'Routes', rows: routesPreview,
                  cols: ['routeCode', 'routeName'],
                  heads: ['Code', 'Name'],
                },
                {
                  label: 'Customers (Merged Classification)', rows: customersPreview,
                  cols: ['customerCode', 'customerName', 'dairyClassification', 'iceCreamClassification', 'channel'],
                  heads: ['Code', 'Name', 'Class (Dairy)', 'Class (Ice Cream)', 'Channel'],
                },
                {
                  label: 'Customer-Route Mappings', rows: mappingsPreview,
                  cols: ['customerCode', 'routeCode'],
                  heads: ['Customer', 'Route'],
                },
                {
                  label: 'SKUs (Merged)', rows: skusPreview,
                  cols: ['skuCode', 'skuName'],
                  heads: ['SKU Code', 'SKU Name'],
                },
              ].map(({ label, rows, cols, heads }) => (
                <div key={label} className="space-y-2">
                  <p className="form-label">{label}</p>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {rows.length === 0 ? (
                      <div className="py-4 text-center text-[12px] italic" style={{ color: 'var(--text-muted)' }}>No records found</div>
                    ) : (
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                            {heads.map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold" style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row: any, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                              {cols.map((col, j) => (
                                <td key={col} className="px-3 py-2" style={{ color: 'var(--text-secondary)', fontFamily: j === 0 ? 'monospace' : undefined }}>
                                  <span className="truncate block max-w-[120px]">{row[col]}</span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button onClick={handleReset} className="btn-ghost">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Upload
            </button>
            <button
              onClick={handleImport}
              disabled={validationErrors.length > 0 || loading}
              className="btn-primary"
              style={{ opacity: validationErrors.length > 0 ? 0.5 : 1 }}
            >
              <Database className="h-3.5 w-3.5" />
              Sync to Database
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Syncing ───────────────────────────────────── */}
      
      {step === 'IMPORTING' && (
        <div className="card p-16 flex flex-col items-center gap-5 text-center">
          <div className="icon-wrap h-16 w-16 rounded-2xl" style={{ background: 'var(--accent-light)' }}>
            <RefreshCw className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <p className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>Synchronizing Database…</p>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Performing atomic sync write and pruning obsolete master entries.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 4: Summary ───────────────────────────────────── */}
      {step === 'SUMMARY' && summary && (
        <div className="card p-10 flex flex-col items-center gap-6 text-center">
          <div className="icon-wrap h-14 w-14 rounded-2xl" style={{ background: 'var(--success-light)' }}>
            <CheckCircle2 className="h-7 w-7" style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <p className="text-[20px] font-bold" style={{ color: 'var(--text-primary)' }}>Sync Complete!</p>
            <p className="text-[13px] mt-1.5 max-w-sm" style={{ color: 'var(--text-muted)' }}>
              Database updated successfully. Master lists synchronized and changes are live.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full max-w-md">
            {[
              { label: 'Inserted', value: summary.inserted, color: 'var(--success)', bg: 'var(--success-light)' },
              { label: 'Updated', value: summary.updated, color: 'var(--accent)', bg: 'var(--accent-light)' },
              { label: 'Removed', value: summary.removed, color: 'var(--danger)', bg: 'var(--danger-light)' },
            ].map(s => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-[24px] font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[11px] mt-1 uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {summary.unmappedSupervisors && summary.unmappedSupervisors.length > 0 && (
            <div className="card p-5 w-full max-w-md text-left" style={{ borderColor: 'var(--warning)' }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" style={{ color: 'var(--warning)' }} />
                <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {summary.unmappedSupervisors.length} Supervisor Name(s) Not Found
                </p>
              </div>
              <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
                These routes were imported without a supervisor because the name below does not match any existing account. Create the supervisor on the{' '}
                <a href="/admin/supervisors" className="font-semibold underline" style={{ color: 'var(--accent)' }}>Supervisors page</a>{' '}
                using the exact name — their routes and outlets will be linked automatically.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {summary.unmappedSupervisors.map((name) => (
                  <span key={name} className="badge badge-warning">{name}</span>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleReset} className="btn-ghost">
            Import New Masters
          </button>
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
