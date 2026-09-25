import React from 'react';
import DataUsageDashboard from '@/components/data-usage/DataUsageDashboard';

export const metadata = {
  title: 'Data Usage Tracker - Supervisor Portal',
  description: 'Track daily mobile data usage and network performance for supervisor field operations.',
};

export default function SupervisorDataUsagePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <DataUsageDashboard portalType="supervisor" />
    </div>
  );
}
