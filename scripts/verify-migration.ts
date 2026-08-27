import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

import pool from '../lib/db';

const EXPORT_DIR = path.join(process.cwd(), 'data', 'migration');

const getJsonCount = (filename: string): number => {
  const filePath = path.join(EXPORT_DIR, filename);
  if (!fs.existsSync(filePath)) return 0;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
};

async function getDbCount(table: string): Promise<number> {
  try {
    const [rows]: any = await pool.execute(`SELECT COUNT(*) as count FROM \`${table}\``);
    return rows[0].count;
  } catch (error: any) {
    console.error(`Error counting table ${table}:`, error.message);
    return -1;
  }
}

async function runVerification() {
  console.log('===================================================');
  console.log('        SHAREPOINT -> MYSQL MIGRATION VERIFIER       ');
  console.log('===================================================');

  const comparisons = [
    { name: 'Users', jsonFile: 'users.json', table: 'User' },
    { name: 'Routes', jsonFile: 'routes.json', table: 'Route' },
    { name: 'Customers', jsonFile: 'customers.json', table: 'Customer' },
    { name: 'CustomerRouteMappings', jsonFile: 'mappings.json', table: 'CustomerRouteMapping' },
    { name: 'SKUs', jsonFile: 'skus.json', table: 'SKU' },
    { name: 'Visits', jsonFile: 'visits.json', table: 'Visit' },
    { name: 'VisitPhotos', jsonFile: 'photos.json', table: 'VisitPhoto' },
    { name: 'NPDResponses', jsonFile: 'npd.json', table: 'NPDResponse' },
    { name: 'AuditLogs', jsonFile: 'audit.json', table: 'AuditLog' },
  ];

  let totalFailures = 0;

  for (const comp of comparisons) {
    const jsonCount = getJsonCount(comp.jsonFile);
    const dbCount = await getDbCount(comp.table);

    const match = jsonCount === dbCount;
    const status = match ? 'PASS' : 'FAIL';
    if (!match) totalFailures++;

    console.log(
      `[${status}] ${comp.name.padEnd(23)}: SharePoint Export = ${String(jsonCount).padEnd(5)} | MySQL DB = ${String(dbCount).padEnd(5)}`
    );
  }

  console.log('===================================================');
  if (totalFailures === 0) {
    console.log('SUCCESS: All row counts match perfectly!');
  } else {
    console.warn(`WARNING: Found ${totalFailures} mismatching tables. Review script logs.`);
  }

  // Basic integrity query tests
  console.log('\nRunning Integrity Checks...');
  try {
    // 1. Orphaned mappings check
    const [orphanedMappings]: any = await pool.execute(`
      SELECT COUNT(*) as count FROM CustomerRouteMapping m
      LEFT JOIN Customer c ON m.customerCode = c.customerCode
      LEFT JOIN Route r ON m.routeCode = r.routeCode
      WHERE c.customerCode IS NULL OR r.routeCode IS NULL
    `);
    console.log(`- Orphaned Mappings (no matching route or customer): ${orphanedMappings[0].count}`);

    // 2. Orphaned visits check
    const [orphanedVisits]: any = await pool.execute(`
      SELECT COUNT(*) as count FROM Visit v
      LEFT JOIN Customer c ON v.customerCode = c.customerCode
      LEFT JOIN Route r ON v.routeCode = r.routeCode
      WHERE c.customerCode IS NULL OR r.routeCode IS NULL
    `);
    console.log(`- Orphaned Visits (no matching route or customer): ${orphanedVisits[0].count}`);

    // 3. Orphaned photos check
    const [orphanedPhotos]: any = await pool.execute(`
      SELECT COUNT(*) as count FROM VisitPhoto p
      LEFT JOIN Visit v ON p.visitId = v.visitId
      WHERE v.visitId IS NULL
    `);
    console.log(`- Orphaned Visit Photos (no matching visit): ${orphanedPhotos[0].count}`);

    // 4. Orphaned NPD responses check
    const [orphanedNpd]: any = await pool.execute(`
      SELECT COUNT(*) as count FROM NPDResponse n
      LEFT JOIN Visit v ON n.visitId = v.visitId
      LEFT JOIN SKU s ON n.skuCode = s.skuCode
      WHERE v.visitId IS NULL OR s.skuCode IS NULL
    `);
    console.log(`- Orphaned NPD Responses (no matching visit/SKU): ${orphanedNpd[0].count}`);

  } catch (error: any) {
    console.error('Integrity checks query error:', error.message);
  }
  console.log('===================================================');

  // Close db pool connection to allow script to exit clean
  await pool.end();
}

runVerification();
