'use client';

import React from 'react';
import { AlertCircle, X, HelpCircle } from 'lucide-react';
import { FormattedError } from '@/lib/error-formatter';

interface FormErrorBannerProps {
  error: FormattedError | string | null;
  onClear?: () => void;
  className?: string;
}

export function FormErrorBanner({ error, onClear, className = '' }: FormErrorBannerProps) {
  if (!error) return null;

  const formatted: FormattedError =
    typeof error === 'string'
      ? { title: 'Action Failed', message: error }
      : error;

  return (
    <div
      className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all duration-200 ${className}`}
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.25)',
        color: 'var(--danger, #ef4444)',
      }}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">
        <AlertCircle className="h-5 w-5" style={{ color: '#ef4444' }} />
      </div>

      <div className="flex-grow min-w-0">
        <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1.5" style={{ color: '#dc2626' }}>
          {formatted.title}
        </h4>
        <p className="text-xs font-medium leading-relaxed opacity-90 break-words" style={{ color: 'var(--text-primary)' }}>
          {formatted.message}
        </p>

        {formatted.actionHint && (
          <div className="mt-2 text-[11px] pt-1.5 border-t border-red-200/40 dark:border-red-900/40 flex items-center gap-1.5 opacity-80" style={{ color: 'var(--text-muted)' }}>
            <HelpCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
            <span>{formatted.actionHint}</span>
          </div>
        )}
      </div>

      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-500/10 text-red-500"
          title="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
