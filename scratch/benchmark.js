const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function benchmark() {
  console.log('--- STARTING PERFORMANCE BENCHMARK ---');

  // 1. Benchmark Excel loading
  const t0 = Date.now();
  const custMasterPath = 'D:/OneDrive - Dandy Company Ltd/D- One Drive/MARKET VISIT- NEW/CUSTMASTER.xlsx';
  if (fs.existsSync(custMasterPath)) {
    const buf = fs.readFileSync(custMasterPath);
    console.log(`Excel file read: ${Date.now() - t0} ms, size: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
    const tParse = Date.now();
    const wb = xlsx.read(buf, { type: 'buffer' });
    console.log(`Excel sheet parse: ${Date.now() - tParse} ms, sheets: ${wb.SheetNames.join(', ')}`);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const tJson = Date.now();
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`Excel sheet_to_json: ${Date.now() - tJson} ms, row count: ${rows.length}`);
  }
  console.log(`Total Excel processing: ${Date.now() - t0} ms\n`);

  // 2. Benchmark Database connection & queries
  const tDb0 = Date.now();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? process.env.DB_HOST : 'altaria.proxy.rlwy.net',
    port: parseInt(process.env.DB_PORT || '50182'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: process.env.DB_NAME || 'railway',
  });
  console.log(`Database connected in: ${Date.now() - tDb0} ms`);

  const queries = [
    { name: 'Customer count & sample', sql: 'SELECT count(*) as count FROM Customer' },
    { name: 'SELECT * FROM Customer', sql: 'SELECT * FROM Customer' },
    { name: 'SELECT * FROM Visit', sql: 'SELECT * FROM Visit' },
    { name: 'SELECT * FROM VisitAsset', sql: 'SELECT * FROM VisitAsset' },
    { name: 'SELECT * FROM VisitPowerSkuResult', sql: 'SELECT * FROM VisitPowerSkuResult' },
    { name: 'SELECT * FROM NPDResponse', sql: 'SELECT * FROM NPDResponse' },
    { name: 'SELECT * FROM VisitPhoto LIMIT 200', sql: 'SELECT * FROM VisitPhoto ORDER BY uploadedAt DESC LIMIT 200' },
  ];

  for (const q of queries) {
    const t = Date.now();
    const [res] = await conn.query(q.sql);
    console.log(`Query [${q.name}]: ${Date.now() - t} ms (rows: ${Array.isArray(res) ? res.length : JSON.stringify(res)})`);
  }

  await conn.end();
  console.log('--- BENCHMARK FINISHED ---');
}

benchmark().catch(console.error);
