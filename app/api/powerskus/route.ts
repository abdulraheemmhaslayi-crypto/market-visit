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

    if (cleanChannel === 'NEAR EXPIRY' || cleanChannel.includes('NEAR EXPIRY')) {
      return NextResponse.json([]);
    }

    const isMT =
      cleanChannel === 'MT' ||
      cleanChannel.startsWith('MT') ||
      cleanChannel.includes('MODERN') ||
      cleanChannel === 'KEY ACCOUNT' ||
      cleanRoute.startsWith('MT') ||
      cleanCust.startsWith('MTD');

    const channel: 'MT' | 'TT' = isMT ? 'MT' : 'TT';
    const canonicalList = getCanonicalPowerSkusForChannel(channel);

    // Fetch database records if available (reflecting any uploaded/imported master files)
    let dbSkus: any[] = [];
    try {
      dbSkus = await skuRepository.getPowerSkusByChannel(channel);
    } catch (_) {}

    const canonicalMap = new Map(canonicalList.map((c) => [c.skuCode.toUpperCase().trim(), c]));

    const detectVertical = (name: string, code: string): 'Dairy' | 'Ice Cream' | 'Beverage' => {
      const cleanCode = code.toUpperCase().trim();
      if (canonicalMap.has(cleanCode)) return canonicalMap.get(cleanCode)!.businessVertical;
      if (cleanCode.includes('/')) {
        for (const part of cleanCode.split('/').map((s) => s.trim())) {
          if (canonicalMap.has(part)) return canonicalMap.get(part)!.businessVertical;
        }
      }
      const lower = name.toLowerCase();
      if (lower.includes('ice cream') || lower.includes('cone') || lower.includes('chocobar') || lower.includes('sandwich') || lower.includes('bon bon') || lower.includes('delight')) {
        return 'Ice Cream';
      }
      if (lower.includes('nectar') || lower.includes('juice') || lower.includes('drink') || lower.includes('frutti')) {
        return 'Beverage';
      }
      return 'Dairy';
    };

    let result: any[];
    if (dbSkus && dbSkus.length > 0) {
      result = dbSkus.map((item) => ({
        skuCode: item.skuCode,
        skuName: item.skuName,
        channel: item.channel,
        skuType: 'Power Sku',
        businessVertical: detectVertical(item.skuName, item.skuCode),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
    } else {
      result = canonicalList.map((c) => ({
        skuCode: c.skuCode,
        skuName: c.skuName,
        channel: c.channel,
        skuType: c.skuType || 'Power Sku',
        businessVertical: c.businessVertical,
      }));
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
