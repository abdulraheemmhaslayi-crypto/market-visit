import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  // Guard admin, supervisor, and the home page. Exclude static assets, public paths, and NextAuth routes
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|login|manifest.json|manifest.webmanifest|sw.js|offline|icon-).*)',
  ],
};
