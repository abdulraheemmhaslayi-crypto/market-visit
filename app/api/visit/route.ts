import { NextRequest, NextResponse } from 'next/server';
import { saveVisitDraftAction, submitVisitAction } from '@/actions/visit-actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const isSubmitted = body.status === 'Submitted';
    
    let result;
    if (isSubmitted) {
      result = await submitVisitAction(body);
    } else {
      result = await saveVisitDraftAction(body);
    }
    
    return NextResponse.json(result.visit);
  } catch (error: any) {
    console.error('API Visit save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
