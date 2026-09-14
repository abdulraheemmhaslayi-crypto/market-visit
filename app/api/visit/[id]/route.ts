import { NextRequest, NextResponse } from 'next/server';
import { saveVisitDraftAction, submitVisitAction, deleteVisitAction } from '@/actions/visit-actions';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const isSubmitted = body.status === 'Submitted';

    let result;
    if (isSubmitted) {
      result = await submitVisitAction({ ...body, visitId: id });
    } else {
      result = await saveVisitDraftAction({ ...body, visitId: id });
    }

    return NextResponse.json(result.visit);
  } catch (error: any) {
    console.error('API Visit PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await deleteVisitAction(id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Visit DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
