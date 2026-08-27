'use client';

import React from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';

interface ExportButtonProps {
  onClick: () => void;
  label?: string;
  variant?: 'default' | 'compact' | 'iconOnly' | 'outline' | 'ghost';
  title?: string;
  disabled?: boolean;
  className?: string;
}

export function ExportButton({
  onClick,
  label = 'Export',
  variant = 'compact',
  title = 'Export data to Excel (.xlsx)',
  disabled = false,
  className = '',
}: ExportButtonProps) {
  if (variant === 'iconOnly') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        disabled={disabled}
        className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'outline') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        disabled={disabled}
        className={`inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-2)] hover:border-[var(--accent)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <Download className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'ghost') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-light)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-white px-3.5 py-2 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${className}`}
    >
      <FileSpreadsheet className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

export default ExportButton;
