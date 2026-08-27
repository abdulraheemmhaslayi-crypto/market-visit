import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerCode = searchParams.get('customerCode');

    if (!customerCode) {
      // Get general stats
      const [stats]: any = await pool.execute(`
        SELECT
          COUNT(*) as totalCustomers,
          SUM(CASE WHEN dairyClassification IS NOT NULL THEN 1 ELSE 0 END) as customersWithDairyClass,
          SUM(CASE WHEN iceCreamClassification IS NOT NULL THEN 1 ELSE 0 END) as customersWithIceCreamClass
        FROM Customer
      `);

      return NextResponse.json({
        stats: stats[0],
        message: 'Run with ?customerCode=C00240 to check specific customer'
      });
    }

    // Check specific customer
    const [rows]: any = await pool.execute(`
      SELECT
        cust_rt_id,
        customerCode,
        customerName,
        classification,
        dairyClassification,
        iceCreamClassification,
        channel,
        routeCode
      FROM Customer
      WHERE customerCode = ?
    `, [customerCode]);

    return NextResponse.json({
      customerCode,
      found: rows.length > 0,
      records: rows,
      message: rows.length === 0 ? 'Customer not found' : `Found ${rows.length} record(s)`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
