import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { importExcelAction } from '@/actions/import-actions';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as any;
    if (user.role !== 'Admin' || user.status !== 'Active') {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    const payload = await req.json();
    const result = await importExcelAction(payload);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

