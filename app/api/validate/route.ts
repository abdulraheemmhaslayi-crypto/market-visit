import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseSingleFile, mergeParsedData } from '@/utils/xlsx';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const user = session.user as any;
    if (user.role !== 'Admin') {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }
    if (user.status !== 'Active') {
      return NextResponse.json({ error: 'Your account is inactive.' }, { status: 403 });
    }

    const formData = await req.formData();
    const isIndividual = formData.get('individual') === 'true';

    const fileKeys = [
      { key: 'routeMaster', name: 'ROUTE MASTER.xlsx', type: 'routes' as const, required: true },
      { key: 'custMaster', name: 'CUSTMASTER.xlsx', type: 'custMappings' as const, required: true },
      { key: 'skuMaster', name: 'SKUMASTER.xlsx', type: 'skuMaster' as const, required: true },
      { key: 'classification', name: 'Customer_Classification.xlsx', type: 'classification' as const, required: true },
      { key: 'powerSkuMaster', name: 'PowerSku_Master.xlsx', type: 'powerSkus' as const, required: false },
    ];

    const parsedResults: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (const fk of fileKeys) {
      const file = formData.get(fk.key) as File | null;
      if (!file || file.size === 0) {
        if (fk.required && !isIndividual) {
          errors.push({ row: 0, error: `Required file "${fk.name}" was not selected.` });
        }
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const res = parseSingleFile(buffer, file.name, fk.type);
        parsedResults.push({ ...res, buffer, targetFileName: fk.name });
      } catch (error: any) {
        errors.push({ row: 0, error: `${file.name}: Parsing failed - ${error.message}` });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: true,
        routesCount: 0,
        customersCount: 0,
        mappingsCount: 0,
        skusCount: 0,
        powerSkusCount: 0,
        classificationsCount: 0,
        routesPreview: [],
        customersPreview: [],
        mappingsPreview: [],
        skusPreview: [],
        powerSkusPreview: [],
        classificationsPreview: [],
        errors,
        payload: { routes: [], customers: [], mappings: [], skus: [], powerSkus: [], classifications: [] },
      });
    }

    const merged = mergeParsedData(parsedResults);

    // Save validated files to data directory so disk-based master readers (CUSTMASTER, Customer_Classification) are updated immediately
    if (merged.errors.length === 0) {
      try {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        for (const pr of parsedResults) {
          if (pr.buffer && pr.targetFileName) {
            fs.writeFileSync(path.join(dataDir, pr.targetFileName), pr.buffer);
            const lower = pr.targetFileName.toLowerCase();
            if (lower.includes('classification')) {
              fs.writeFileSync(path.join(dataDir, 'Customer_Classification.xlsx'), pr.buffer);
              fs.writeFileSync(path.join(dataDir, 'Customer_Classification_DUMMY.xlsx'), pr.buffer);
            } else if (lower.includes('power')) {
              fs.writeFileSync(path.join(dataDir, 'PowerSku_Master.xlsx'), pr.buffer);
              fs.writeFileSync(path.join(dataDir, 'PowerSku_Master_DUMMY.xlsx'), pr.buffer);
            } else if (lower.includes('custmaster')) {
              fs.writeFileSync(path.join(dataDir, 'CUSTMASTER.xlsx'), pr.buffer);
            } else if (lower.includes('route')) {
              fs.writeFileSync(path.join(dataDir, 'ROUTE MASTER.xlsx'), pr.buffer);
            } else if (lower.includes('sku')) {
              fs.writeFileSync(path.join(dataDir, 'SKUMASTER.xlsx'), pr.buffer);
            }
          }
        }

        // Invalidate in-memory caches
        const { clearCustMasterCache } = await import('@/lib/custmaster-data');
        const { clearCustMasterChannelCache } = await import('@/lib/custmaster-channel');
        const { invalidateDashboardMasterCache } = await import('@/lib/dashboard-cache');
        clearCustMasterCache();
        clearCustMasterChannelCache();
        invalidateDashboardMasterCache();
      } catch (diskErr) {
        console.warn('Could not save uploaded excel files to data directory:', diskErr);
      }
    }

    return NextResponse.json({
      success: true,
      routesCount: merged.payload.routes.length,
      customersCount: merged.payload.customers.length,
      mappingsCount: merged.payload.mappings.length,
      skusCount: merged.payload.skus.length,
      powerSkusCount: merged.payload.powerSkus.length,
      classificationsCount: merged.payload.classifications.length,
      routesPreview: merged.payload.routes.slice(0, 5),
      customersPreview: merged.payload.customers.slice(0, 5),
      mappingsPreview: merged.payload.mappings.slice(0, 5),
      skusPreview: merged.payload.skus.slice(0, 5),
      powerSkusPreview: merged.payload.powerSkus.slice(0, 5),
      classificationsPreview: merged.payload.classifications.slice(0, 5),
      errors: merged.errors,
      payload: merged.payload,
    });
  } catch (error: any) {
    console.error('API Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
