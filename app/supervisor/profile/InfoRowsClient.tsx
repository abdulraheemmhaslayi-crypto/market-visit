"use client";

import React from 'react';
import { Mail, Phone, Calendar, UserCheck } from 'lucide-react';

type Row = {
  icon: 'Mail' | 'Phone' | 'Calendar' | 'UserCheck' | string;
  color: string;
  bg: string;
  label: string;
  value: string;
};

export default function InfoRowsClient({ rows }: { rows: Row[] }) {
  const iconMap: Record<string, any> = { Mail, Phone, Calendar, UserCheck };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 p-4 sm:p-5" style={{ background: 'var(--surface)' }}>
      {rows.map((r) => {
        const Icon = iconMap[r.icon] ?? (() => null);
        const isPrivileges = r.label === 'Privileges';
        return (
          <div
            key={r.label}
            className={`flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl border border-solid border-[var(--border-soft)] transition-all duration-200 hover:shadow-sm hover:border-[var(--border)] ${
              isPrivileges ? 'sm:col-span-2' : ''
            }`}
            style={{
              background: 'var(--surface-2)',
            }}
          >
            <div className="icon-wrap h-9 w-9 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: r.bg }}>
              <Icon className="h-4.5 w-4.5" style={{ color: r.color }} />
            </div>
            <div className="min-w-0">
              <p className="form-label mb-1 text-[10px] tracking-wider" style={{ color: 'var(--text-muted)' }}>{r.label}</p>
              <p className="text-[13px] font-bold leading-relaxed" style={{ color: 'var(--text-primary)' }}>{r.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
