'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@/schemas/auth';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { Eye, EyeOff, ShieldAlert, Lock, Mail, ChevronRight } from 'lucide-react';

import { checkResetPasswordEmailAction, resetAdminPasswordAction } from '@/actions/auth-actions';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmpCode, setResetEmpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleCloseForgot = () => {
    setForgotOpen(false);
    setForgotStep(1);
    setResetEmail('');
    setResetEmpCode('');
    setNewPassword('');
    setResetLoading(false);
    setResetError(null);
    setResetMessage(null);
  };

  const handleVerifyEmail = async () => {
    setResetLoading(true);
    setResetError(null);
    try {
      const res = await checkResetPasswordEmailAction(resetEmail);
      if (!res.success) {
        setResetError(res.error || 'Failed to verify email.');
      } else if (!res.allowed) {

        setResetMessage(res.message || 'Supervisors cannot reset password.');
        setForgotStep(2);
      } else {
        setForgotStep(2);
      }
    } catch (err: any) {
      setResetError(err.message || 'An error occurred.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setResetLoading(true);
    setResetError(null);
    try {
      const res = await resetAdminPasswordAction(resetEmail, resetEmpCode, newPassword);
      if (!res.success) {
        setResetError(res.error || 'Failed to reset password.');
      } else {
        showToast(res.message || 'Password reset successfully.', 'success');
        handleCloseForgot();
      }
    } catch (err: any) {
      setResetError(err.message || 'An error occurred.');
    } finally {
      setResetLoading(false);
    }
  };

  // Check searchParams for status errors (e.g. inactive)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'Inactive') {
      setErrorMsg('Your account is currently disabled. Please contact your administrator.');
      showToast('Your account is inactive.', 'error');
    }
  }, [searchParams, showToast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (res?.error) {
        let msg = 'Invalid email or password.';
        if (res.error.includes('inactive')) {
          msg = 'Your account is inactive. Please contact the administrator.';
        } else if (res.error.includes('No user found')) {
          msg = 'No supervisor account matches this email.';
        }
        setErrorMsg(msg);
        showToast(msg, 'error');
      } else {
        showToast('Login successful! Redirecting...', 'success');
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      showToast('Login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#F8FAFC] dark:bg-slate-950 relative overflow-hidden select-none animate-fade-in">

      {/* Decorative ambient radial glows in background */}
      <div className="absolute top-[-10%] right-[-10%] h-[450px] w-[450px] rounded-full bg-[#0284c7]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[450px] w-[450px] rounded-full bg-[#e11d48]/10 blur-[130px] pointer-events-none" />

      {/* Login Container: full screen on mobile, styled card on desktop */}
      <div
        className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-[#E2E8F0] dark:border-slate-800 p-6 sm:p-8 z-10 transition-all duration-300 relative max-md:border-none max-md:bg-transparent max-md:shadow-none max-md:px-4"
        style={{
          borderRadius: '28px',
          boxShadow: '0 20px 45px -15px rgba(2, 132, 199, 0.12), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div className="flex flex-col items-center mb-6 max-md:mb-5">
          {/* Official Dandy Brand Logo */}
          <div className="relative mb-4 p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700/80 group transition-all duration-300 hover:shadow-lg hover:border-sky-300 dark:hover:border-sky-500">
            <img
              src="/images/dandy-logo.png"
              alt="Dandy Logo"
              className="h-16 sm:h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-sm"
            />
          </div>

          {/* Authentication pill badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0284c7]/30 bg-[#F0F9FF] dark:bg-sky-950/30 px-3.5 py-1.5 mb-3">
            <span className="h-2 w-2 rounded-full bg-[#0284c7] animate-pulse" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] font-bold text-[#0284c7] dark:text-sky-400">
              Dandy Secure Portal
            </span>
          </div>

          <h1 className="text-[26px] max-md:text-[22px] font-black tracking-tight text-gray-900 dark:text-white text-center leading-none">
            Field Visit <span className="text-[#0284c7]">Management</span>
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-[12.5px] mt-2 text-center max-w-[310px] leading-normal font-medium">
            Enter supervisor or administrator credentials to access your console.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 flex items-start gap-2.5 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-[#EF4444] rounded-2xl text-[13px] leading-relaxed font-semibold">
            <ShieldAlert className="h-4.5 w-4.5 flex-shrink-0 mt-0.5 text-[#EF4444]" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4.5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
              Email / Login ID
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">
                <Mail className="h-5 w-5" />
              </span>
              <input
                id="email"
                type="email"
                placeholder="name@dandy.com"
                disabled={loading}
                {...register('email')}
                className="w-full pl-11 pr-4 bg-white dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-800 rounded-2xl text-gray-900 dark:text-white text-[14px] outline-none transition-all placeholder:text-gray-400/70 focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 disabled:opacity-50"
                style={{ height: '52px' }}
              />
            </div>
            {errors.email && (
              <p className="text-[#EF4444] text-[12px] font-semibold mt-1 ml-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center pl-1 pr-1">
              <label htmlFor="password" className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-[11px] font-bold text-[#0284c7] hover:text-[#0369a1] transition-all cursor-pointer bg-transparent border-none"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">
                <Lock className="h-5 w-5" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                disabled={loading}
                {...register('password')}
                className="w-full pl-11 pr-11 bg-white dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-800 rounded-2xl text-gray-900 dark:text-white text-[14px] outline-none transition-all placeholder:text-gray-400/70 focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 disabled:opacity-50"
                style={{ height: '52px' }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[#EF4444] text-[12px] font-semibold mt-1 ml-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#0284c7] to-[#0066b2] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-bold text-[13px] tracking-wider uppercase rounded-2xl shadow-[0_4px_18px_rgba(2,132,199,0.35)] hover:shadow-[0_6px_24px_rgba(2,132,199,0.45)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            style={{ height: '52px' }}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ChevronRight className="h-4.5 w-4.5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Forgot Password Modal Dialog */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-solid border-[#E2E8F0] dark:border-slate-800 overflow-hidden p-6 space-y-4 animate-scale-up"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-[#5B5CEB]">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-white">Reset Password</h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Account verification wizard</p>
              </div>
            </div>

            {forgotStep === 1 && (
              <div className="space-y-4">
                <p className="text-[12px] text-gray-600 dark:text-slate-300 leading-relaxed">
                  Enter your registered Email ID to verify your supervisor or administrator role permissions.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full px-3.5 bg-white dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-800 rounded-xl text-gray-900 dark:text-white text-[13px] outline-none transition-all focus:border-[#5B5CEB]"
                    style={{ height: '44px' }}
                  />
                </div>

                {resetError && (
                  <p className="text-[#EF4444] text-[11px] font-semibold">{resetError}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseForgot}
                    className="px-4 py-2 text-[12px] font-bold text-gray-500 hover:text-gray-700 transition-all cursor-pointer bg-transparent border-none"
                    disabled={resetLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyEmail}
                    disabled={resetLoading || !resetEmail}
                    className="px-4 py-2 text-[12px] font-bold bg-[#5B5CEB] text-white rounded-xl hover:bg-[#4C4BCE] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {resetLoading ? 'Verifying...' : 'Next'}
                  </button>
                </div>
              </div>
            )}

            {forgotStep === 2 && (
              <div className="space-y-4">
                {resetMessage ? (
                  // Supervisor warning message
                  <div className="space-y-4">
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-[12px] leading-relaxed text-amber-700 dark:text-amber-400 font-medium">
                      {resetMessage}
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleCloseForgot}
                        className="px-5 py-2 text-[12px] font-bold bg-[#5B5CEB] text-white rounded-xl hover:bg-[#4C4BCE] transition-all cursor-pointer"
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                ) : (
                  // Admin verified - Reset password inputs
                  <div className="space-y-3.5">
                    <p className="text-[12px] text-gray-600 dark:text-slate-300 leading-relaxed">
                      Email verified. Please enter your administrator verification details and your new password.
                    </p>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                        Employee Code (Verification)
                      </label>
                      <input
                        type="text"
                        value={resetEmpCode}
                        onChange={(e) => setResetEmpCode(e.target.value)}
                        placeholder="EMP101"
                        className="w-full px-3.5 bg-white dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-800 rounded-xl text-gray-900 dark:text-white text-[13px] outline-none transition-all focus:border-[#5B5CEB]"
                        style={{ height: '44px' }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 bg-white dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-800 rounded-xl text-gray-900 dark:text-white text-[13px] outline-none transition-all focus:border-[#5B5CEB]"
                        style={{ height: '44px' }}
                      />
                    </div>

                    {resetError && (
                      <p className="text-[#EF4444] text-[11px] font-semibold">{resetError}</p>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setForgotStep(1)}
                        className="px-4 py-2 text-[12px] font-bold text-gray-500 hover:text-gray-700 transition-all cursor-pointer bg-transparent border-none"
                        disabled={resetLoading}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={resetLoading || !resetEmpCode || !newPassword}
                        className="px-4 py-2 text-[12px] font-bold bg-[#5B5CEB] text-white rounded-xl hover:bg-[#4C4BCE] transition-all cursor-pointer disabled:opacity-50"
                      >
                        {resetLoading ? 'Resetting...' : 'Reset Password'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-slate-900 text-gray-700 dark:text-white font-bold text-sm">
        Loading Sign In...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
