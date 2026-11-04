import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assetBrandingRepository } from '@/lib/asset-branding';
import { isFullAccessRole, isSupervisorRole } from '@/lib/roles';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const outletCode = searchParams.get('outletCode') || '';
    const checkOnly = searchParams.get('check') === 'true';
    const historyOnly = searchParams.get('history') === 'true';

    // 1. Check pending status for an outlet (Supervisor Camera Capture page check)
    if (checkOnly && outletCode) {
      const pendingRequest = await assetBrandingRepository.getPendingForOutlet(outletCode);
      const latest = await assetBrandingRepository.getLatestForOutlet(outletCode);
      const latestAcknowledged =
        latest && latest.status === 'Acknowledged' ? latest : null;

      return NextResponse.json({
        success: true,
        hasPending: Boolean(pendingRequest),
        pendingRequest: pendingRequest || null,
        latestAcknowledged,
      });
    }

    // 2. Fetch history for a specific outlet
    if (historyOnly && outletCode) {
      const history = await assetBrandingRepository.getHistoryForOutlet(outletCode);
      return NextResponse.json({ success: true, history });
    }

    // 3. Admin / Sub-Admin dashboard query with filters
    const status = searchParams.get('status') || undefined;
    const routeCode = searchParams.get('routeCode') || undefined;
    const supervisorName = searchParams.get('supervisorName') || undefined;
    const search = searchParams.get('search') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const [requests, counts] = await Promise.all([
      assetBrandingRepository.getAll({
        outletCode: outletCode || undefined,
        routeCode,
        supervisorName,
        status,
        search,
        fromDate,
        toDate,
      }),
      assetBrandingRepository.getSummaryCounts(),
    ]);

    return NextResponse.json({
      success: true,
      requests,
      counts,
    });
  } catch (err: any) {
    console.error('Error fetching branding requests:', err);
    return NextResponse.json({ error: 'Failed to fetch branding requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      outletId,
      outletCode,
      outletName,
      routeCode,
      visitId,
      visitDate,
      brandingScope,
    } = body;

    if (!outletCode || !outletName) {
      return NextResponse.json(
        { error: 'Outlet code and outlet name are required' },
        { status: 400 }
      );
    }

    const supervisorId = (session.user as any).id || (session.user as any).employeeCode || 'SUP-USER';
    const supervisorName = session.user.name || 'Supervisor';

    const { request, isDuplicate } = await assetBrandingRepository.create({
      outletId: outletId || outletCode,
      outletCode,
      outletName,
      routeCode: routeCode || 'N/A',
      supervisorId,
      supervisorName,
      visitId: visitId || undefined,
      visitDate: visitDate || undefined,
      brandingRequired: true,
      brandingScope: brandingScope || 'General Asset Branding',
    });

    return NextResponse.json(
      {
        success: true,
        request,
        isDuplicate,
        message: isDuplicate
          ? 'An Asset Branding Request for this outlet is already pending Admin/Sub-Admin acknowledgement.'
          : 'Asset Branding Request submitted successfully.',
      },
      { status: isDuplicate ? 200 : 201 }
    );
  } catch (err: any) {
    console.error('Error creating branding request:', err);
    return NextResponse.json({ error: err.message || 'Failed to create branding request' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = String((session.user as any)?.role || '');

    // Mandatory Backend Authorization: Only Admin and authorized Sub-Admin can acknowledge
    if (isSupervisorRole(userRole) || !isFullAccessRole(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Supervisors are not authorized to acknowledge branding requests' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const adminId = (session.user as any).id || (session.user as any).employeeCode || 'ADMIN';
    const adminName = session.user.name || 'Administrator';

    const updated = await assetBrandingRepository.acknowledge(id, adminId, adminName);
    if (!updated) {
      return NextResponse.json({ error: 'Branding request not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      request: updated,
      message: 'Branding request acknowledged successfully.',
    });
  } catch (err: any) {
    console.error('Error acknowledging branding request:', err);
    return NextResponse.json({ error: err.message || 'Failed to acknowledge branding request' }, { status: 500 });
  }
}

