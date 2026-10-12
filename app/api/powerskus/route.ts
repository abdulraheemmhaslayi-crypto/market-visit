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

    // 1. Fetch route details or deduce channel from route code
    const routes = await routeRepository.getAllRoutes();
    const route = routes.find((r) => r.routeCode === routeCode);
    let channel = route?.channel;
    if (!channel) {
      const isMT =
        routeCode.toUpperCase().startsWith('C00') ||
        routeCode.toUpperCase().startsWith('C42') ||
        routeCode.toUpperCase().startsWith('C28') ||
        routeCode.toUpperCase().startsWith('C30') ||
        routeCode.toUpperCase().startsWith('C39') ||
        routeCode.toUpperCase().startsWith('MT');
      channel = isMT ? 'MT' : 'TT';
    }

    // 2. Query Power SKUs filtered by Route Channel (strictly 24 for MT, 27 for TT)
    let powerSkus = await skuRepository.getPowerSkusByChannel(channel);
    if (!powerSkus || powerSkus.length === 0) {
      const all = await skuRepository.getAllPowerSkus();
      powerSkus = all.filter((s) => (s.channel || '').toUpperCase() === channel.toUpperCase());
      if (powerSkus.length === 0) powerSkus = all;
    }

    const targetLimit = channel.toUpperCase() === 'MT' ? 24 : 27;
    return NextResponse.json(powerSkus.slice(0, targetLimit));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
