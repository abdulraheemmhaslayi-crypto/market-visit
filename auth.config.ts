import type { NextAuthConfig } from 'next-auth';
import { canAccessAdminRoute, canAccessSupervisorRoute, isFullAccessRole, isSupervisorRole } from '@/lib/roles';

const CANONICAL_DOMAIN = 'dclfvs.cypherone.qa';
const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_HOSTNAME);

if (isProd && (!process.env.AUTH_URL || process.env.AUTH_URL.includes('azurewebsites.net') || process.env.AUTH_URL.includes('dandyapp.tech'))) {
  process.env.AUTH_URL = `https://${CANONICAL_DOMAIN}`;
  process.env.NEXTAUTH_URL = `https://${CANONICAL_DOMAIN}`;
} else if (process.env.AUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.AUTH_URL;
} else if (process.env.NEXTAUTH_URL) {
  process.env.AUTH_URL = process.env.NEXTAUTH_URL;
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
    request?.headers?.get?.('x-original-host') ||
    request?.headers?.get?.('host') ||
    nextUrl?.host ||
    CANONICAL_DOMAIN;
  if (host && host.includes(',')) {
    host = host.split(',')[0].trim();
  }
  if (host && (host.includes('azurewebsites.net') || host.includes('dandyapp.tech'))) {
    host = CANONICAL_DOMAIN;
  }
  let proto =
    request?.headers?.get?.('x-forwarded-proto') ||
    (host && (host.includes('localhost') || host.includes('127.0.0.1')) ? 'http' : 'https');
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
    async redirect({ url, baseUrl }) {
      // 1. If relative URL, prepend canonical domain or baseUrl
      if (url.startsWith('/')) {
        const base = baseUrl.includes('azurewebsites.net') || baseUrl.includes('dandyapp.tech')
          ? `https://${CANONICAL_DOMAIN}`
          : baseUrl;
        return `${base}${url}`;
      }

      // 2. If url has azurewebsites.net or dandyapp.tech, rewrite to canonical domain
      try {
        const parsed = new URL(url);
        if (parsed.host.includes('azurewebsites.net') || parsed.host.includes('dandyapp.tech')) {
          parsed.protocol = 'https:';
          parsed.host = CANONICAL_DOMAIN;
          return parsed.toString();
        }
        if (parsed.origin === baseUrl || parsed.host === CANONICAL_DOMAIN || parsed.host.includes('localhost')) {
          return url;
        }
      } catch {}

      return `https://${CANONICAL_DOMAIN}`;
    },
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
        const loginUrl = getTargetUrl('/login', nextUrl, request);
        if (nextUrl.pathname && nextUrl.pathname !== '/') {
          loginUrl.searchParams.set('callbackUrl', nextUrl.pathname + nextUrl.search);
        }
        return Response.redirect(loginUrl);
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
