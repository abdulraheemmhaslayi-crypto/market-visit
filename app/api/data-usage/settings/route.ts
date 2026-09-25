import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isFullAccessRole } from '@/lib/roles';
import { dataUsageRepository } from '@/repositories/data-usage-repository';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await dataUsageRepository.getSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    console.error('Error fetching settings:', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSession = session.user as any;
    if (!isFullAccessRole(userSession.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const updated = await dataUsageRepository.updateSettings(
      {
        dailyPerUserLimitMb: Number(body.dailyPerUserLimitMb || 50),
        warningThresholdPercent: Number(body.warningThresholdPercent || 80),
        highUsageAlertThresholdMb: Number(body.highUsageAlertThresholdMb || 100),
      },
      userSession.name || userSession.email
    );

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error('Error updating settings:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
