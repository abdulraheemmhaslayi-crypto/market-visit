import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CANONICAL_DOMAIN = 'dclfvs.cypherone.qa';

function getPublicOrigin(request: Request): string {
  let host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('x-original-host') ||
    request.headers.get('host') ||
    CANONICAL_DOMAIN;

  if (host && host.includes(',')) {
    host = host.split(',')[0].trim();
  }
  if (host && (host.includes('azurewebsites.net') || host.includes('dandyapp.tech'))) {
    host = CANONICAL_DOMAIN;
  }

  const proto =
    request.headers.get('x-forwarded-proto') ||
    (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');

  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  try {
    const origin = getPublicOrigin(request);
    const { searchParams } = new URL(request.url);
    const error = searchParams.get('error') || 'CredentialsSignin';
    const callbackUrl = searchParams.get('callbackUrl');

    const redirectUrl = new URL('/login', origin);
    redirectUrl.searchParams.set('error', error);
    if (callbackUrl) {
      redirectUrl.searchParams.set('callbackUrl', callbackUrl);
    }

    return NextResponse.redirect(redirectUrl, 302);
  } catch {
    const origin = getPublicOrigin(request);
    return NextResponse.redirect(new URL('/login', origin), 302);
  }
}

export async function POST(request: Request) {
  return GET(request);
}
