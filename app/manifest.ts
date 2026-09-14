import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Supervisor Field Visit Management',
    short_name: 'Supervisor FVM',
    description: 'Enterprise Audit and NPD Checking Tool for Supervisor Field Operations.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F6FA',
    theme_color: '#4F46E5',
    orientation: 'any',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
