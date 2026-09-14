import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';

interface ClassificationUpdate {
  customerCode: string;
  dairyClassification?: string | null;
  iceCreamClassification?: string | null;
}

/**
 * Admin endpoint to bulk update classifications.
 *
 * POST /api/admin/update-classifications
 * Body: {
 *   updates: [
 *     { customerCode: "00240", dairyClassification: "C", iceCreamClassification: "B" },
 *     ...
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: provide updates array' },
        { status: 400 }
      );
    }

    let successCount = 0;
    const results: any[] = [];

    for (const update of updates) {
      const { customerCode, dairyClassification, iceCreamClassification } = update;

      if (!customerCode) {
        results.push({
          customerCode,
          status: 'error',
          message: 'Missing customerCode'
        });
        continue;
      }

      try {
        // Update both fields if provided
        const updates: string[] = [];
        const values: any[] = [];

        if (dairyClassification !== undefined) {
          updates.push('dairyClassification = ?');
          values.push(dairyClassification || null);
        }

        if (iceCreamClassification !== undefined) {
          updates.push('iceCreamClassification = ?');
          values.push(iceCreamClassification || null);
        }

        if (updates.length === 0) {
          results.push({
            customerCode,
            status: 'skipped',
            message: 'No classifications provided'
          });
          continue;
        }

        const cleanCode = String(customerCode).trim().toUpperCase();
        const altCode = cleanCode.startsWith('C') ? cleanCode.substring(1) : `C${cleanCode}`;
        values.push(cleanCode, altCode);

        const [result]: any = await pool.execute(
          `UPDATE Customer SET ${updates.join(', ')} WHERE UPPER(TRIM(customerCode)) = ? OR UPPER(TRIM(customerCode)) = ?`,
          values
        );

        if (result.affectedRows > 0) {
          successCount++;
          results.push({
            customerCode,
            status: 'success',
            dairy: dairyClassification,
            ice: iceCreamClassification,
            affectedRows: result.affectedRows
          });
        } else {
          results.push({
            customerCode,
            status: 'not_found',
            message: 'Customer not found in database'
          });
        }
      } catch (error: any) {
        results.push({
          customerCode,
          status: 'error',
          message: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: updates.length,
      updated: successCount,
      results
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET endpoint to fetch current classifications for verification
 *
 * GET /api/admin/update-classifications?customerCode=00240
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerCode = searchParams.get('customerCode');

    if (!customerCode) {
      return NextResponse.json(
        { error: 'Provide ?customerCode=XXX parameter' },
        { status: 400 }
      );
    }

    const cleanCode = String(customerCode).trim().toUpperCase();
    const altCode = cleanCode.startsWith('C') ? cleanCode.substring(1) : `C${cleanCode}`;

    const [rows]: any = await pool.execute(
      `SELECT
        customerCode,
        customerName,
        dairyClassification,
        iceCreamClassification
      FROM Customer
      WHERE UPPER(TRIM(customerCode)) = ? OR UPPER(TRIM(customerCode)) = ?`,
      [cleanCode, altCode]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        found: false,
        customerCode,
        message: 'Customer not found'
      });
    }

    return NextResponse.json({
      found: true,
      customer: rows[0]
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
