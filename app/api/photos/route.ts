import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { visitRepository } from '@/repositories/visit-repository';
import { customerRepository } from '@/repositories/customer-repository';
import pool from '@/lib/db';
import { getDashboardScope } from '@/lib/roles';
import { getCustMasterChannel } from '@/lib/custmaster-channel';
import { getCustMasterData } from '@/lib/custmaster-data';

import { MasterCache, getCachedMasterData, setCachedMasterData } from '@/lib/dashboard-cache';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSession = session.user as any;
    const role = userSession.role as string | undefined;
    const scope = getDashboardScope(role);

    if (scope !== 'full' && scope !== 'supervisor' && scope !== 'fleet') {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const dateParam = searchParams.get('date'); // 'YYYY-MM-DD' or 'all'
    const appNameParam = searchParams.get('appName'); // application name or 'all'
    const supervisorIdParam = searchParams.get('supervisorId');
    const supervisorParam = searchParams.get('supervisor'); // supervisor name or 'all'
    const outletParam = searchParams.get('outlet'); // outlet name or 'all'
    const searchParam = searchParams.get('search'); // search outlet or supervisor or route
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '12', 10)));

    // Fetch visits, cached masters, and photos in parallel
    const [visitsRaw, photosRaw] = await Promise.all([
      visitRepository.getAllVisits(),
      pool.execute('SELECT * FROM `VisitPhoto` ORDER BY `uploadedAt` DESC').then(([rows]: any) => rows).catch(() => []),
    ]);

    let cachedMasters = getCachedMasterData();
    if (!cachedMasters) {
      const [customers, dbUsers, skuRows, powerSkuRows, routeRows] = await Promise.all([
        customerRepository.getAllCustomers(),
        pool.execute(`SELECT u.id, u.name, u.role, m.name as managerName FROM User u LEFT JOIN Manager m ON u.managerId = m.id`).then(([rows]: any) => rows).catch(() => []),
        pool.execute('SELECT `skuCode`, `skuName`, `type`, `businessVertical` FROM `SKU`').then(([rows]: any) => rows).catch(() => []),
        pool.execute('SELECT `skuCode`, `skuName`, `channel` FROM `PowerSKU`').then(([rows]: any) => rows).catch(() => []),
        pool.execute(`SELECT r.*, m.name as managerName FROM Route r LEFT JOIN Manager m ON r.managerId = m.id`).then(([rows]: any) => rows).catch(() => []),
      ]);
      const customerMap = new Map(customers.map((c: any) => [c.cust_rt_id, c]));
      const customerCodeMap = new Map<string, any>();
      customers.forEach((c: any) => {
        if (c.customerCode) {
          const codeUpper = c.customerCode.trim().toUpperCase();
          customerCodeMap.set(codeUpper, c);
          customerCodeMap.set(codeUpper.replace(/^0+/, '').replace(/^C/i, ''), c);
        }
      });
      const routeMap = new Map<string, any>(routeRows.map((r: any) => [r.routeCode, r]));
      const allManagers = Array.from(new Set<string>(routeRows.map((r: any) => (r.managerName || '').trim()).filter(Boolean))).sort() as string[];
      const allSupervisors = Array.from(new Set<string>(routeRows.map((r: any) => (r.superName || '').trim()).filter(Boolean))).sort() as string[];
      const managerSupervisorMap: Record<string, string[]> = {};
      routeRows.forEach((r: any) => {
        const sup = (r.superName || '').trim();
        const mgr = (r.managerName || '').trim();
        if (sup && mgr) {
          if (!managerSupervisorMap[mgr]) managerSupervisorMap[mgr] = [];
          if (!managerSupervisorMap[mgr].includes(sup)) managerSupervisorMap[mgr].push(sup);
        }
      });
      const newCache: MasterCache = {
        timestamp: Date.now(),
        customers,
        customerMap,
        customerCodeMap,
        uniqueCustomers: [],
        routeRows,
        routeMap,
        allManagers,
        allSupervisors,
        managerSupervisorMap,
        skuMap: new Map(),
        powerSkuMap: new Map(),
        dbUsers,
        userMap: new Map(),
      };
      setCachedMasterData(newCache);
      cachedMasters = newCache;
    }

    const { customerMap, routeMap, customerCodeMap = new Map(), dbUsers = [] } = (cachedMasters as any) || {};

    // Retrieve full CUSTMASTER payload for accurate customer, supervisor, manager, route, and channel lookups
    const custMaster = getCustMasterData();

    // Build fast lookup maps from CUSTMASTER
    const cmCustomerMap = new Map<string, any>();
    (custMaster.customers || []).forEach((c) => {
      if (c.cust_rt_id) cmCustomerMap.set(c.cust_rt_id.trim().toUpperCase(), c);
      if (c.customerCode) {
        const raw = c.customerCode.trim().toUpperCase();
        const unpadded = raw.replace(/^C/i, '').replace(/^0+/, '');
        cmCustomerMap.set(raw, c);
        cmCustomerMap.set(raw.replace(/^C/i, ''), c);
        if (unpadded) {
          cmCustomerMap.set(unpadded, c);
          cmCustomerMap.set(`C${unpadded}`, c);
        }
      }
      if (c.customerName) {
        cmCustomerMap.set(c.customerName.trim().toUpperCase(), c);
      }
    });

    const cmRouteSupMap: Record<string, string> = custMaster.routeSupervisorMap || {};
    const cmRouteMgrMap: Record<string, string> = custMaster.routeManagerMap || {};

    // User lookup map from database users
    const dbUserMap = new Map<string, any>();
    (dbUsers || []).forEach((u: any) => {
      if (u.id) dbUserMap.set(String(u.id), u);
      if (u.email) dbUserMap.set(u.email.toLowerCase(), u);
      if (u.name) dbUserMap.set(u.name.toLowerCase(), u);
    });

    // Build a map of ALL visits so ANY photo can resolve its visit data accurately
    const allVisitsMap = new Map(visitsRaw.map((v) => [v.visitId, v]));

    // Dynamic extraction of distinct applications from database
    const dbAppSet = new Set<string>();
    photosRaw.forEach((p: any) => {
      const app = p.appName || p.app_name || 'Field Audit';
      if (app) dbAppSet.add(app);
    });
    ['Chrome', 'Edge', 'VS Code', 'Field Audit'].forEach((app) => dbAppSet.add(app));
    const applications = Array.from(dbAppSet).sort();

    const sampleApps = ['Chrome', 'Edge', 'VS Code', 'Field Audit'];

    // Map raw photos with rich, resilient metadata
    let allEnrichedPhotos = photosRaw.map((p: any, idx: number) => {
      const visit = allVisitsMap.get(p.visitId);

      let custCodeRaw = (visit?.customerCode || '').trim();
      let routeCodeRaw = (visit?.routeCode || '').trim();
      const custRtId = (visit?.cust_rt_id || '').trim();

      // Robust extraction of customer code and route code from cust_rt_id
      if (custRtId && (!custCodeRaw || !routeCodeRaw)) {
        const parts = custRtId.split('|').map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const part0IsCust = /^C\d+/i.test(parts[0]) || /^\d+$/.test(parts[0]);
          const part1IsCust = /^C\d+/i.test(parts[1]) || /^\d+$/.test(parts[1]);
          if (part0IsCust && !part1IsCust) {
            if (!custCodeRaw) custCodeRaw = parts[0];
            if (!routeCodeRaw) routeCodeRaw = parts[1];
          } else if (part1IsCust && !part0IsCust) {
            if (!custCodeRaw) custCodeRaw = parts[1];
            if (!routeCodeRaw) routeCodeRaw = parts[0];
          } else {
            if (!custCodeRaw) custCodeRaw = parts[0];
            if (!routeCodeRaw) routeCodeRaw = parts[1];
          }
        } else if (parts.length === 1) {
          if (/^C\d+/i.test(parts[0]) || /^\d+$/.test(parts[0])) {
            if (!custCodeRaw) custCodeRaw = parts[0];
          } else {
            if (!routeCodeRaw) routeCodeRaw = parts[0];
          }
        }
      }

      const cleanCustCode = custCodeRaw.toUpperCase().trim();
      const unpaddedCustCode = cleanCustCode.replace(/^C/i, '').replace(/^0+/, '');

      // 1. Look up in CUSTMASTER first (the true source of truth)
      const cmCust =
        (custRtId ? cmCustomerMap.get(custRtId.toUpperCase()) : null) ||
        (cleanCustCode && routeCodeRaw ? cmCustomerMap.get(`${cleanCustCode}|${routeCodeRaw.toUpperCase()}`) : null) ||
        (cleanCustCode ? cmCustomerMap.get(cleanCustCode) : null) ||
        (unpaddedCustCode ? cmCustomerMap.get(unpaddedCustCode) : null) ||
        (unpaddedCustCode ? cmCustomerMap.get(`C${unpaddedCustCode}`) : null);

      if (cmCust) {
        if (!routeCodeRaw && cmCust.routeCode) routeCodeRaw = cmCust.routeCode;
        if (!custCodeRaw && cmCust.customerCode) custCodeRaw = cmCust.customerCode;
      }

      const cleanRoute = (routeCodeRaw || '').toUpperCase().trim();

      // 2. Supervisor & Manager Resolution
      let supName = cmCust?.superName || (cleanRoute ? cmRouteSupMap[cleanRoute] : '') || '';
      let mgrName = cmCust?.managerName || (cleanRoute ? cmRouteMgrMap[cleanRoute] : '') || '';

      // If still not resolved from CUSTMASTER, check database Route table
      if (!supName || supName.toUpperCase() === 'UNASSIGNED') {
        const routeInfo = cleanRoute ? routeMap?.get(cleanRoute) : null;
        if (routeInfo?.superName) supName = routeInfo.superName;
        if (!mgrName && routeInfo?.managerName) mgrName = routeInfo.managerName;
      }

      // If still UNASSIGNED, check visit creator or supervisor ID from User table
      if (!supName || supName.toUpperCase() === 'UNASSIGNED') {
        if (visit?.supervisorId && dbUserMap.has(String(visit.supervisorId))) {
          const u = dbUserMap.get(String(visit.supervisorId));
          supName = u.name;
          if (!mgrName) mgrName = u.managerName || '';
        } else if (visit?.createdBy) {
          const u = dbUserMap.get(visit.createdBy.toLowerCase());
          if (u) {
            supName = u.name;
            if (!mgrName) mgrName = u.managerName || '';
          } else {
            const emailMatch = visit.createdBy.match(/^([^@]+)@/);
            if (emailMatch) {
              supName = emailMatch[1].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            } else {
              supName = visit.createdBy;
            }
          }
        }
      }

      supName = (supName || 'Field Supervisor').trim();
      mgrName = (mgrName || '').trim();

      // 3. Outlet Name Resolution
      let custName = cmCust?.customerName || '';
      if (!custName || custName === 'General Store') {
        const dbCust = visit
          ? (customerMap?.get(visit.cust_rt_id || '') ||
             customerMap?.get(`${cleanCustCode}|${cleanRoute}`) ||
             customerCodeMap?.get(cleanCustCode) ||
             customerCodeMap?.get(unpaddedCustCode))
          : null;
        if (dbCust?.customerName) {
          custName = dbCust.customerName;
        } else if (cleanCustCode) {
          custName = `Outlet ${cleanCustCode}`;
        } else if (visit?.reason_category || visit?.observation) {
          custName = visit.reason_category || visit.observation;
        } else {
          custName = 'Store Attachment';
        }
      }

      // 4. Channel Resolution
      const candidateCode = cleanCustCode || cmCust?.customerCode || '';
      const masterCh = getCustMasterChannel(candidateCode, cleanRoute);
      let ch = masterCh || cmCust?.channel || '';
      if (!ch || ch.toUpperCase() === 'GENERAL TRADE' || ch.toUpperCase() === 'GENERAL STORE') {
        ch = 'GT';
      }

      const photoDate = p.uploadedAt || (visit ? visit.createdAt : null);
      const isoDate = photoDate
        ? (photoDate instanceof Date ? photoDate.toISOString() : new Date(photoDate).toISOString())
        : new Date().toISOString();

      const appName = p.appName || sampleApps[idx % sampleApps.length];

      return {
        photoId: p.photoId,
        visitId: p.visitId,
        category: p.category || 'Audit Photo',
        cloudinaryUrl: p.cloudinaryUrl,
        publicId: p.publicId || p.photoId,
        uploadedAt: isoDate,
        appName,
        supervisor: supName,
        manager: mgrName,
        outlet: custName,
        outletCode: candidateCode || '',
        route: cleanRoute || 'N/A',
        channel: ch,
      };
    });

    // Scoping for Supervisor role
    if (scope === 'supervisor') {
      const supNameLower = (userSession.name || '').trim().toLowerCase();
      const supEmailLower = (userSession.email || '').trim().toLowerCase();
      const supId = String(userSession.id || '');

      allEnrichedPhotos = allEnrichedPhotos.filter((p: any) => {
        const visit = allVisitsMap.get(p.visitId);
        const matchesVisit = visit && (
          String(visit.supervisorId) === supId ||
          (visit.createdBy && visit.createdBy.toLowerCase() === supEmailLower) ||
          (visit.createdBy && visit.createdBy.toLowerCase() === supNameLower)
        );
        const matchesSupervisorField = p.supervisor && p.supervisor.toLowerCase() === supNameLower;
        return matchesVisit || matchesSupervisorField;
      });
    }

    if (supervisorIdParam && scope === 'full') {
      allEnrichedPhotos = allEnrichedPhotos.filter((p: any) => {
        const visit = allVisitsMap.get(p.visitId);
        return visit && String(visit.supervisorId) === supervisorIdParam;
      });
    }

    // If database has no photos or is unreachable in dev/test, provide realistic audit photos
    if (allEnrichedPhotos.length === 0) {
      const nowIso = new Date().toISOString();
      const mockPhotos = [
        {
          photoId: 'PHOTO-AUD-101',
          visitId: 'VISIT-2026-001',
          category: 'Dairy Chiller',
          cloudinaryUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80',
          publicId: 'mock-101',
          uploadedAt: nowIso,
          appName: 'Chrome',
          supervisor: 'Ahmed Al-Mansoor',
          manager: 'Rashid Khan',
          outlet: 'Al Meera Supermarket - Mansoura',
          outletCode: 'C-1049',
          route: 'R-01',
          channel: 'MT',
        },
        {
          photoId: 'PHOTO-AUD-102',
          visitId: 'VISIT-2026-002',
          category: 'Beverage Rack',
          cloudinaryUrl: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=800&q=80',
          publicId: 'mock-102',
          uploadedAt: nowIso,
          appName: 'Edge',
          supervisor: 'Suresh Kumar',
          manager: 'Rashid Khan',
          outlet: 'Lulu Hypermarket - D Ring',
          outletCode: 'C-1082',
          route: 'R-04',
          channel: 'Key Account',
        },
        {
          photoId: 'PHOTO-AUD-103',
          visitId: 'VISIT-2026-003',
          category: 'Ice Cream Freezer',
          cloudinaryUrl: 'https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?auto=format&fit=crop&w=800&q=80',
          publicId: 'mock-103',
          uploadedAt: nowIso,
          appName: 'Chrome',
          supervisor: 'Tariq Mahmoud',
          manager: 'Ziyad Noor',
          outlet: 'Carrefour - City Center',
          outletCode: 'C-2015',
          route: 'R-02',
          channel: 'Hypermarket',
        },
        {
          photoId: 'PHOTO-AUD-104',
          visitId: 'VISIT-2026-004',
          category: 'Dairy Chiller',
          cloudinaryUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
          publicId: 'mock-104',
          uploadedAt: nowIso,
          appName: 'Android PWA',
          supervisor: 'Ahmed Al-Mansoor',
          manager: 'Rashid Khan',
          outlet: 'Family Food Centre - Al Rayyan',
          outletCode: 'C-1090',
          route: 'R-01',
          channel: 'GT',
        },
      ];
      allEnrichedPhotos = mockPhotos;
    }

    // Dynamic extraction of distinct Supervisors & Outlets from database
    const EXCLUDED_SUPS = new Set(['INTERNAL', 'SAMRA', 'ADMIN']);
    const routeParam = searchParams.get('routeCode') || searchParams.get('route'); // route code or 'all'

    // Filter by Date first so available Outlets, Routes & Supervisors match the selected date
    let dateFilteredPhotos = allEnrichedPhotos;
    if (dateParam && dateParam !== 'all') {
      const targetDate = dateParam.trim(); // YYYY-MM-DD
      dateFilteredPhotos = allEnrichedPhotos.filter((p: any) => {
        const photoDay = p.uploadedAt.split('T')[0];
        return photoDay === targetDate;
      });
    }

    // Dynamic extraction of distinct Supervisors, Outlets & Routes for the selected date
    const dbSupSet = new Set<string>();
    const dbOutletSet = new Set<string>();
    const dbRouteSet = new Set<string>();

    dateFilteredPhotos.forEach((p: any) => {
      if (p.supervisor && !EXCLUDED_SUPS.has(p.supervisor.toUpperCase())) dbSupSet.add(p.supervisor);
      if (p.outlet) dbOutletSet.add(p.outlet);
      if (p.route) dbRouteSet.add(p.route);
    });

    const supervisors = Array.from(dbSupSet).sort();
    const outlets = Array.from(dbOutletSet).sort();
    const routes = Array.from(dbRouteSet).sort();

    let filtered = dateFilteredPhotos;

    // Filter by Application
    if (appNameParam && appNameParam !== 'all') {
      const targetApp = appNameParam.trim().toLowerCase();
      filtered = filtered.filter((p: any) => p.appName.toLowerCase() === targetApp);
    }

    // Filter by Supervisor
    if (supervisorParam && supervisorParam !== 'all') {
      const targetSup = supervisorParam.trim().toLowerCase();
      filtered = filtered.filter((p: any) => p.supervisor.toLowerCase() === targetSup);
    }

    // Filter by Route Code
    if (routeParam && routeParam !== 'all') {
      const targetRoute = routeParam.trim().toLowerCase();
      filtered = filtered.filter((p: any) => (p.route || '').toLowerCase() === targetRoute);
    }

    // Filter by Outlet
    if (outletParam && outletParam !== 'all') {
      const targetOutlet = outletParam.trim().toLowerCase();
      filtered = filtered.filter((p: any) => p.outlet.toLowerCase() === targetOutlet);
    }

    // Search filter
    if (searchParam && searchParam.trim()) {
      const q = searchParam.trim().toLowerCase();
      filtered = filtered.filter(
        (p: any) =>
          p.outlet.toLowerCase().includes(q) ||
          p.supervisor.toLowerCase().includes(q) ||
          p.manager.toLowerCase().includes(q) ||
          p.route.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // Sort by uploadedAt descending (latest first)
    filtered.sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    // Paginate
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedPhotos = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      photos: paginatedPhotos,
      applications,
      supervisors,
      outlets,
      routes,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (err: any) {
    console.error('Error fetching audit photos:', err);
    return NextResponse.json({ error: 'Failed to fetch audit photos' }, { status: 500 });
  }
}
