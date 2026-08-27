'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supervisorSchema, SupervisorInput } from '@/schemas/supervisor';
import {
  getSupervisorsAction,
  createSupervisorAction,
  updateSupervisorAction,
  disableSupervisorAction,
} from '@/actions/supervisor-actions';
import { useToast } from '@/components/ui/toast';
import { ConfirmationDialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FormErrorBanner } from '@/components/ui/form-error-banner';
import { formatFriendlyError, FormattedError } from '@/lib/error-formatter';
import { useSession } from 'next-auth/react';
import { canModifyMasterData } from '@/lib/roles';
import {
  Search, UserPlus, Edit2, UserX, X,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight,
  Users, RefreshCw, Shield, Mail, Phone, Lock,
} from 'lucide-react';
import { exportToExcel } from '@/utils/excelExport';
import { ExportButton } from '@/components/ui/ExportButton';

interface SupervisorVM {
  id: string; name: string; employeeCode: string; email: string;
  mobile: string; role: 'GM' | 'BDM' | 'Sales Manager' | 'Admin' | 'Sub-Admin' | 'Supervisor' | 'Fleet' | 'Maintenance'; status: 'Active' | 'Inactive'; createdAt: string;
}

function FormField({ label, error, children }: { label: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label mb-1">{label}</label>
      {children}
      {error && <p className="text-[11px] mt-1 font-semibold" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}

export default function SupervisorsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const canEdit = canModifyMasterData(userRole);
  const { showToast } = useToast();
  const [supervisors, setSupervisors] = useState<SupervisorVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<FormattedError | null>(null);
  const [editingSupervisor, setEditingSupervisor] = useState<SupervisorVM | null>(null);
  const [disableDialog, setDisableDialog] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchSupervisors = async () => {
    setLoading(true);
    try {
      setSupervisors((await getSupervisorsAction()) as SupervisorVM[]);
    } catch (err: any) {
      const formatted = formatFriendlyError(err);
      showToast(formatted.message, 'error', formatted.title);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSupervisors(); }, []);

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<SupervisorInput>({
    resolver: zodResolver(supervisorSchema),
    defaultValues: { name: '', employeeCode: '', email: '', password: '', mobile: '', role: 'Supervisor', status: 'Active' },
  });

  const openCreate = () => {
    setEditingSupervisor(null);
    setFormError(null);
    reset({ name: '', employeeCode: '', email: '', password: '', mobile: '', role: 'Supervisor', status: 'Active' });
    setModalOpen(true);
  };

  const openEdit = (sup: SupervisorVM) => {
    setEditingSupervisor(sup);
    setFormError(null);
    reset({ name: sup.name, employeeCode: sup.employeeCode, email: sup.email, password: '', mobile: sup.mobile, role: sup.role, status: sup.status });
    setModalOpen(true);
  };

  const onSubmit = async (data: SupervisorInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      let result;
      if (editingSupervisor) {
        result = await updateSupervisorAction(editingSupervisor.id, data);
      } else {
        if (!data.password?.trim()) {
          const err = formatFriendlyError('Password is required for a new supervisor account.');
          setFormError(err);
          setError('password', { type: 'manual', message: err.message });
          showToast(err.message, 'error', err.title);
          setSubmitting(false);
          return;
        }
        result = await createSupervisorAction(data);
      }

      if (!result.success) {
        const formatted = formatFriendlyError(result.error);
        setFormError(formatted);
        if (result.field) {
          setError(result.field as any, { type: 'manual', message: formatted.message });
        }
        showToast(formatted.message, 'error', formatted.title);
        return;
      }

      showToast(
        result.backfilledRoutes && result.backfilledRoutes > 0
          ? `Supervisor created. Linked ${result.backfilledRoutes} previously-unmapped route(s) to this account.`
          : editingSupervisor ? 'Supervisor updated.' : 'Supervisor created.',
        'success'
      );
      setModalOpen(false);
      fetchSupervisors();
    } catch (e: any) {
      const formatted = formatFriendlyError(e);
      setFormError(formatted);
      showToast(formatted.message, 'error', formatted.title);
    } finally { setSubmitting(false); }
  };

  const handleDisable = async () => {
    try {
      const res = await disableSupervisorAction(disableDialog.id);
      if (!res.success) {
        const formatted = formatFriendlyError(res.error);
        showToast(formatted.message, 'error', formatted.title);
        return;
      }
      showToast(`Disabled: ${disableDialog.name}`, 'success');
      setDisableDialog({ open: false, id: '', name: '' });
      fetchSupervisors();
    } catch (e: any) {
      const formatted = formatFriendlyError(e);
      showToast(formatted.message, 'error', formatted.title);
    }
  };

  const filtered = supervisors.filter((sup) => {
    const supUpper = (sup.name || '').toUpperCase().trim();
    if (supUpper === 'INTERNAL' || supUpper === 'SAMRA') return false;
    const q = search.toLowerCase();
    return (sup.name.toLowerCase().includes(q) || sup.employeeCode.toLowerCase().includes(q) || sup.email.toLowerCase().includes(q)) &&
      (statusFilter === 'All' || sup.status === statusFilter);
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  const activeCount = supervisors.filter(s => s.status === 'Active').length;
  const inactiveCount = supervisors.filter(s => s.status === 'Inactive').length;

  const inputCls = 'form-input';

  const handleExportSupervisors = () => {
    exportToExcel({
      filename: `supervisors_master_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Supervisors',
      title: 'Field Supervisors Master Directory',
      filterSummary: search ? `Search: "${search}" | Status: ${statusFilter}` : `Status: ${statusFilter}`,
      columns: [
        { header: 'Employee Code', key: 'employeeCode' },
        { header: 'Full Name', key: 'name' },
        { header: 'Role', key: 'role' },
        { header: 'Email Address', key: 'email' },
        { header: 'Mobile Number', key: 'mobile' },
        { header: 'Account Status', key: 'status' },
        { header: 'Creation Date', key: 'createdAt', formatter: (val) => val ? new Date(val).toLocaleDateString('en-IN') : '—' },
      ],
      data: filtered,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Supervisors Management
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Manage field team credentials, roles, and account status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExportSupervisors} label="Export Excel" variant="outline" />
          {canEdit ? (
            <button className="btn-primary" onClick={openCreate}>
              <UserPlus className="h-3.5 w-3.5" />
              Add Supervisor
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="h-3.5 w-3.5" /> Read-Only Mode (Sub-Admin)
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: supervisors.length, color: 'var(--accent)', bg: 'var(--accent-light)' },
          { label: 'Active', value: activeCount, color: 'var(--success)', bg: 'var(--success-light)' },
          { label: 'Inactive', value: inactiveCount, color: 'var(--text-muted)', bg: 'var(--surface-2)' },
        ].map(stat => (
          <div key={stat.label} className="card p-4 flex items-center gap-3">
            <div className="icon-wrap h-9 w-9 rounded-lg" style={{ background: stat.bg }}>
              <Users className="h-4 w-4" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-[20px] font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{loading ? '—' : stat.value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name, email, or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {['All', 'Active', 'Inactive'].map((s) => (
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
                {['Supervisor', 'Employee Code', 'Mobile', 'Role', 'Status', 'Joined', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 ${i === 6 ? 'text-right' : 'text-left'}`}
                    style={{
                      fontSize: '10px', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: 'var(--text-muted)', whiteSpace: 'nowrap',
                      background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    No supervisors matched your filters.
                  </td>
                </tr>
              ) : (
                paginated.map((sup) => (
                  <tr
                    key={sup.id}
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    className="transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                          style={{ background: sup.status === 'Active' ? 'var(--accent)' : 'var(--text-muted)' }}
                        >
                          {sup.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{sup.name}</p>
                          <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <Mail className="h-2.5 w-2.5" />{sup.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[12px] px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                        {sup.employeeCode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      {sup.mobile || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                        {sup.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${sup.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                        {sup.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(sup.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {canEdit ? (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(sup)} className="btn-ghost p-1.5" title="Edit Supervisor">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {sup.status === 'Active' && (
                            <button
                              onClick={() => setDisableDialog({ open: true, id: sup.id, name: sup.name })}
                              className="btn-ghost p-1.5 text-red-400 hover:text-red-500"
                              title="Disable Account"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)] italic font-medium">Read Only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Page {currentPage} of {totalPages} · {filtered.length} total</span>
            <div className="flex items-center gap-1">
              {[
                { icon: ChevronsLeft, action: () => setCurrentPage(1), disabled: currentPage === 1 },
                { icon: ChevronLeft, action: () => setCurrentPage(p => Math.max(p - 1, 1)), disabled: currentPage === 1 },
                { icon: ChevronRight, action: () => setCurrentPage(p => Math.min(p + 1, totalPages)), disabled: currentPage === totalPages },
                { icon: ChevronsRight, action: () => setCurrentPage(totalPages), disabled: currentPage === totalPages },
              ].map(({ icon: Icon, action, disabled }, i) => (
                <button key={i} onClick={action} disabled={disabled} className="btn-ghost"
                  style={{ height: '32px', padding: '0 10px', opacity: disabled ? 0.4 : 1 }}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div
            className="relative w-full max-w-md animate-slide-up overflow-hidden"
            style={{
              background: 'var(--surface)', borderRadius: '16px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-dropdown)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editingSupervisor ? 'Edit Supervisor' : 'Add Supervisor'}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn-ghost" style={{ height: '32px', width: '32px', padding: 0, justifyContent: 'center' }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <FormErrorBanner error={formError} onClear={() => setFormError(null)} />

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Name" error={errors.name?.message}>
                  <input type="text" placeholder="John Doe" disabled={submitting} {...register('name')} className={inputCls} />
                </FormField>
                <FormField label="Employee Code" error={errors.employeeCode?.message}>
                  <input type="text" placeholder="SUP001" disabled={submitting} {...register('employeeCode')} className={inputCls} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email" error={errors.email?.message}>
                  <input type="email" placeholder="sup@company.com" disabled={submitting} {...register('email')} className={inputCls} />
                </FormField>
                <FormField label="Mobile" error={errors.mobile?.message}>
                  <input type="text" placeholder="9876543210" disabled={submitting} {...register('mobile')} className={inputCls} />
                </FormField>
              </div>
              <FormField
                label={<>Password {editingSupervisor && <span className="normal-case ml-1" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(blank = keep current)</span>}</>}
                error={errors.password?.message}
              >
                <input type="password" placeholder="••••••••" disabled={submitting} {...register('password')} className={inputCls} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Role" error={errors.role?.message}>
                  <select disabled={submitting} {...register('role')} className={inputCls}>
                    <option value="Supervisor">Supervisor</option>
                    <option value="GM">GM</option>
                    <option value="BDM">BDM</option>
                    <option value="Sales Manager">Sales Manager</option>
                    <option value="Admin">Admin</option>
                    <option value="Sub-Admin">Sub-Admin</option>
                    <option value="Fleet">Fleet</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </FormField>
                <FormField label="Status" error={errors.status?.message}>
                  <select disabled={submitting} {...register('status')} className={inputCls}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </FormField>
              </div>

              <div className="flex justify-end gap-2.5 pt-2" style={{ borderTop: '1px solid var(--border-soft)' }}>
                <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {editingSupervisor ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={disableDialog.open}
        onClose={() => setDisableDialog({ open: false, id: '', name: '' })}
        onConfirm={handleDisable}
        title="Disable Supervisor Account"
        description={`Disable the account for ${disableDialog.name}? They will no longer be able to log in or submit visits.`}
        confirmText="Disable Account"
        variant="danger"
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
