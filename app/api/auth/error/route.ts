import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const error = searchParams.get('error') || 'CredentialsSignin';
    const callbackUrl = searchParams.get('callbackUrl');

    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('error', error);
    if (callbackUrl) {
      redirectUrl.searchParams.set('callbackUrl', callbackUrl);
    }

    return NextResponse.redirect(redirectUrl, 302);
  } catch {
    return NextResponse.redirect(new URL('/login', request.url), 302);
  }
}

export async function POST(request: Request) {
  return GET(request);
}
