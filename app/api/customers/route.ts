import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { customerRepository } from '@/repositories/customer-repository';
import { routeRepository } from '@/repositories/route-repository';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as any;

    const { searchParams } = new URL(req.url);
    const routeCode = searchParams.get('routeCode');

    let customers;
    if (user.role === 'Admin') {
      if (routeCode) {
        customers = await customerRepository.getCustomersByRoute(routeCode);
      } else {
        customers = await customerRepository.getAllCustomers();
      }
    } else {
      // Supervisor: Enforce route assignment
      if (routeCode) {
        const isAssigned = await routeRepository.isRouteAssignedToSupervisor(routeCode, user.id);
        if (!isAssigned) {
          return NextResponse.json({ error: 'Forbidden. You do not have access to this route.' }, { status: 403 });
        }
        customers = await customerRepository.getCustomersByRoute(routeCode);
      } else {
        customers = await customerRepository.getCustomersBySupervisor(user.id);
      }
    }

    return NextResponse.json(customers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
