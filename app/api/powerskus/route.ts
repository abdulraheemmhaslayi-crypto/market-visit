import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { routeRepository } from '@/repositories/route-repository';
import { skuRepository } from '@/repositories/sku-repository';
import { getCanonicalPowerSkusForChannel } from '@/lib/power-skus-data';

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

    const customerCode = searchParams.get('customerCode');
    const channelParam = searchParams.get('channel');

    // 1. Fetch route details or deduce channel from route code / customer / param
    const routes = await routeRepository.getAllRoutes();
    const route = routes.find((r) => r.routeCode === routeCode);
    const rawChannel = channelParam || route?.channel || '';
    const cleanRoute = (routeCode || '').toUpperCase().trim();
    const cleanCust = (customerCode || '').toUpperCase().trim();
    const cleanChannel = rawChannel.toUpperCase().trim();

    const isMT =
      cleanChannel === 'MT' ||
      cleanChannel.startsWith('MT') ||
      cleanChannel.includes('MODERN') ||
      cleanChannel === 'KEY ACCOUNT' ||
      cleanRoute.startsWith('MT') ||
      cleanCust.startsWith('MTD');

    const channel: 'MT' | 'TT' = isMT ? 'MT' : 'TT';
    const canonicalList = getCanonicalPowerSkusForChannel(channel);

    // Enrich with database records if available
    let dbSkus: any[] = [];
    try {
      dbSkus = await skuRepository.getPowerSkusByChannel(channel);
    } catch (_) {}

    const dbMap = new Map((dbSkus || []).map((s: any) => [s.skuCode.toUpperCase().trim(), s]));
    const result = canonicalList.map((c) => {
      const fromDb = dbMap.get(c.skuCode.toUpperCase().trim());
      return {
        skuCode: c.skuCode,
        skuName: c.skuName, // Canonical name
        channel: c.channel,
        skuType: c.skuType || 'Power Sku',
        businessVertical: c.businessVertical,
        ...(fromDb ? { createdAt: fromDb.createdAt, updatedAt: fromDb.updatedAt } : {}),
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
