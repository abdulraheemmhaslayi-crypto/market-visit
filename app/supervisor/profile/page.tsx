import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { userRepository } from '@/repositories/user-repository';
import { isFleetRole } from '@/lib/roles';
import { LogOut, Shield } from 'lucide-react';
import InfoRowsClient from './InfoRowsClient';
import BackHeader from '@/app/supervisor/components/BackHeader';

export default async function SupervisorProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const sessionUser = session.user as any;
  if (isFleetRole(sessionUser.role)) redirect('/supervisor');
  const user = await userRepository.getUserByEmail(sessionUser.email);

  if (!user) {
    return (
      <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
        Profile data unavailable.
      </div>
    );
  }

  const initial = user.name.charAt(0).toUpperCase();

  return (
    <div className="mx-auto px-3 sm:px-6 max-w-2xl space-y-3 pb-6 animate-fade-in">
      <BackHeader title="Profile" hideBack />

      {/* Unified Profile Card */}
      <div className="card overflow-hidden transition-all duration-300 hover:shadow-md">
        {/* Gradient header banner */}
        <div
          className="h-24 sm:h-28 relative"
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)' }}
        >
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-200 via-violet-600 to-indigo-900 pointer-events-none" />
        </div>

        {/* Avatar & Core Metadata (with a circular floating style) */}
        <div className="px-4 pb-4 -mt-8 sm:-mt-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center text-[22px] sm:text-[28px] font-bold text-white relative z-10"
              style={{
                background: 'var(--surface)',
                border: '4px solid var(--surface)',
                boxShadow: 'var(--shadow-dropdown)',
                backgroundImage: 'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)',
              }}
            >
              {initial}
            </div>
            <div className="space-y-0.5">
              <h2 className="text-[18px] sm:text-[18px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{user.name}</h2>
              <p className="font-mono text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Employee ID: {user.employeeCode}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`badge ${user.role === 'Admin' ? 'badge-accent' : 'badge-success'} font-bold uppercase tracking-wider text-[10px]`}>{user.role}</span>
            <span className={`badge ${user.status === 'Active' ? 'badge-success' : 'badge-warning'} font-bold uppercase tracking-wider text-[10px]`}>{user.status}</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="border-t border-solid border-[var(--border-soft)]">
          <InfoRowsClient
            rows={[
              { icon: 'Mail', color: 'var(--accent)', bg: 'var(--accent-light)', label: 'Email Address', value: user.email },
              { icon: 'Phone', color: '#059669', bg: '#ECFDF5', label: 'Mobile Number', value: user.mobile || 'Not configured' },
              { icon: 'Calendar', color: '#D97706', bg: '#FFFBEB', label: 'Member Since', value: new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) },
              { icon: 'UserCheck', color: '#7C3AED', bg: '#F5F3FF', label: 'Privileges', value: 'Route selection · Image capture · Temperature checks · SKU checklists' },
            ]}
          />
        </div>

        {/* Security & Action Footer (side-by-side on desktop, stacked on mobile) */}
        <div className="p-4 sm:p-5 bg-[var(--surface-2)] border-t border-solid border-[var(--border-soft)] flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
          <div className="flex items-start gap-3 max-w-md">
            <Shield className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
            <div>
              <p className="form-label mb-0.5 text-[9px]">Account Security</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Your supervisor console session is protected. Please contact the administrator to modify permissions or update credentials.
              </p>
            </div>
          </div>

          <form action="/api/auth/signout" method="POST" className="flex-shrink-0 w-full md:w-auto">
            <button
              type="submit"
              className="w-full px-5 py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              style={{
                background: 'var(--danger-light)',
                color: 'var(--danger)',
                border: '1px solid rgba(220,38,38,0.15)',
              }}
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
