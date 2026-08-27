import type { Metadata, Viewport } from 'next';
import { Inter, Calistoga, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/components/ui/toast';
import QueryProvider from '@/providers/query-provider';
import { SessionProvider } from 'next-auth/react';
import PWARegister from '@/components/pwa-register';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const calistoga = Calistoga({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: '400',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Supervisor Field Visit Management',
  description: 'Enterprise Audit and NPD Checking Tool for Supervisor Field Operations.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Supervisor FVM',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.variable} ${calistoga.variable} ${jetbrainsMono.variable} antialiased h-full`} suppressHydrationWarning>
        <PWARegister />
        <SessionProvider>
          <QueryProvider>
            <ThemeProvider>
              <ToastProvider>{children}</ToastProvider>
            </ThemeProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
export type RootLayoutProps = {
  children: React.ReactNode;
};
