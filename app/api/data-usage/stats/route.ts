import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDashboardScope } from '@/lib/roles';
import { dataUsageRepository } from '@/repositories/data-usage-repository';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSession = session.user as any;
    const role = userSession.role as string | undefined;
    const scope = getDashboardScope(role);

    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const managerId = searchParams.get('managerId') || undefined;

    const stats = await dataUsageRepository.getUsageStats({
      startDate,
      endDate,
      userId,
      managerId,
      scope,
      scopeUserId: userSession.id,
    });

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (err: any) {
    console.error('Error fetching data usage stats:', err);
    return NextResponse.json({ error: 'Failed to fetch usage stats' }, { status: 500 });
  }
}
