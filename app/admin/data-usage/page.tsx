import React from 'react';
import DataUsageDashboard from '@/components/data-usage/DataUsageDashboard';

export const metadata = {
  title: 'Data Usage Tracker - Admin Portal',
  description: 'Monitor daily internet and network data consumption across users and modules.',
};

export default function AdminDataUsagePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <DataUsageDashboard portalType="admin" />
    </div>
  );
}
