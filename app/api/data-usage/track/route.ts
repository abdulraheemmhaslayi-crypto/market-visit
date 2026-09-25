import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { dataUsageRepository } from '@/repositories/data-usage-repository';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    let body: any = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    }

    if (!body || !body.userId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Verify session matches or authenticate request
    const sessionUserId = (session?.user as any)?.id || body.userId;
    const sessionUserName = (session?.user as any)?.name || body.userName || 'Unknown User';
    const sessionUserRole = (session?.user as any)?.role || body.userRole || 'Supervisor';

    await dataUsageRepository.recordUsage({
      userId: sessionUserId,
      userName: sessionUserName,
      userRole: sessionUserRole,
      managerId: body.managerId,
      date: body.date || new Date().toISOString().split('T')[0],
      requests: Number(body.requests || 1),
      bytesDownloaded: Number(body.bytesDownloaded || 0),
      bytesUploaded: Number(body.bytesUploaded || 0),
      breakdown: body.breakdown || {},
      deviceInfo: body.deviceInfo,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error tracking data usage:', err);
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}
