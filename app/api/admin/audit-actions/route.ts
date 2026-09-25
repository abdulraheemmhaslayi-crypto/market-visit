import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { auditActionRepository } from '@/lib/audit-actions';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const photoId = searchParams.get('photoId');
    const status = searchParams.get('status');
    const supervisor = searchParams.get('supervisor');

    let items = await auditActionRepository.getAll();

    if (photoId) {
      items = items.filter((i) => i.photoId === photoId);
    }
    if (status && status !== 'all') {
      items = items.filter((i) => i.actionStatus === status);
    }
    if (supervisor && supervisor !== 'all') {
      items = items.filter((i) => (i.supervisor || '').toLowerCase() === supervisor.toLowerCase());
    }

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    console.error('Error fetching audit actions:', err);
    return NextResponse.json({ error: 'Failed to fetch audit actions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const {
      photoId,
      visitId,
      outlet,
      route,
      supervisor,
      manager,
      category,
      originalPhotoUrl,
      gmComment,
      priority,
      deadline,
    } = body;

    if (!photoId || !gmComment?.trim()) {
      return NextResponse.json(
        { error: 'Photo ID and GM Comment are required' },
        { status: 400 }
      );
    }

    const gmName = session?.user?.name || 'General Manager';

    const newItem = await auditActionRepository.create({
      photoId,
      visitId: visitId || 'VISIT-N/A',
      outlet: outlet || 'Unknown Store',
      route: route || 'N/A',
      supervisor: supervisor || 'Supervisor',
      manager: manager || '',
      category: category || 'General',
      originalPhotoUrl: originalPhotoUrl || '',
      gmComment: gmComment.trim(),
      gmName,
      priority: priority === 'Urgent' ? 'Urgent' : 'Normal',
      deadline: deadline || undefined,
    });

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating audit action:', err);
    return NextResponse.json({ error: 'Failed to create audit action' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, actionStatus, supervisorComment, proofPhotoUrl, gmResolutionNotes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Action item ID is required' }, { status: 400 });
    }

    const updates: any = {};

    if (actionStatus) {
      updates.actionStatus = actionStatus;
    }

    // When supervisor submits proof:
    if (actionStatus === 'SUBMITTED' || supervisorComment || proofPhotoUrl) {
      if (supervisorComment !== undefined) updates.supervisorComment = supervisorComment;
      if (proofPhotoUrl !== undefined) updates.proofPhotoUrl = proofPhotoUrl;
      updates.actionTakenAt = new Date().toISOString();
      if (!actionStatus) updates.actionStatus = 'SUBMITTED';
    }

    // When GM verifies or re-opens:
    if (actionStatus === 'RESOLVED') {
      updates.gmVerifiedAt = new Date().toISOString();
      if (gmResolutionNotes !== undefined) updates.gmResolutionNotes = gmResolutionNotes;
    }

    const updated = await auditActionRepository.update(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    console.error('Error updating audit action:', err);
    return NextResponse.json({ error: 'Failed to update audit action' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const ok = await auditActionRepository.delete(id);
    return NextResponse.json({ success: ok });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
