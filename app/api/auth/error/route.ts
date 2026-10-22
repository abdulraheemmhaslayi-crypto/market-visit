import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getPublicOrigin(request: Request): string {
  let host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'dandyapp.tech';

  if (host && host.includes(',')) {
    host = host.split(',')[0].trim();
  }
  if (host && host.includes('azurewebsites.net')) {
    host = 'dandyapp.tech';
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
