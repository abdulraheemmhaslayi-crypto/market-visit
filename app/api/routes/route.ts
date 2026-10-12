import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCustMasterData } from '@/lib/custmaster-data';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as any;
    const custMaster = getCustMasterData();

    // Map routes strictly from CUSTMASTER
    const allCmRoutes = (custMaster.routes || []).map((r: any) => ({
      routeCode: r.routeCode,
      routeName: r.routeName || `Route ${r.routeCode}`,
      channel: r.routeCode.startsWith('MT') ? 'MT' : r.routeCode.startsWith('IS') ? 'INST' : r.routeCode.startsWith('EX') ? 'EXPORT' : 'TT',
      superName: r.superName,
      managerName: r.managerName,
      supervisorId: user.name === r.superName ? user.id : undefined,
    }));

    let routes;
    if (user.role === 'Admin') {
      routes = allCmRoutes;
    } else {
      const uName = (user.name || '').trim().toUpperCase();
      // Handle SAIFULLAH vs SAIF explicitly
      let targetSup = uName;
      if (user.id === 'usr_rqwxav8' || uName === 'SAIFULLAH') targetSup = 'SAIFULLAH';
      else if (user.id === 'usr_tgb2s6h' || uName === 'SAIF') targetSup = 'SAIF';

      const myRouteCodes = new Set(custMaster.supervisorRoutesMap[targetSup] || []);
      routes = allCmRoutes.filter((r) => myRouteCodes.has(r.routeCode) || (r.superName && r.superName.toUpperCase() === targetSup));
    }

    return NextResponse.json(routes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
