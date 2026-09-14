"use client";

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BackHeader({ title, hideBack = false }: { title?: string; hideBack?: boolean }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 mb-2">
      {!hideBack && (
        <button
          onClick={() => router.back()}
          className="h-9 w-9 rounded-lg flex items-center justify-center"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      {title && <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>}
    </div>
  );
}
