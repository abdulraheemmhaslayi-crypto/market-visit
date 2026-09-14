import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { routeRepository } from '@/repositories/route-repository';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as any;

    let routes;
    if (user.role === 'Admin') {
      routes = await routeRepository.getAllRoutes();
    } else {
      routes = await routeRepository.getRoutesBySupervisor(user.id, user.name);
    }

    return NextResponse.json(routes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
