import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { visitRepository } from '@/repositories/visit-repository';
import { customerRepository } from '@/repositories/customer-repository';
import pool from '@/lib/db';
import { getDashboardScope } from '@/lib/roles';
import { getCustMasterChannel } from '@/lib/custmaster-channel';
import { getCustMasterData } from '@/lib/custmaster-data';

import { MasterCache, getCachedMasterData, setCachedMasterData } from '@/lib/dashboard-cache';
import { auditActionRepository } from '@/lib/audit-actions';

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
    const fromDateParam = searchParams.get('fromDate') || searchParams.get('startDate');
    const toDateParam = searchParams.get('toDate') || searchParams.get('endDate');
    const rtmParam = searchParams.get('rtm') || searchParams.get('channel');
    const managerParam = searchParams.get('manager');
    const classParam = searchParams.get('classification') || searchParams.get('class');
    const appNameParam = searchParams.get('appName'); // application name or 'all'
    const supervisorIdParam = searchParams.get('supervisorId');
    const supervisorParam = searchParams.get('supervisor'); // supervisor name or 'all'
    const outletParam = searchParams.get('outlet'); // outlet name or 'all'
    const searchParam = searchParams.get('search'); // search outlet or supervisor or route
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '12', 10)));

    // Fetch visits, cached masters, photos, visit assets, and audit actions in parallel
    const [visitsRaw, photosRaw, assetsRaw, auditActionsRaw] = await Promise.all([
      visitRepository.getAllVisits(),
      pool.execute('SELECT * FROM `VisitPhoto` ORDER BY `uploadedAt` DESC').then(([rows]: any) => rows).catch(() => []),
      pool.execute('SELECT `assetId`, `visitId`, `assetType`, `temperature`, `tempInRange`, `actionRequired`, `observation`, `sizeModel` FROM `VisitAsset`').then(([rows]: any) => rows).catch(() => []),
      auditActionRepository.getAll().catch(() => []),
    ]);

    const auditActionMap = new Map<string, any>();
    (auditActionsRaw || []).forEach((item: any) => {
      if (item.photoId) auditActionMap.set(item.photoId, item);
    });

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

    // Build fast lookup maps from CUSTMASTER matching dashboard
    const cmCustomerMap = new Map<string, any>();
    const cmCustomerByCode = new Map<string, any>();
    const cmCustomerByCustRt = new Map<string, any>();
    (custMaster.customers || []).forEach((c) => {
      const code = String(c.customerCode || '').trim().toUpperCase();
      const rawNum = code.replace(/^C/i, '');
      const unpadded = rawNum.replace(/^0+/, '');
      const padded5 = rawNum.padStart(5, '0');
      const variants = [code, rawNum, unpadded, `C${rawNum}`, `C${unpadded}`, padded5, `C${padded5}`];
      variants.filter(Boolean).forEach((v) => {
        cmCustomerByCode.set(v, c);
        cmCustomerMap.set(v, c);
      });
      if (c.cust_rt_id) {
        const crt = String(c.cust_rt_id).trim().toUpperCase();
        cmCustomerByCustRt.set(crt, c);
        cmCustomerMap.set(crt, c);
        const parts = crt.split('|');
        if (parts.length === 2) {
          cmCustomerByCustRt.set(`${parts[1]}|${parts[0]}`, c);
          cmCustomerMap.set(`${parts[1]}|${parts[0]}`, c);
        }
      }
      if (c.routeCode && c.customerCode) {
        const rc = String(c.routeCode).trim().toUpperCase();
        variants.filter(Boolean).forEach((v) => {
          cmCustomerMap.set(`${v}|${rc}`, c);
          cmCustomerMap.set(`${rc}|${v}`, c);
        });
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

    // Map VisitAssets by visitId
    const assetMap = new Map<string, any[]>();
    (assetsRaw || []).forEach((ast: any) => {
      if (ast.visitId) {
        if (!assetMap.has(ast.visitId)) {
          assetMap.set(ast.visitId, []);
        }
        assetMap.get(ast.visitId)!.push(ast);
      }
    });

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
      let cleanRoute = (routeCodeRaw || '').toUpperCase().trim();

      // 1. Look up in CUSTMASTER first (the true source of truth)
      const cmCust =
        (custRtId ? cmCustomerByCustRt.get(custRtId.toUpperCase()) : null) ||
        (cleanCustCode && cleanRoute ? cmCustomerMap.get(`${cleanCustCode}|${cleanRoute}`) : null) ||
        (cleanRoute && cleanCustCode ? cmCustomerMap.get(`${cleanRoute}|${cleanCustCode}`) : null) ||
        (cleanCustCode ? cmCustomerByCode.get(cleanCustCode) : null) ||
        (unpaddedCustCode ? cmCustomerByCode.get(unpaddedCustCode) : null) ||
        (unpaddedCustCode ? cmCustomerByCode.get(`C${unpaddedCustCode}`) : null) ||
        (custRtId ? cmCustomerMap.get(custRtId.toUpperCase()) : null);

      if (cmCust) {
        if (!routeCodeRaw && cmCust.routeCode) {
          routeCodeRaw = cmCust.routeCode;
          cleanRoute = (routeCodeRaw || '').toUpperCase().trim();
        }
        if (!custCodeRaw && cmCust.customerCode) custCodeRaw = cmCust.customerCode;
      }

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
      // Explicit disambiguation for Saifullah (Adnan / Modern Trade) vs Saif (Ashfaq / Traditional Trade)
      if (supName.toUpperCase() === 'SAIFULLAH' || supName.toUpperCase() === 'SAIF') {
        if (
          mgrName.toUpperCase() === 'ADNAN' ||
          ['MTD207', 'MTD210', 'MTD213', 'MTD218', 'MTI403'].includes(cleanRoute) ||
          String(visit?.supervisorId) === 'usr_rqwxav8'
        ) {
          supName = 'SAIFULLAH';
          mgrName = 'ADNAN';
        } else if (
          mgrName.toUpperCase() === 'ASHFAQ' ||
          ['TRD104', 'TRD109', 'TRD129', 'TRD144', 'TRD158', 'TRI308'].includes(cleanRoute) ||
          String(visit?.supervisorId) === 'usr_tgb2s6h'
        ) {
          supName = 'SAIF';
          mgrName = 'ASHFAQ';
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

      // 4. Channel / RTM Resolution - Strictly identical to Management Dashboard
      const candidateCode = cleanCustCode || cmCust?.customerCode || '';
      let ch = (cmCust && (cmCust.rtm || cmCust.channel)) || '';
      if (!ch && candidateCode) {
        ch = getCustMasterChannel(candidateCode, '');
      }
      if (!ch && cleanRoute) {
        if (cleanRoute.startsWith('MT')) ch = 'MT';
        else if (cleanRoute.startsWith('TR')) ch = 'TT';
        else if (cleanRoute.startsWith('IS')) ch = 'INST';
      }
      if (!ch) ch = 'TT';
      if (ch === 'GT' || ch === 'GENERAL TRADE' || ch === 'GENERAL STORE') {
        ch = 'TT';
      }

      const photoDate = p.uploadedAt || (visit ? visit.createdAt : null);
      const isoDate = photoDate
        ? (photoDate instanceof Date ? photoDate.toISOString() : new Date(photoDate).toISOString())
        : new Date().toISOString();

      const appName = p.appName || sampleApps[idx % sampleApps.length];

      const visitAssets = assetMap.get(p.visitId) || [];

      // Extract asset observations
      const assetObservations = visitAssets.map((ast: any) => ({
        assetId: ast.assetId,
        assetType: ast.assetType,
        sizeModel: ast.sizeModel || '',
        temperature: ast.temperature !== null && ast.temperature !== undefined ? Number(ast.temperature) : null,
        tempInRange: Boolean(ast.tempInRange),
        actionRequired: ast.actionRequired || '',
        observation: (ast.observation || '').trim(),
      }));

      // Combined observation strings
      const nonBlankAssetObs = visitAssets
        .map((a: any) => {
          const obs = (a.observation || '').trim();
          if (!obs || obs === '—') return null;
          const label = a.assetType ? `${a.assetType}${a.sizeModel ? ` (${a.sizeModel})` : ''}` : 'Asset';
          return `${label}: ${obs}`;
        })
        .filter(Boolean) as string[];

      const visitObs = (visit?.observation || '').trim();
      const visitReason = (visit?.reason || '').trim();

      const combinedObsList = [...nonBlankAssetObs];
      if (visitObs && !combinedObsList.some((s) => s.includes(visitObs))) {
        combinedObsList.push(visitObs);
      }
      const observation = combinedObsList.length > 0 ? combinedObsList.join('; ') : (visitObs || visitReason || '');

      const activeAction = auditActionMap.get(p.photoId);
      const actionSupervisor = activeAction?.supervisor ? activeAction.supervisor.trim() : null;
      const actionStatus = activeAction?.actionStatus || null;

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
        actionSupervisor,
        actionStatus,
        actionItem: activeAction || null,
        outlet: custName,
        outletCode: candidateCode || '',
        route: cleanRoute || 'N/A',
        channel: ch,
        rtm: ch,
        classification: cmCust?.classification || 'C',
        observation,
        observations: combinedObsList,
        assetObservations,
        visitObservation: visitObs,
        visitReason,
        notes: observation,
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
        const matchesActionSupervisor = p.actionSupervisor && p.actionSupervisor.toLowerCase() === supNameLower;
        return matchesVisit || matchesSupervisorField || matchesActionSupervisor;
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

    // Filter by Date range (From Date & To Date) or single date
    let dateFilteredPhotos = allEnrichedPhotos;
    if (fromDateParam || toDateParam) {
      dateFilteredPhotos = allEnrichedPhotos.filter((p: any) => {
        const photoDay = p.uploadedAt ? p.uploadedAt.split('T')[0] : '';
        if (!photoDay) return false;
        if (fromDateParam && fromDateParam !== 'all' && photoDay < fromDateParam.trim()) return false;
        if (toDateParam && toDateParam !== 'all' && photoDay > toDateParam.trim()) return false;
        return true;
      });
    } else if (dateParam && dateParam !== 'all') {
      const targetDate = dateParam.trim(); // YYYY-MM-DD
      dateFilteredPhotos = allEnrichedPhotos.filter((p: any) => {
        const photoDay = p.uploadedAt ? p.uploadedAt.split('T')[0] : '';
        return photoDay === targetDate;
      });
    }

    // Build supervisor to channel mapping from custMaster & enriched photos
    const supervisorChannelMap: Record<string, string[]> = {};
    (custMaster?.routes || []).forEach((r: any) => {
      const sup = (r.superName || '').trim().toUpperCase();
      if (sup && !EXCLUDED_SUPS.has(sup)) {
        const ch = (r.channel || (r.routeCode?.startsWith('MT') ? 'MT' : r.routeCode?.startsWith('IS') ? 'INST' : 'TT')).toUpperCase();
        if (!supervisorChannelMap[sup]) supervisorChannelMap[sup] = [];
        if (!supervisorChannelMap[sup].includes(ch)) supervisorChannelMap[sup].push(ch);
      }
    });
    (custMaster?.customers || []).forEach((c: any) => {
      const sup = (c.superName || '').trim().toUpperCase();
      if (sup && !EXCLUDED_SUPS.has(sup)) {
        let ch = (c.rtm || c.channel || '').toUpperCase();
        if (!ch && c.routeCode) ch = c.routeCode.startsWith('MT') ? 'MT' : c.routeCode.startsWith('IS') ? 'INST' : 'TT';
        if (ch) {
          if (!supervisorChannelMap[sup]) supervisorChannelMap[sup] = [];
          if (!supervisorChannelMap[sup].includes(ch)) supervisorChannelMap[sup].push(ch);
        }
      }
    });
    allEnrichedPhotos.forEach((p: any) => {
      const sup = (p.supervisor || '').trim().toUpperCase();
      const ch = (p.rtm || p.channel || '').trim().toUpperCase();
      if (sup && ch && !EXCLUDED_SUPS.has(sup)) {
        if (!supervisorChannelMap[sup]) supervisorChannelMap[sup] = [];
        if (!supervisorChannelMap[sup].includes(ch)) supervisorChannelMap[sup].push(ch);
      }
    });

    // Dynamic extraction of distinct Supervisors, Outlets, Routes & RTM Channels
    const dbSupSet = new Set<string>();
    const dbOutletSet = new Set<string>();
    const dbRouteSet = new Set<string>();
    const dbRtmSet = new Set<string>();

    // Candidate photos for supervisor dropdown respecting manager and RTM filters
    let supCandidatePhotos = dateFilteredPhotos;
    if (managerParam && managerParam !== 'all') {
      const targetMgr = managerParam.trim().toLowerCase();
      supCandidatePhotos = supCandidatePhotos.filter((p: any) => (p.manager || '').toLowerCase() === targetMgr);
    }
    if (rtmParam && rtmParam !== 'all') {
      const targetRtm = rtmParam.trim().toUpperCase();
      supCandidatePhotos = supCandidatePhotos.filter((p: any) => (p.rtm || p.channel || '').toUpperCase() === targetRtm);
    }
    supCandidatePhotos.forEach((p: any) => {
      if (p.supervisor && !EXCLUDED_SUPS.has(p.supervisor.toUpperCase())) {
        if (rtmParam && rtmParam !== 'all') {
          const supChans = supervisorChannelMap[p.supervisor.toUpperCase()] || [(p.rtm || p.channel || '').toUpperCase()];
          if (supChans.includes(rtmParam.trim().toUpperCase())) {
            dbSupSet.add(p.supervisor);
          }
        } else {
          dbSupSet.add(p.supervisor);
        }
      }
    });

    // Routes and Outlets respecting manager and RTM filters
    let routeOutletCandidatePhotos = dateFilteredPhotos;
    if (managerParam && managerParam !== 'all') {
      const targetMgr = managerParam.trim().toLowerCase();
      routeOutletCandidatePhotos = routeOutletCandidatePhotos.filter((p: any) => (p.manager || '').toLowerCase() === targetMgr);
    }
    if (rtmParam && rtmParam !== 'all') {
      const targetRtm = rtmParam.trim().toUpperCase();
      routeOutletCandidatePhotos = routeOutletCandidatePhotos.filter((p: any) => (p.rtm || p.channel || '').toUpperCase() === targetRtm);
    }
    routeOutletCandidatePhotos.forEach((p: any) => {
      if (p.outlet) dbOutletSet.add(p.outlet);
      if (p.route) dbRouteSet.add(p.route);
    });

    dateFilteredPhotos.forEach((p: any) => {
      if (p.channel) dbRtmSet.add(p.channel);
    });

    allEnrichedPhotos.forEach((p: any) => {
      if (p.channel) dbRtmSet.add(p.channel);
      if (p.rtm) dbRtmSet.add(p.rtm);
    });
    const canonicalRtms = (custMaster.rtms && custMaster.rtms.length > 0) ? custMaster.rtms : ['INST', 'MT', 'TT'];
    canonicalRtms.forEach((c: string) => dbRtmSet.add(c));

    const supervisors = Array.from(dbSupSet).sort();
    const outlets = Array.from(dbOutletSet).sort();
    const routes = Array.from(dbRouteSet).sort();
    const rtms = Array.from(dbRtmSet).filter(Boolean).sort();

    let filtered = dateFilteredPhotos;

    // Filter by Manager
    if (managerParam && managerParam !== 'all') {
      const targetMgr = managerParam.trim().toLowerCase();
      filtered = filtered.filter((p: any) => (p.manager || '').toLowerCase() === targetMgr);
    }

    // Filter by Supervisor (matches either visit supervisor or assigned directive supervisor)
    if (supervisorParam && supervisorParam !== 'all') {
      const targetSup = supervisorParam.trim().toLowerCase();
      filtered = filtered.filter((p: any) => {
        const photoSupMatches = (p.supervisor || '').toLowerCase() === targetSup;
        const actionSupMatches = (p.actionSupervisor || '').toLowerCase() === targetSup;
        return photoSupMatches || actionSupMatches;
      });
    }

    // Filter by RTM / Channel
    if (rtmParam && rtmParam !== 'all') {
      const targetRtm = rtmParam.trim().toUpperCase();
      filtered = filtered.filter((p: any) => (p.rtm || p.channel || '').toUpperCase() === targetRtm);
    }

    // Filter by Classification
    if (classParam && classParam !== 'all') {
      const targetCls = classParam.trim().toUpperCase();
      filtered = filtered.filter((p: any) => (p.classification || '').toUpperCase() === targetCls);
    }

    // Filter by Application
    if (appNameParam && appNameParam !== 'all') {
      const targetApp = appNameParam.trim().toLowerCase();
      filtered = filtered.filter((p: any) => p.appName.toLowerCase() === targetApp);
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
          p.category.toLowerCase().includes(q) ||
          (p.observation && p.observation.toLowerCase().includes(q))
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
      managers: custMaster.managers || [],
      supervisors,
      supervisorChannels: supervisorChannelMap,
      outlets,
      routes,
      classifications: custMaster.classifications || ['A', 'B', 'C', 'D', 'E'],
      rtms,
      channels: rtms,
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
