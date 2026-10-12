import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const visitId = searchParams.get('visitId');

    if (!visitId) {
      return NextResponse.json({ error: 'Missing visitId parameter' }, { status: 400 });
    }

    const [assetRows]: any = await pool.execute(
      'SELECT `assetId`, `visitId`, `assetType`, `temperature`, `tempInRange`, `actionRequired`, `observation`, `sizeModel` FROM `VisitAsset` WHERE `visitId` = ?',
      [visitId]
    ).catch(() => [[]]);

    const [visitRows]: any = await pool.execute(
      'SELECT `visitId`, `observation`, `reason`, `reason_category` FROM `Visit` WHERE `visitId` = ? LIMIT 1',
      [visitId]
    ).catch(() => [[]]);

    const visit = (visitRows && visitRows[0]) || null;

    const assetObservations = (assetRows || []).map((ast: any) => ({
      assetId: ast.assetId,
      assetType: ast.assetType,
      sizeModel: ast.sizeModel || '',
      temperature: ast.temperature !== null && ast.temperature !== undefined ? Number(ast.temperature) : null,
      tempInRange: Boolean(ast.tempInRange),
      actionRequired: ast.actionRequired || '',
      observation: (ast.observation || '').trim(),
    }));

    const nonBlankAssetObs = assetObservations
      .map((a: any) => {
        const obs = (a.observation || '').trim();
        if (!obs || obs === '—') return null;
        const label = a.assetType ? `${a.assetType}${a.sizeModel ? ` (${a.sizeModel})` : ''}` : 'Asset';
        return `${label}: ${obs}`;
      })
      .filter(Boolean);

    const visitObs = (visit?.observation || '').trim();
    const visitReason = (visit?.reason || '').trim();

    const combinedObsList = [...nonBlankAssetObs];
    if (visitObs && !combinedObsList.some((s: string) => s.includes(visitObs))) {
      combinedObsList.push(visitObs);
    }
    const observation = combinedObsList.length > 0 ? combinedObsList.join('; ') : (visitObs || visitReason || '');

    return NextResponse.json({
      success: true,
      visitId,
      assetObservations,
      observation,
      visitObservation: visitObs,
      visitReason,
      notes: observation,
    });
  } catch (err: any) {
    console.error('Error fetching visit observations:', err);
    return NextResponse.json({ error: 'Failed to fetch visit observations' }, { status: 500 });
  }
}
