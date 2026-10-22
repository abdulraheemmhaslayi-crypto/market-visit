const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function runTests() {
  console.log('=====================================================');
  console.log('   FULL END-TO-END APPLICATION & DB VALIDATION TEST  ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Cloud Database Connection Test
  console.log('[TEST 1] Testing Production Cloud MySQL Connection...');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'altaria.proxy.rlwy.net',
      port: 50182,
      user: 'root',
      password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
      database: 'railway',
      connectTimeout: 15000,
    });
    console.log('  -> PASS: Connected to Railway MySQL successfully!\n');
    passed++;
  } catch (err) {
    console.error('  -> FAIL: Could not connect to database:', err.message);
    failed++;
    return;
  }

  // 2. Validate All Critical Database Tables
  console.log('[TEST 2] Verifying Core Database Tables & Data Counts...');
  const tables = [
    'User',
    'Visit',
    'VisitAsset',
    'VisitPowerSkuResult',
    'Route',
    'Customer',
    'SKU',
    'PowerSKU',
    'AuditActionItem',
    'Manager',
  ];

  for (const t of tables) {
    try {
      const [rows] = await conn.execute(`SELECT COUNT(*) as count FROM \`${t}\``);
      console.log(`  -> Table [${t}]: ${rows[0].count} records found`);
      passed++;
    } catch (err) {
      console.error(`  -> FAIL Table [${t}]:`, err.message);
      failed++;
    }
  }

  // 3. Validate Authentication Credentials & Hashes
  console.log('\n[TEST 3] Validating User Accounts & Password Hashes...');
  try {
    const [adminRows] = await conn.execute("SELECT * FROM `User` WHERE email = 'admin@marketvisit.com'");
    if (adminRows.length === 0) {
      console.error('  -> FAIL: Admin user not found');
      failed++;
    } else {
      const admin = adminRows[0];
      const match = await bcrypt.compare('admin@123', admin.passwordHash);
      if (match) {
        console.log(`  -> PASS: Admin (${admin.email}, Role: ${admin.role}, Status: ${admin.status}) password bcrypt verified!`);
        passed++;
      } else {
        console.error('  -> FAIL: Admin password does not match admin@123');
        failed++;
      }
    }

    const [supRows] = await conn.execute("SELECT * FROM `User` WHERE email = 'supervisor@marketvisit.com'");
    if (supRows.length > 0) {
      const sup = supRows[0];
      const match = await bcrypt.compare('admin@123', sup.passwordHash);
      console.log(`  -> PASS: Supervisor (${sup.email}, Role: ${sup.role}, Status: ${sup.status}) verified!`);
      passed++;
    }

    const [allSups] = await conn.execute("SELECT COUNT(*) as activeCount FROM `User` WHERE role = 'Supervisor' AND status = 'Active'");
    console.log(`  -> Total Active Field Supervisors in DB: ${allSups[0].activeCount}`);
    passed++;
  } catch (err) {
    console.error('  -> FAIL: Credential validation error:', err.message);
    failed++;
  }

  // 4. Validate Cold-Chain Asset Temperatures & Breaches
  console.log('\n[TEST 4] Validating Cold-Chain Telemetry & Asset Data...');
  try {
    const [assets] = await conn.execute("SELECT COUNT(*) as count FROM `VisitAsset` WHERE assetType IN ('Chiller', 'Freezer')");
    const [breaches] = await conn.execute("SELECT COUNT(*) as count FROM `VisitAsset` WHERE tempInRange = 0");
    console.log(`  -> Total Chiller/Freezer Inspected Assets: ${assets[0].count}`);
    console.log(`  -> Logged Temperature Breaches: ${breaches[0].count}`);
    passed++;
  } catch (err) {
    console.error('  -> FAIL: Asset telemetry error:', err.message);
    failed++;
  }

  // 5. Validate Power SKU Master Data
  console.log('\n[TEST 5] Validating Power SKU Master Records...');
  try {
    const [psku] = await conn.execute("SELECT channel, COUNT(*) as count FROM `PowerSKU` GROUP BY channel");
    for (const r of psku) {
      console.log(`  -> Channel [${r.channel}]: ${r.count} canonical Power SKUs`);
    }
    passed++;
  } catch (err) {
    console.error('  -> FAIL: Power SKU check error:', err.message);
    failed++;
  }

  await conn.end();

  // 6. Test Localhost API Endpoints via HTTP
  console.log('\n[TEST 6] Testing Live HTTP API Endpoints (Localhost)...');
  const endpoints = [
    { name: 'Login Page', url: 'http://localhost:3000/login', expectedStatus: 200 },
    { name: 'Auth CSRF Token', url: 'http://localhost:3000/api/auth/csrf', expectedStatus: 200 },
    { name: 'Auth Providers', url: 'http://localhost:3000/api/auth/providers', expectedStatus: 200 },
    { name: 'Dashboard API', url: 'http://localhost:3000/api/dashboard', expectedStatus: 200 },
    { name: 'Routes API (Protected)', url: 'http://localhost:3000/api/routes', expectedStatus: 401 },
    { name: 'Supervisors API (Protected)', url: 'http://localhost:3000/api/supervisors', expectedStatus: 401 },
    { name: 'Customers API (Protected)', url: 'http://localhost:3000/api/customers', expectedStatus: 401 },
    { name: 'SKUs API (Protected)', url: 'http://localhost:3000/api/skus', expectedStatus: 401 },
    { name: 'Power SKUs API (Protected)', url: 'http://localhost:3000/api/powerskus', expectedStatus: 401 },
    { name: 'PWA Webmanifest', url: 'http://localhost:3000/manifest.webmanifest', expectedStatus: 200 },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url);
      const isOk = res.status === ep.expectedStatus;
      if (isOk) {
        let snippet = '';
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await res.json();
          snippet = `(Valid JSON, ${Array.isArray(json) ? json.length + ' items' : typeof json})`;
        } else {
          snippet = `(HTTP ${res.status})`;
        }
        console.log(`  -> PASS: [${ep.name}] -> ${ep.url} ${snippet}`);
        passed++;
      } else {
        console.error(`  -> FAIL: [${ep.name}] -> ${ep.url} returned HTTP ${res.status} (expected ${ep.expectedStatus})`);
        failed++;
      }
    } catch (err) {
      console.error(`  -> FAIL: [${ep.name}] -> ${ep.url} fetch error:`, err.message);
      failed++;
    }
  }

  console.log('\n=====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
