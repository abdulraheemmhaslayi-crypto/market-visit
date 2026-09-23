'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import NoVisitsView from '@/components/no-visits/no-visits-view';
import { isFleetRole } from '@/lib/roles';

export default function SupervisorNoVisitsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isFleetRole((session?.user as any)?.role)) {
      router.replace('/supervisor');
    }
  }, [session, router]);

  return <NoVisitsView role="supervisor" />;
}
