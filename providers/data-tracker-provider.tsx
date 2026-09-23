'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { initClientDataTracker } from '@/lib/client-data-tracker';

export function DataTrackerProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      const user = session.user as any;
      initClientDataTracker({
        id: user.id || user.email || 'unknown_user',
        name: user.name || user.email || 'Supervisor',
        role: user.role || 'Supervisor',
        managerId: user.managerId || null,
      });
    }
  }, [session?.user]);

  return <>{children}</>;
}
