import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';
import { getDashboardScope } from '@/lib/roles';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSession = session.user as any;
    const role = userSession.role as string | undefined;
    const scope = getDashboardScope(role);

    let query = "SELECT COUNT(*) as count FROM `Visit` WHERE `status` = 'Submitted' AND (`visit_type` = 'No Visit' OR `reason_category` IS NOT NULL)";
    const params: any[] = [];

    if (scope === 'supervisor') {
      query += ' AND `supervisorId` = ?';
      params.push(userSession.id);
    }

    const [rows]: any = await pool.execute(query, params).catch(() => [[{ count: 0 }]]);
    const noVisitCount = Number(rows[0]?.count || 0);

    return NextResponse.json(
      { success: true, noVisitCount },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, noVisitCount: 0 }, { status: 500 });
  }
}
