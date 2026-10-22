import type { NextAuthConfig } from 'next-auth';
import { canAccessAdminRoute, canAccessSupervisorRoute, isFullAccessRole, isSupervisorRole } from '@/lib/roles';

const azureHost =
  process.env.WEBSITE_HOSTNAME ||
  (process.env.NODE_ENV === 'production' && !process.env.AUTH_URL
    ? 'fields-visit-system-bccyaue6cyadaeh9.centralindia-01.azurewebsites.net'
    : null);

if (azureHost) {
  process.env.AUTH_URL = `https://${azureHost}`;
  process.env.NEXTAUTH_URL = `https://${azureHost}`;
}

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET || 'antigravity_secret_key_123_abc_xyz_secret_999_dandy_secure';
}
if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = process.env.AUTH_SECRET;
}
process.env.AUTH_TRUST_HOST = 'true';

function getTargetUrl(path: string, nextUrl: URL, request?: any) {
  let host =
    request?.headers?.get?.('x-forwarded-host') ||
    azureHost ||
    nextUrl.host;
  if (host && host.includes(',')) {
    host = host.split(',')[0].trim();
  }
  let proto =
    request?.headers?.get?.('x-forwarded-proto') ||
    (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
  if (proto && proto.includes(',')) {
    proto = proto.split(',')[0].trim();
  }
  return new URL(path, `${proto}://${host}`);
}

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'antigravity_secret_key_123_abc_xyz_secret_999',
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const nextUrl = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const user = auth?.user as any;
      const userRole = user?.role as string | undefined;
      const isAuthRoute = nextUrl.pathname.startsWith('/login');
      const isAdminRoute = nextUrl.pathname.startsWith('/admin');
      const isSupervisorRoute = nextUrl.pathname.startsWith('/supervisor');

      // Exclude API routes and uploaded images from middleware redirect logic so handlers run freely
      if (nextUrl.pathname.startsWith('/api') || nextUrl.pathname.startsWith('/uploads')) {
        return true;
      }

      if (isAuthRoute) {
        if (isLoggedIn) {
          if (user?.status !== 'Active') {
            return true;
          }
          const destination = canAccessAdminRoute(userRole)
            ? '/admin'
            : isSupervisorRole(userRole)
              ? '/supervisor/visit'
              : '/supervisor';
          return Response.redirect(getTargetUrl(destination, nextUrl, request));
        }
        return true;
      }

      if (!isLoggedIn) {
        return false;
      }

      if (user?.status !== 'Active') {
        const url = getTargetUrl('/login', nextUrl, request);
        url.searchParams.set('error', 'Inactive');
        return Response.redirect(url);
      }

      if (isAdminRoute && !canAccessAdminRoute(userRole)) {
        const destination = isSupervisorRole(userRole) ? '/supervisor/visit' : '/supervisor';
        return Response.redirect(getTargetUrl(destination, nextUrl, request));
      }

      if (isSupervisorRoute && !canAccessSupervisorRoute(userRole)) {
        return Response.redirect(getTargetUrl('/admin', nextUrl, request));
      }

      if (isSupervisorRoute && isFullAccessRole(userRole)) {
        return Response.redirect(getTargetUrl('/admin', nextUrl, request));
      }

      if (nextUrl.pathname === '/') {
        const destination = canAccessAdminRoute(userRole)
          ? '/admin'
          : isSupervisorRole(userRole)
            ? '/supervisor/visit'
            : '/supervisor';
        return Response.redirect(getTargetUrl(destination, nextUrl, request));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.id = u.id;
        token.role = u.role;
        token.employeeCode = u.employeeCode;
        token.status = u.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as any;
        (session.user as any).employeeCode = token.employeeCode as string;
        (session.user as any).status = token.status as any;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
