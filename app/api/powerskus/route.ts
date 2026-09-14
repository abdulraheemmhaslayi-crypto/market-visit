import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { routeRepository } from '@/repositories/route-repository';
import { skuRepository } from '@/repositories/sku-repository';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as any;

    const { searchParams } = new URL(req.url);
    const routeCode = searchParams.get('routeCode');

    if (!routeCode) {
      return NextResponse.json({ error: 'routeCode parameter is required' }, { status: 400 });
    }

    // 1. Fetch route details
    const routes = await routeRepository.getAllRoutes();
    const route = routes.find((r) => r.routeCode === routeCode);
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    // 2. Validate route ownership for supervisor
    if (user.role !== 'Admin') {
      const isAssigned = await routeRepository.isRouteAssignedToSupervisor(routeCode, user.id);
      if (!isAssigned) {
        return NextResponse.json({ error: 'Forbidden. You do not have access to this route.' }, { status: 403 });
      }
    }

    // 3. Query Power SKUs filtered by Route Channel
    const powerSkus = await skuRepository.getPowerSkusByChannel(route.channel);
    return NextResponse.json(powerSkus);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
