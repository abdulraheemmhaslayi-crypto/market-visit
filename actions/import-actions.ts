'use server';

import { auth } from '@/lib/auth';
import { routeRepository } from '@/repositories/route-repository';
import { customerRepository } from '@/repositories/customer-repository';
import { skuRepository } from '@/repositories/sku-repository';
import { userRepository } from '@/repositories/user-repository';
import { parseSingleFile, mergeParsedData } from '@/utils/xlsx';
import { auditService } from '@/services/audit-service';
import { Route, Customer, CustomerRouteMapping, SKU, ImportSummary, PowerSKU } from '@/types';
import { revalidatePath } from 'next/cache';

const verifyAdminSession = async () => {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Authentication required');
  }
  const user = session.user as any;
  if (user.role !== 'Admin') {
    throw new Error('Access denied. Administrator privileges required.');
  }
  if (user.status !== 'Active') {
    throw new Error('Your account is inactive.');
  }
  return session;
};

export async function validateExcelAction(formData: FormData) {
  await verifyAdminSession();

  const isIndividual = formData.get('individual') === 'true';

  const fileKeys = [
    { key: 'routeMaster', name: 'ROUTE MASTER.xlsx', type: 'routes' as const, required: true },
    { key: 'custMaster', name: 'CUSTMASTER.xlsx', type: 'custMappings' as const, required: true },
    { key: 'skuMaster', name: 'SKUMASTER.xlsx', type: 'skuMaster' as const, required: true },
    { key: 'classification', name: 'Customer_Classification_DUMMY.xlsx', type: 'classification' as const, required: true },
    { key: 'powerSkuMaster', name: 'PowerSku_Master_DUMMY.xlsx', type: 'powerSkus' as const, required: false },
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
      parsedResults.push(res);
    } catch (error: any) {
      errors.push({ row: 0, error: `${file.name}: Parsing failed - ${error.message}` });
    }
  }

  if (errors.length > 0) {
    return {
      success: true,
      routesCount: 0,
      customersCount: 0,
      mappingsCount: 0,
      skusCount: 0,
      powerSkusCount: 0,
      routesPreview: [],
      customersPreview: [],
      mappingsPreview: [],
      skusPreview: [],
      powerSkusPreview: [],
      errors,
      payload: { routes: [], customers: [], mappings: [], skus: [], powerSkus: [] },
    };
  }

  const merged = mergeParsedData(parsedResults);

  return {
    success: true,
    routesCount: merged.payload.routes.length,
    customersCount: merged.payload.customers.length,
    mappingsCount: merged.payload.mappings.length,
    skusCount: merged.payload.skus.length,
    powerSkusCount: merged.payload.powerSkus.length,
    routesPreview: merged.payload.routes.slice(0, 5),
    customersPreview: merged.payload.customers.slice(0, 5),
    mappingsPreview: merged.payload.mappings.slice(0, 5),
    skusPreview: merged.payload.skus.slice(0, 5),
    powerSkusPreview: merged.payload.powerSkus.slice(0, 5),
    errors: merged.errors,
    payload: merged.payload,
  };
}

export async function importExcelAction(payload: {
  routes: Route[];
  customers: Customer[];
  mappings: CustomerRouteMapping[];
  skus: SKU[];
  powerSkus?: PowerSKU[];
  clearObsolete?: boolean;
}): Promise<ImportSummary> {
  const session = await verifyAdminSession();
  const { routes, customers, mappings, skus, powerSkus, clearObsolete } = payload;

  let inserted = 0;
  let updated = 0;
  let removed = 0;
  let skipped = 0;
  const failed = 0;
  const errors: { row: number; error: string }[] = [];
  const unmappedSupervisors = new Set<string>();

  try {
    // 1. Fetch all supervisors and check for duplicates in system database
    const users = await userRepository.getAllUsers();
    const supervisors = users.filter((u) => u.role === 'Supervisor');
    
    const supervisorNames = supervisors.map((u) => u.name.trim().toLowerCase());
    const duplicates = supervisorNames.filter((name, i) => supervisorNames.indexOf(name) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Import failed: Duplicate supervisor name(s) found in system database: ${Array.from(new Set(duplicates)).join(', ')}`);
    }

    const poolConnection = require('@/lib/db').default;

    // 2. Import Routes with Supervisor & Manager Mapping
    if (routes.length > 0) {
      const routesToImport: Route[] = [];

      for (const r of routes) {
        // Resolve Manager
        const managerName = (r.managerName || '').trim();
        let managerId = null;
        if (managerName) {
          const [mRows]: any = await poolConnection.execute(
            'SELECT `id` FROM `Manager` WHERE LOWER(\`name\`) = LOWER(?) LIMIT 1',
            [managerName]
          );
          if (mRows.length > 0) {
            managerId = mRows[0].id;
          } else {
            managerId = 'mng_' + Math.random().toString(36).substring(2, 9);
            await poolConnection.execute(
              'INSERT INTO `Manager` (`id`, `name`) VALUES (?, ?)',
              [managerId, managerName]
            );
          }
        }

        // Resolve Supervisor
        const superName = (r.superName || '').trim();
        let supervisorId = null;
        if (superName) {
          const cleanSuperName = superName.toLowerCase().replace(/\s+/g, '');
          const matchedSuper = supervisors.find((u) => {
            const cleanName = u.name.toLowerCase().replace(/\s+/g, '');
            const cleanCode = (u.employeeCode || '').toLowerCase().replace(/\s+/g, '');
            return (
              cleanName === cleanSuperName ||
              cleanName.includes(cleanSuperName) ||
              cleanSuperName.includes(cleanName) ||
              (cleanCode && cleanCode === cleanSuperName)
            );
          });
          if (matchedSuper) {
            supervisorId = matchedSuper.id;
            // Establish One Manager -> Many Supervisors relationship
            if (managerId) {
              await poolConnection.execute(
                'UPDATE `User` SET `managerId` = ? WHERE `id` = ?',
                [managerId, supervisorId]
              );
            }
          } else {
            unmappedSupervisors.add(superName);
          }
        }

        routesToImport.push({
          ...r,
          supervisorId,
          managerId,
        });
      }

      const res = await routeRepository.upsertRoutes(routesToImport);
      inserted += res.inserted;
      updated += res.updated;
    }

    // 3. Import Customers
    if (customers.length > 0) {
      const res = await customerRepository.upsertCustomers(customers);
      inserted += res.inserted;
      updated += res.updated;
    }

    // 4. Import Customer-Route Mappings
    if (mappings.length > 0) {
      const res = await customerRepository.upsertMappings(mappings);
      inserted += res.inserted;
      updated += res.updated;
    }

    // 5. Import SKUs
    if (skus.length > 0) {
      const res = await skuRepository.upsertSkus(skus);
      inserted += res.inserted;
      updated += res.updated;
    }

    // 6. Import Power SKUs
    if (powerSkus && powerSkus.length > 0) {
      const res = await skuRepository.upsertPowerSkus(powerSkus);
      inserted += res.inserted;
      updated += res.updated;
    }

    // 7. Clear Obsolete entries if clearObsolete flag is true
    if (clearObsolete) {
      if (routes.length > 0) {
        const activeRouteCodes = routes.map((r) => r.routeCode);
        removed += await routeRepository.clearObsoleteRoutes(activeRouteCodes);
      }
      if (customers.length > 0) {
        const activeCustRtIds = customers.map((c) => c.cust_rt_id);
        removed += await customerRepository.clearObsoleteCustomers(activeCustRtIds);
      }
      if (mappings.length > 0) {
        const activeMappingIds = mappings.map((m) => m.cust_rt_id);
        removed += await customerRepository.clearObsoleteMappings(activeMappingIds);
      }
      if (skus.length > 0) {
        const activeSkuCodes = skus.map((s) => s.skuCode);
        removed += await skuRepository.clearObsoleteSkus(activeSkuCodes);
      }
      if (powerSkus && powerSkus.length > 0) {
        const activePowerSkuKeys = powerSkus.map(
          (ps) => `${ps.skuCode.trim().toUpperCase()}_${ps.channel.trim().toUpperCase()}`
        );
        removed += await skuRepository.clearObsoletePowerSkus(activePowerSkuKeys);
      }
    }

    const adminUser = session.user?.email || 'Admin';
    await auditService.logAction(
      adminUser,
      'Excel Master Import',
      `Imported/Upserted masters. Totals: Inserted: ${inserted}, Updated: ${updated}, Removed: ${removed}`
    );

    revalidatePath('/', 'layout');

    return {
      inserted,
      updated,
      removed,
      failed,
      errors,
      skipped,
      unmappedSupervisors: Array.from(unmappedSupervisors),
    };
  } catch (error: any) {
    console.error('Import action failed:', error);
    throw new Error(`Master Data Import failed: ${error.message}`);
  }
}
