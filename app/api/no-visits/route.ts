import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';
import { getDashboardScope } from '@/lib/roles';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSession = session.user as any;
    const role = userSession.role as string | undefined;
    const scope = getDashboardScope(role);

    // Build query with safe column handling
    let query = `
      SELECT 
        v.visitId,
        v.supervisorId,
        v.cust_rt_id,
        v.visit_type,
        v.reason_category,
        v.reason,
        v.observation,
        v.latitude,
        v.longitude,
        v.accuracy,
        v.status,
        v.visit_datetime,
        v.createdAt
      FROM \`Visit\` v
      WHERE v.status = 'Submitted'
        AND (v.visit_type = 'No Visit' OR v.reason_category IS NOT NULL)
    `;
    const params: any[] = [];

    if (scope === 'supervisor') {
      query += ' AND v.supervisorId = ?';
      params.push(userSession.id);
    }

    query += ' ORDER BY v.createdAt DESC';

    const [visitRows]: any = await pool.execute(query, params);

    if (!visitRows || visitRows.length === 0) {
      return NextResponse.json({
        success: true,
        visits: [],
        supervisors: [],
        reasonCategories: [],
        stats: { total: 0, today: 0, uniqueOutlets: 0, topReason: '—' },
      });
    }

    // Fetch related Master Data for lookup
    const [customerRows]: any = await pool.execute(
      'SELECT `cust_rt_id`, `customerCode`, `customerName`, `channel`, `routeCode` FROM `Customer`'
    ).catch(() => [[]]);
    const customerMap = new Map<string, any>();
    const customerCodeMap = new Map<string, any>();
    (customerRows as any[]).forEach((c) => {
      if (c.cust_rt_id) customerMap.set(c.cust_rt_id, c);
      if (c.customerCode) customerCodeMap.set(c.customerCode, c);
    });

    const [routeRows]: any = await pool.execute(
      'SELECT `routeCode`, `routeName`, `channel`, `superName` FROM `Route`'
    ).catch(() => [[]]);
    const routeMap = new Map<string, any>();
    (routeRows as any[]).forEach((r) => {
      if (r.routeCode) routeMap.set(r.routeCode, r);
    });

    const [userRows]: any = await pool.execute(
      'SELECT `id`, `name`, `employeeCode` FROM `User`'
    ).catch(() => [[]]);
    const userMap = new Map<string, any>();
    (userRows as any[]).forEach((u) => {
      if (u.id) userMap.set(u.id, u);
    });

    // Fetch photos for these visits
    const visitIds = visitRows.map((v: any) => v.visitId);
    const photosMap = new Map<string, any[]>();
    if (visitIds.length > 0) {
      const chunks = [];
      const chunkSize = 200;
      for (let i = 0; i < visitIds.length; i += chunkSize) {
        chunks.push(visitIds.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        const placeholders = chunk.map(() => '?').join(',');
        const [photoRows]: any = await pool.execute(
          `SELECT \`photoId\`, \`visitId\`, \`category\`, \`cloudinaryUrl\`, \`uploadedAt\` 
           FROM \`VisitPhoto\` 
           WHERE \`visitId\` IN (${placeholders})`,
          chunk
        ).catch(() => [[]]);

        (photoRows as any[]).forEach((p) => {
          if (!photosMap.has(p.visitId)) photosMap.set(p.visitId, []);
          photosMap.get(p.visitId)!.push({
            photoId: p.photoId,
            category: p.category,
            cloudinaryUrl: p.cloudinaryUrl,
            uploadedAt: p.uploadedAt,
          });
        });
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const uniqueOutletsSet = new Set<string>();
    const reasonCounts: Record<string, number> = {};
    const supervisorSet = new Set<string>();
    const reasonCategorySet = new Set<string>();

    const enrichedVisits = visitRows.map((v: any) => {
      const [parsedCustCode, parsedRouteCode] = (v.cust_rt_id || '').split('|');
      const routeCode = parsedRouteCode || '';
      const customerCode = parsedCustCode || '';

      const customer = customerMap.get(v.cust_rt_id || '') || customerCodeMap.get(customerCode);
      const route = routeMap.get(routeCode);
      const supervisor = userMap.get(v.supervisorId);

      const customerName = customer ? customer.customerName : customerCode || 'Unknown Outlet';
      const channel = customer?.channel || route?.channel || 'GT';
      const routeName = route ? route.routeName : (routeCode || '—');
      const supervisorName = supervisor ? supervisor.name : (route?.superName || 'Unassigned');
      const supervisorCode = supervisor?.employeeCode || '';

      const rawDate = v.createdAt || v.visit_datetime;
      const createdAtIso = rawDate instanceof Date ? rawDate.toISOString() : (rawDate ? new Date(rawDate).toISOString() : new Date().toISOString());

      const reasonCategory = v.reason_category || 'Other';
      const reason = v.reason || v.observation || '';

      if (customerCode || v.cust_rt_id) {
        uniqueOutletsSet.add(v.cust_rt_id || customerCode);
      }

      if (supervisorName && supervisorName !== 'Unassigned') {
        supervisorSet.add(supervisorName);
      }

      reasonCategorySet.add(reasonCategory);
      reasonCounts[reasonCategory] = (reasonCounts[reasonCategory] || 0) + 1;

      return {
        visitId: v.visitId,
        date: createdAtIso,
        createdAt: createdAtIso,
        supervisorId: v.supervisorId,
        supervisorName,
        supervisorCode,
        routeCode,
        routeName,
        customerCode,
        customerName,
        channel,
        reasonCategory,
        reason,
        observation: v.observation || '',
        latitude: v.latitude ?? null,
        longitude: v.longitude ?? null,
        accuracy: v.accuracy ?? null,
        photos: photosMap.get(v.visitId) || [],
      };
    });

    const todayCount = enrichedVisits.filter((v: any) => v.date.startsWith(todayStr)).length;

    let topReason = '—';
    let maxReasonCount = 0;
    Object.entries(reasonCounts).forEach(([cat, count]) => {
      if (count > maxReasonCount) {
        maxReasonCount = count;
        topReason = cat;
      }
    });

    return NextResponse.json(
      {
        success: true,
        visits: enrichedVisits,
        supervisors: Array.from(supervisorSet).sort(),
        reasonCategories: Array.from(reasonCategorySet).sort(),
        stats: {
          total: enrichedVisits.length,
          today: todayCount,
          uniqueOutlets: uniqueOutletsSet.size,
          topReason,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in /api/no-visits:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch no-visit records' },
      { status: 500 }
    );
  }
}
