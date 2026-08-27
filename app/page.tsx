import { auth } from '@/lib/auth';
import { canAccessAdminRoute, isSupervisorRole } from '@/lib/roles';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const role = (session.user as any).role;
  if (canAccessAdminRoute(role)) {
    redirect('/admin');
  } else if (isSupervisorRole(role)) {
    redirect('/supervisor/visit');
  } else {
    redirect('/supervisor');
  }
}
