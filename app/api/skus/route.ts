import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { skuRepository } from '@/repositories/sku-repository';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const skus = await skuRepository.getSkusByType('NPD');
    return NextResponse.json(skus);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
