import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { visitRepository } from '@/repositories/visit-repository';
import { customerRepository } from '@/repositories/customer-repository';
import pool from '@/lib/db';
import { getDashboardScope, isFleetRole, isFullAccessRole, isSupervisorRole, isReportAllowed } from '@/lib/roles';

let dashboardSchemaChecked = false;
async function ensureDashboardSchema() {
  if (dashboardSchemaChecked) return;
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS \`Manager\` (\`id\` VARCHAR(191) PRIMARY KEY, \`name\` VARCHAR(191) UNIQUE NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS \`PowerSKU\` (\`skuCode\` VARCHAR(191) NOT NULL, \`skuName\` VARCHAR(191) NOT NULL, \`channel\` VARCHAR(191) NOT NULL, PRIMARY KEY (\`skuCode\`, \`channel\`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS \`VisitAsset\` (\`assetId\` VARCHAR(191) PRIMARY KEY, \`visitId\` VARCHAR(191) NOT NULL, \`assetType\` VARCHAR(50) NOT NULL, \`temperature\` DOUBLE NULL, \`tempInRange\` TINYINT(1) NULL, \`actionRequired\` VARCHAR(50) NULL, \`observation\` TEXT NULL, \`isFirstInFlow\` TINYINT(1) NULL DEFAULT 0, \`fefoFollowed\` TINYINT(1) NULL DEFAULT 0, INDEX \`idx_asset_visit\` (\`visitId\`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS \`VisitPowerSkuResult\` (\`visitId\` VARCHAR(191) NOT NULL, \`skuCode\` VARCHAR(191) NOT NULL, \`status\` VARCHAR(50) NOT NULL, PRIMARY KEY (\`visitId\`, \`skuCode\`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    dashboardSchemaChecked = true;
  } catch (e) {}
}

import { MasterCache, getCachedMasterData, setCachedMasterData } from '@/lib/dashboard-cache';

const MASTER_CACHE_TTL_MS = 5 * 60 * 1000;

async function getMasterData(): Promise<MasterCache> {
  const now = Date.now();
  const cached = getCachedMasterData();
  if (cached && now - cached.timestamp < MASTER_CACHE_TTL_MS) {
    return cached;
  }

  const [customers, dbUsers, skuRows, powerSkuRows, routeRows] = await Promise.all([
    customerRepository.getAllCustomers(),
    pool.execute(`
      SELECT u.id, u.name, u.role, m.name as managerName 
      FROM User u 
      LEFT JOIN Manager m ON u.managerId = m.id
    `).then(([rows]: any) => rows).catch(() => []),
    pool.execute('SELECT `skuCode`, `skuName`, `type`, `businessVertical` FROM `SKU`').then(([rows]: any) => rows).catch(() => []),
    pool.execute('SELECT `skuCode`, `skuName`, `channel` FROM `PowerSKU`').then(([rows]: any) => rows).catch(() => []),
    pool.execute(`
      SELECT r.*, m.name as managerName 
      FROM Route r 
      LEFT JOIN Manager m ON r.managerId = m.id
    `).then(([rows]: any) => rows).catch(() => []),
  ]);

  const isExcluded = (name: string) => {
    const n = (name || '').toUpperCase().trim();
    return n === 'CLOSED' || n === 'INTERNAL' || n === '';
  };

  const allManagers = Array.from(
    new Set<string>(
      routeRows
        .map((r: any) => (r.managerName || '').trim())
        .filter((name: string) => !isExcluded(name))
    )
  ).sort() as string[];

  const allSupervisors = Array.from(
    new Set<string>(
      routeRows
        .map((r: any) => (r.superName || '').trim())
        .filter((name: string) => !isExcluded(name))
    )
  ).sort() as string[];

  const managerSupervisorMap: Record<string, string[]> = {};
  routeRows.forEach((r: any) => {
    const sup = (r.superName || '').trim();
    const mgr = (r.managerName || '').trim();
    if (sup && !isExcluded(sup) && mgr && !isExcluded(mgr)) {
      if (!managerSupervisorMap[mgr]) managerSupervisorMap[mgr] = [];
      if (!managerSupervisorMap[mgr].includes(sup)) managerSupervisorMap[mgr].push(sup);
    }
  });
  Object.keys(managerSupervisorMap).forEach((m) => managerSupervisorMap[m].sort());

  const skuMap = new Map<string, any>(skuRows.map((sku: any) => [sku.skuCode, sku]));
  const powerSkuMap = new Map<string, any>(powerSkuRows.map((sku: any) => [sku.skuCode, sku]));
  const customerMap = new Map(customers.map((c: any) => [c.cust_rt_id, c]));
  const routeMap = new Map<string, any>(routeRows.map((r: any) => [r.routeCode, r]));

  const userMap = new Map<string, { name: string; managerName: string }>(
    dbUsers.map((u: any) => {
      const supName = u.name.toUpperCase().trim();
      return [u.id, { name: supName, managerName: '' }];
    })
  );

  // Compact customer list for dropdown filter
  const seenCust = new Set<string>();
  const uniqueCustomers: { customerName: string; routeCode: string }[] = [];
  customers.forEach((c: any) => {
    const key = `${c.customerName}|${c.routeCode}`;
    if (!seenCust.has(key)) {
      seenCust.add(key);
      uniqueCustomers.push({ customerName: c.customerName, routeCode: c.routeCode });
    }
  });

  const newCache: MasterCache = {
    timestamp: now,
    customers,
    customerMap,
    uniqueCustomers,
    routeRows,
    routeMap,
    allManagers,
    allSupervisors,
    managerSupervisorMap,
    skuMap,
    powerSkuMap,
    dbUsers,
    userMap,
  };

  setCachedMasterData(newCache);
  return newCache;
}

const cacheStore = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 5000; // 5 seconds cache for duplicate clicks & rapid tabs

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userSession = session.user as any;
    const role = userSession.role as string | undefined;
    const scope = getDashboardScope(role);
    if (scope === 'full' || scope === 'supervisor' || scope === 'fleet') {
      // allowed
    } else {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const cacheKey = `${userSession.id}_${role}_${req.nextUrl.searchParams.toString()}`;
    const cached = cacheStore.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return NextResponse.json(cached.data);
    }

    await ensureDashboardSchema();

    const startDateParam = req.nextUrl.searchParams.get('startDate');
    const endDateParam = req.nextUrl.searchParams.get('endDate');
    const supervisorIdParam = req.nextUrl.searchParams.get('supervisorId');
    const routeCodeParam = req.nextUrl.searchParams.get('routeCode');
    const managerParam = req.nextUrl.searchParams.get('manager');
    const reportParam = req.nextUrl.searchParams.get('report');

    if (scope === 'fleet' && reportParam && !isReportAllowed(role, reportParam)) {
      return NextResponse.json({ error: 'Forbidden report for this role' }, { status: 403 });
    }

    // 1. Fetch cached master data & raw visits concurrently
    const [masters, visitsRaw, assets, pskuResults, npdResults, photosRaw] = await Promise.all([
      getMasterData(),
      visitRepository.getAllVisits(),
      pool.execute('SELECT * FROM `VisitAsset`').then(([rows]: any) => rows).catch(() => []),
      pool.execute('SELECT * FROM `VisitPowerSkuResult`').then(([rows]: any) => rows).catch(() => []),
      pool.execute('SELECT * FROM `NPDResponse`').then(([rows]: any) => rows).catch(() => []),
      pool.execute('SELECT * FROM `VisitPhoto` ORDER BY `uploadedAt` DESC LIMIT 200').then(([rows]: any) => rows).catch(() => []),
    ]);

    const {
      customers,
      customerMap,
      uniqueCustomers,
      routeRows,
      routeMap,
      allManagers,
      allSupervisors,
      managerSupervisorMap,
      skuMap,
      powerSkuMap,
      dbUsers,
    } = masters;

    let visits = visitsRaw;
    if (scope === 'supervisor') {
      visits = visits.filter((v: any) => v.supervisorId === userSession.id);
    }

    let filteredVisits = visits.filter((v: any) => v.status === 'Submitted');

    if (startDateParam) {
      const start = new Date(startDateParam + 'T00:00:00');
      filteredVisits = filteredVisits.filter((v: any) => new Date(v.createdAt) >= start);
    }
    if (endDateParam) {
      const end = new Date(endDateParam + 'T23:59:59');
      filteredVisits = filteredVisits.filter((v: any) => new Date(v.createdAt) <= end);
    }
    if (scope === 'supervisor') {
      filteredVisits = filteredVisits.filter((v: any) => v.supervisorId === userSession.id);
    }

    // Filter by Manager parameter (if passed)
    if (managerParam) {
      filteredVisits = filteredVisits.filter((v: any) => {
        const [_, rCode] = (v.cust_rt_id || '').split('|');
        const routeInfo = routeMap.get(rCode || v.routeCode || '');
        const mgrName = routeInfo ? (routeInfo.managerName || '') : '';
        return mgrName.toUpperCase() === managerParam.toUpperCase();
      });
    }

    if (supervisorIdParam && (scope === 'full' || isFullAccessRole(role))) {
      filteredVisits = filteredVisits.filter((v: any) => {
        const [_, rCode] = (v.cust_rt_id || '').split('|');
        const routeInfo = routeMap.get(rCode || v.routeCode || '');
        const supName = routeInfo ? (routeInfo.superName || '') : '';
        return supName.toUpperCase() === supervisorIdParam.toUpperCase();
      });
    }
    if (routeCodeParam) {
      filteredVisits = filteredVisits.filter((v: any) => {
        const [_, rt] = (v.cust_rt_id || '').split('|');
        return rt === routeCodeParam;
      });
    }

    const assetMap = new Map<string, any[]>();
    assets.forEach((ast: any) => {
      if (!assetMap.has(ast.visitId)) {
        assetMap.set(ast.visitId, []);
      }
      assetMap.get(ast.visitId)!.push(ast);
    });

    const pskuMap = new Map<string, any[]>();
    pskuResults.forEach((res: any) => {
      if (!pskuMap.has(res.visitId)) {
        pskuMap.set(res.visitId, []);
      }
      pskuMap.get(res.visitId)!.push(res);
    });

    const npdMap = new Map<string, any[]>();
    npdResults.forEach((res: any) => {
      if (!npdMap.has(res.visitId)) {
        npdMap.set(res.visitId, []);
      }
      npdMap.get(res.visitId)!.push(res);
    });

    const formatTempContext = (assetType: string, temperature: number | null | undefined) => {
      if (temperature === null || temperature === undefined || Number.isNaN(Number(temperature))) {
        return '—';
      }
      const value = Number(temperature).toFixed(1);
      if (assetType === 'Freezer') return `${value}°C (should be below -15°C)`;
      return `${value}°C (should be 0 to 8°C)`;
    };

    // 4. Map into flat structured rows for frontend analytics charts
    const reportRows = {
      npd: [] as any[],
      psku: [] as any[],
      'cold-chain': [] as any[],
      classification: [] as any[],
      classificationDairy: [] as any[],
      classificationIceCream: [] as any[],
    };
    const classificationRows: any[] = [];
    const classificationRowsDairy: any[] = [];
    const classificationRowsIceCream: any[] = [];

    const rows = filteredVisits.map((v: any) => {
      const [customerCode, routeCode] = (v.cust_rt_id || '').split('|');
      const routeInfo = routeMap.get(routeCode || v.routeCode || '');
      const supName = routeInfo ? (routeInfo.superName || 'UNASSIGNED').toUpperCase().trim() : 'UNASSIGNED';
      const mgrName = routeInfo ? (routeInfo.managerName || 'UNASSIGNED').toUpperCase().trim() : 'UNASSIGNED';

      const customer = customerMap.get(v.cust_rt_id || '');
      const custName = customer ? customer.customerName : 'Unknown';
      const ch = customer ? customer.channel : 'General Trade';
      const gr = customer ? customer.classification : 'C';
      const dairyGr = customer ? (customer.dairyClassification || null) : null;
      const iceGr = customer ? (customer.iceCreamClassification || null) : null;

      const visitDate = (v.createdAt as any) instanceof Date ? (v.createdAt as any).toISOString() : v.createdAt;

      const date = new Date(v.createdAt);
      const week = Math.min(5, Math.max(1, Math.ceil(date.getDate() / 7)));

      // Assets temperature processing
      const visitAssets = assetMap.get(v.visitId) || [];
      const firstAsset = visitAssets[0] || { assetType: 'Chiller', temperature: 0, tempInRange: 1, actionRequired: 'None', observation: '' };
      
      const ok = visitAssets.length > 0 ? visitAssets.every((a: any) => a.tempInRange === 1 || a.tempInRange === true) : true;
      const temperature = visitAssets.length > 0 ? (visitAssets[0].temperature) : 0;

      // Checklists status resolution
      const visitNpd = npdMap.get(v.visitId) || [];
      let npd = 'X';
      if (visitNpd.some((r: any) => r.status === 'Available')) npd = 'A';
      else if (visitNpd.some((r: any) => r.status === 'Not Available')) npd = 'N';

      const visitPsku = pskuMap.get(v.visitId) || [];
      let psku = 'X';
      if (visitPsku.some((r: any) => r.status === 'Available')) psku = 'A';
      else if (visitPsku.some((r: any) => r.status === 'Not Available')) psku = 'N';

      const fefo = ok;
      const action = visitAssets.map((a: any) => a.actionRequired !== 'None' ? `${a.assetType}: ${a.actionRequired}` : '').filter(Boolean).join(', ') || 'None';

      classificationRows.push({
        date: visitDate,
        visitId: v.visitId,
        channel: ch,
        manager: mgrName,
        supervisor: supName,
        routeCode: routeCode || '',
        outletCode: customerCode || '',
        outletName: custName,
        classification: gr,
        class: gr,
      });
      if (dairyGr) {
        classificationRowsDairy.push({
          date: visitDate,
          visitId: v.visitId,
          channel: ch,
          manager: mgrName,
          supervisor: supName,
          routeCode: routeCode || '',
          outletCode: customerCode || '',
          outletName: custName,
          classification: dairyGr,
          class: dairyGr,
          businessVertical: 'Dairy',
        });
      }
      if (iceGr) {
        classificationRowsIceCream.push({
          date: visitDate,
          visitId: v.visitId,
          channel: ch,
          manager: mgrName,
          supervisor: supName,
          routeCode: routeCode || '',
          outletCode: customerCode || '',
          outletName: custName,
          classification: iceGr,
          class: iceGr,
          businessVertical: 'Ice Cream',
        });
      }

      // Populate NPD Report Rows (Per SKU level granularity)
      visitNpd.forEach((item: any) => {
        const skuInfo = skuMap.get(item.skuCode);
        reportRows.npd.push({
          date: visitDate,
          visitId: v.visitId,
          channel: ch,
          manager: mgrName,
          supervisor: supName,
          routeCode: routeCode || '',
          outletCode: customerCode || '',
          outletName: custName,
          classification: gr,
          class: gr,
          skuCode: item.skuCode,
          skuName: skuInfo ? skuInfo.skuName : item.skuCode,
          status: item.status,
          businessVertical: skuInfo?.businessVertical || 'General',
        });
      });

      // Populate PowerSKU Report Rows (Per SKU level granularity)
      visitPsku.forEach((item: any) => {
        const pskuInfo = powerSkuMap.get(item.skuCode) || skuMap.get(item.skuCode);
        reportRows.psku.push({
          date: visitDate,
          visitId: v.visitId,
          channel: ch,
          manager: mgrName,
          supervisor: supName,
          routeCode: routeCode || '',
          outletCode: customerCode || '',
          outletName: custName,
          classification: gr,
          class: gr,
          skuCode: item.skuCode,
          skuName: pskuInfo ? pskuInfo.skuName : item.skuCode,
          status: item.status,
        });
      });

      // Populate Cold Chain Report Rows (Per Asset level granularity)
      if (visitAssets.length > 0) {
        visitAssets.forEach((ast: any) => {
          const isTempOk = ast.tempInRange === 1 || ast.tempInRange === true;
          reportRows['cold-chain'].push({
            date: visitDate,
            visitId: v.visitId,
            channel: ch,
            manager: mgrName,
            supervisor: supName,
            routeCode: routeCode || '',
            outletCode: customerCode || '',
            outletName: custName,
            classification: gr,
            class: gr,
            assetType: ast.assetType,
            sizeModel: ast.sizeModel || 'Standard',
            temperature: formatTempContext(ast.assetType, ast.temperature),
            tempOk: isTempOk ? 'OK' : 'Breach',
            tempRaw: ast.temperature ?? 0,
            fefo: (ast.fefoFollowed === 1 || ast.fefoFollowed === true) ? 'Compliant' : 'Non-Compliant',
            actionRequired: ast.actionRequired || 'None',
            observation: ast.observation || '—',
          });
        });
      } else {
        reportRows['cold-chain'].push({
          date: visitDate,
          visitId: v.visitId,
          channel: ch,
          manager: mgrName,
          supervisor: supName,
          routeCode: routeCode || '',
          outletCode: customerCode || '',
          outletName: custName,
          classification: gr,
          class: gr,
          assetType: firstAsset.assetType,
          sizeModel: (firstAsset as any).sizeModel || 'Standard',
          temperature: formatTempContext(firstAsset.assetType, firstAsset.temperature),
          tempOk: ok ? 'OK' : 'Breach',
          tempRaw: firstAsset.temperature ?? 0,
          fefo: fefo ? 'Compliant' : 'Non-Compliant',
          actionRequired: firstAsset.actionRequired || 'None',
          observation: firstAsset.observation || '—',
        });
      }

      const primaryAsset = visitAssets[0] || null;

      return {
        id: v.visitId,
        date: visitDate,
        createdAt: visitDate,
        mgr: mgrName,
        manager: mgrName,
        sup: supName,
        supervisor: supName,
        ch,
        channel: ch,
        gr,
        classification: gr,
        dairyClassification: dairyGr,
        iceCreamClassification: iceGr,
        cust: custName,
        outletName: custName,
        route: routeCode || '',
        routeCode: routeCode || '',
        week,
        sos: v.sosAsPerBda === 1 ? 'Y' : 'N',
        plan: v.planogramCompliance === 1 ? 'Y' : 'N',
        npd,
        psku,
        temp: ok ? 'OK' : 'Breach',
        tempVal: temperature,
        assetType: primaryAsset?.assetType || 'Chiller',
        sizeModel: primaryAsset?.sizeModel || 'Standard',
        allAssets: visitAssets.map((a: any) => ({
          assetType: a.assetType,
          sizeModel: a.sizeModel || 'Standard',
          temperature: a.temperature ?? 0,
          tempInRange: a.tempInRange === 1 || a.tempInRange === true,
          actionRequired: a.actionRequired || 'None',
          observation: a.observation || '',
          fefoFollowed: a.fefoFollowed === 1 || a.fefoFollowed === true,
        })),
        fefo: fefo ? 'Y' : 'N',
        action,
        visit_type: v.visit_type || 'Visit',
      };
    });

    reportRows.classification = classificationRows;
    reportRows.classificationDairy = classificationRowsDairy;
    reportRows.classificationIceCream = classificationRowsIceCream;

    // Photos payload
    const photos = photosRaw.map((p: any) => {
      const visit = filteredVisits.find((v: any) => v.visitId === p.visitId);
      const customer = visit ? customerMap.get(visit.cust_rt_id || '') : null;
      const [_, routeCode] = visit ? (visit.cust_rt_id || '').split('|') : ['', ''];
      const routeInfo = routeMap.get(routeCode || (visit ? visit.routeCode : '') || '');

      return {
        photoId: p.photoId,
        visitId: p.visitId,
        category: p.category,
        cloudinaryUrl: p.cloudinaryUrl,
        uploadedAt: (p.uploadedAt as any) instanceof Date ? (p.uploadedAt as any).toISOString() : p.uploadedAt,
        appName: 'Market Visit App',
        supervisor: routeInfo ? (routeInfo.superName || 'Unassigned') : 'Unassigned',
        manager: routeInfo ? (routeInfo.managerName || 'Unassigned') : 'Unassigned',
        outlet: customer ? customer.customerName : 'Unknown Outlet',
        route: routeCode || 'N/A',
        channel: customer ? customer.channel : 'GT',
      };
    });

    // 5. Aggregate KPI Summary Metrics
    const totalVisits = filteredVisits.length;
    const noVisitCount = filteredVisits.filter((v: any) => v.visit_type === 'No Visit').length;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayVisits = filteredVisits.filter((v: any) => {
      const d = (v.createdAt as any) instanceof Date ? (v.createdAt as any).toISOString() : v.createdAt;
      return typeof d === 'string' && d.startsWith(todayStr);
    }).length;

    const totalSupervisors = allSupervisors.length;

    const totalUniqueAssignedOutlets = customers.length;
    const visitedUniqueOutlets = new Set(filteredVisits.map((v: any) => v.cust_rt_id).filter(Boolean)).size;
    const coveragePercent = totalUniqueAssignedOutlets > 0 ? Math.round((visitedUniqueOutlets / totalUniqueAssignedOutlets) * 100) : 0;

    const breachedVisits = filteredVisits.filter((v: any) => {
      const visitAssets = assetMap.get(v.visitId) || [];
      return visitAssets.length > 0 ? visitAssets.some((a: any) => a.tempInRange !== 1 && a.tempInRange !== true) : false;
    }).length;
    const tempBreachPercent = totalVisits > 0 ? Math.round((breachedVisits / totalVisits) * 100) : 0;

    const visitsPerDayMap: Record<string, number> = {};
    filteredVisits.forEach((v: any) => {
      const d = (v.createdAt as any) instanceof Date ? (v.createdAt as any).toISOString().split('T')[0] : String(v.createdAt).split('T')[0];
      visitsPerDayMap[d] = (visitsPerDayMap[d] || 0) + 1;
    });
    const visitsPerDay = Object.keys(visitsPerDayMap).sort().map(d => ({ date: d, count: visitsPerDayMap[d] }));

    const routeVisitsMap: Record<string, Set<string>> = {};
    filteredVisits.forEach((v: any) => {
      const [_, rCode] = (v.cust_rt_id || '').split('|');
      const rt = rCode || v.routeCode;
      if (rt) {
        if (!routeVisitsMap[rt]) routeVisitsMap[rt] = new Set();
        routeVisitsMap[rt].add(v.cust_rt_id);
      }
    });

    const coveragePerRoute = routeRows.map((r: any) => {
      const assigned = customers.filter((c: any) => c.routeCode === r.routeCode).length;
      const visited = routeVisitsMap[r.routeCode] ? routeVisitsMap[r.routeCode].size : 0;
      const percent = assigned > 0 ? Math.round((visited / assigned) * 100) : 0;
      return {
        routeCode: r.routeCode,
        routeName: r.routeName,
        assigned,
        visited,
        percent,
      };
    });

    const supervisorPerformance = allSupervisors
      .map((supName: string) => {
        const supVisits = filteredVisits.filter((v: any) => {
          const [_, rCode] = (v.cust_rt_id || '').split('|');
          const routeInfo = routeMap.get(rCode || v.routeCode || '');
          const sName = routeInfo ? (routeInfo.superName || '') : '';
          return sName.toUpperCase() === supName.toUpperCase();
        });

        const visitsCount = supVisits.length;
        const uniqueOutlets = new Set(supVisits.map((v: any) => v.cust_rt_id)).size;

        const breaches = supVisits.filter((v: any) => {
          const visitAssets = assetMap.get(v.visitId) || [];
          return visitAssets.length > 0 ? visitAssets.some((a: any) => a.tempInRange !== 1 && a.tempInRange !== true) : false;
        }).length;

        const supRoutes = routeRows.filter((r: any) => (r.superName || '').toUpperCase().trim() === supName.toUpperCase());
        const totalAssigned = supRoutes.reduce((sum: number, r: any) => {
          return sum + customers.filter((c: any) => c.routeCode === r.routeCode).length;
        }, 0);

        const totalVisited = supRoutes.reduce((sum: number, r: any) => {
          const visitedCustIds = new Set(
            filteredVisits
              .filter((v: any) => {
                const [_, rCode] = (v.cust_rt_id || '').split('|');
                return rCode === r.routeCode;
              })
              .map((v: any) => v.cust_rt_id)
          );
          return sum + visitedCustIds.size;
        }, 0);

        const coveragePct = totalAssigned > 0 ? Math.round((totalVisited / totalAssigned) * 100) : 0;

        return {
          supervisorId: supName,
          supervisorName: supName,
          visitsCount,
          uniqueOutlets,
          breaches,
          coveragePercent: coveragePct,
        };
      })
      .sort((a: any, b: any) => b.visitsCount - a.visitsCount);

    const temperatureBreaches = filteredVisits
      .filter((v: any) => {
        const visitAssets = assetMap.get(v.visitId) || [];
        return visitAssets.length > 0 ? visitAssets.some((a: any) => a.tempInRange !== 1 && a.tempInRange !== true) : false;
      })
      .map((v: any) => {
        const customer = customerMap.get(v.cust_rt_id || '');
        const custName = customer ? customer.customerName : 'Unknown';
        const [_, routeCode] = (v.cust_rt_id || '').split('|');
        const routeInfo = routeMap.get(routeCode || v.routeCode || '');
        const supName = routeInfo ? (routeInfo.superName || 'UNASSIGNED').toUpperCase().trim() : 'UNASSIGNED';
        const visitAssets = assetMap.get(v.visitId) || [];
        const firstAsset = visitAssets[0] || { assetType: 'Chiller', temperature: 0 };
        
        return {
          visitId: v.visitId,
          customerName: custName,
          assetType: firstAsset.assetType,
          temperature: firstAsset.temperature,
          supervisorName: supName,
          visitDate: (v.createdAt as any) instanceof Date ? (v.createdAt as any).toISOString() : v.createdAt,
        };
      });

    const payload = {
      success: true,
      rows,
      reportRows,
      managerSupervisorMap,
      photos,
      masters: {
        managers: allManagers,
        supervisors: allSupervisors,
        routes: routeRows.map((r: any) => ({
          routeCode: r.routeCode,
          routeName: r.routeName,
          superName: (r.superName || '').trim(),
          managerName: (r.managerName || '').trim(),
        })),
        customers: uniqueCustomers,
      },
      totalVisits,
      noVisitCount,
      todayVisits,
      totalSupervisors,
      coveragePercent,
      tempBreachPercent,
      visitsPerDay,
      coveragePerRoute,
      supervisorPerformance,
      temperatureBreaches,
    };

    cacheStore.set(cacheKey, { timestamp: Date.now(), data: payload });

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('Dashboard aggregation failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
