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

    const userRole = String((session.user as any)?.role || '');
    const isSupervisor = isSupervisorRole(userRole);
    const loggedInSupervisorName = (session.user.name || '').trim();

    const { searchParams } = req.nextUrl;
    const outletCode = searchParams.get('outletCode') || '';
    const checkOnly = searchParams.get('check') === 'true';
    const historyOnly = searchParams.get('history') === 'true';

    // 1. Check pending status for an outlet (Supervisor Camera Capture page check)
    if (checkOnly && outletCode) {
      const pendingRequest = await assetBrandingRepository.getPendingForOutlet(outletCode);
      const latest = await assetBrandingRepository.getLatestForOutlet(outletCode);
      const latestAcknowledged =
        latest && (latest.status === 'Acknowledged' || latest.status === 'Approved' || latest.status === 'Rejected')
          ? latest
          : null;

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

    // 3. Dashboard queries with filters
    const status = searchParams.get('status') || undefined;
    const routeCode = searchParams.get('routeCode') || undefined;
    const classification = searchParams.get('classification') || undefined;
    let supervisorName = searchParams.get('supervisorName') || undefined;
    const search = searchParams.get('search') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    // Strict supervisor scoping: If requester is a Supervisor in supervisor portal, default to their own requests
    const isSupervisorPortal = searchParams.get('portal') === 'supervisor' || isSupervisor;
    if (isSupervisorPortal && isSupervisor && loggedInSupervisorName) {
      supervisorName = loggedInSupervisorName;
    }

    const filters = {
      outletCode: outletCode || undefined,
      routeCode,
      supervisorName,
      classification,
      status,
      search,
      fromDate,
      toDate,
    };

    const [requests, counts] = await Promise.all([
      assetBrandingRepository.getAll(filters),
      assetBrandingRepository.getSummaryCounts(
        supervisorName ? { supervisorName, classification } : { classification }
      ),
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
      assetType,
      assetModel,
      sizeModel,
      brandingScope,
      photoUrl,
      classification,
      channel,
      notes,
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
      assetType: assetType || undefined,
      assetModel: assetModel || sizeModel || undefined,
      sizeModel: sizeModel || assetModel || undefined,
      brandingRequired: true,
      brandingScope: notes || brandingScope || 'Asset Branding Required',
      photoUrl: photoUrl || undefined,
      classification: classification || undefined,
      channel: channel || undefined,
      notes: notes || undefined,
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

    // Mandatory Backend Authorization: Only Admin and authorized Sub-Admin can acknowledge or decide
    if (isSupervisorRole(userRole) || !isFullAccessRole(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Supervisors are not authorized to update branding requests' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, action, decision, adminComment, assetType, assetModel } = body;

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const adminId = (session.user as any).id || (session.user as any).employeeCode || 'ADMIN';
    const adminName = session.user.name || 'Administrator';

    
    // Asset Type & Model Update
    if (action === 'update_asset' || (assetType && assetModel && !decision && action !== 'acknowledge')) {
      const updated = await assetBrandingRepository.updateAssetInfo(id, assetType, assetModel);
      if (!updated) {
        return NextResponse.json({ error: 'Branding request not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        request: updated,
        message: 'Asset Model / Size updated successfully.',
      });
    }

    // 1. Decision Action (Approved / Rejected with comments/reason)
    if (action === 'decision' || decision) {
      const validDecision = decision === 'Approved' ? 'Approved' : decision === 'Rejected' ? 'Rejected' : null;
      if (!validDecision) {
        return NextResponse.json(
          { error: "Invalid decision. Must be either 'Approved' or 'Rejected'." },
          { status: 400 }
        );
      }

      const commentStr = (adminComment || '').trim();
      if (validDecision === 'Rejected' && !commentStr) {
        return NextResponse.json(
          { error: 'A reason or comment is required when rejecting a branding request.' },
          { status: 400 }
        );
      }

      if (assetType && assetModel) {
        await assetBrandingRepository.updateAssetInfo(id, assetType, assetModel);
      }
      const updated = await assetBrandingRepository.recordDecision(
        id,
        validDecision,
        commentStr,
        adminId,
        adminName
      );

      if (!updated) {
        return NextResponse.json({ error: 'Branding request not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        request: updated,
        message: `Branding request marked as ${validDecision} successfully.`,
      });
    }

    // 2. Default Action: Acknowledge
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
    console.error('Error updating branding request:', err);
    return NextResponse.json({ error: err.message || 'Failed to update branding request' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = String((session.user as any)?.role || '');

    // Mandatory Authorization: Only Admin / Full Access roles can delete branding requests
    if (isSupervisorRole(userRole) || !isFullAccessRole(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Admin is authorized to delete branding requests' },
        { status: 403 }
      );
    }

    const { searchParams } = req.nextUrl;
    let id = searchParams.get('id') || searchParams.get('requestId') || '';
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || body?.requestId || '';
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required for deletion' }, { status: 400 });
    }

    const deleted = await assetBrandingRepository.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Branding request not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Asset Branding Request deleted successfully from both Admin and Supervisor portals.',
    });
  } catch (err: any) {
    console.error('Error deleting branding request:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete branding request' }, { status: 500 });
  }
}
