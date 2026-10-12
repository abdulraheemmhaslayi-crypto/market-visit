const mysql = require('mysql2/promise');
const xlsx = require('xlsx');
const path = require('path');

async function run() {
  const custMasterFile = path.join(__dirname, '..', 'data', 'CUSTMASTER.xlsx');
  const wb = xlsx.readFile(custMasterFile);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const cmRows = xlsx.utils.sheet_to_json(sheet);
  const cmRoutes = new Set(cmRows.map(r => String(r['Route Code'] || '').trim().toUpperCase()).filter(Boolean));

  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });

  const [dbRoutes] = await conn.execute('SELECT routeCode, routeName, superName, channel FROM Route');
  console.log('Total routes in DB Route table:', dbRoutes.length);
  const extraInDb = dbRoutes.filter(r => !cmRoutes.has(r.routeCode));
  console.log('Routes in DB Route table but NOT in CUSTMASTER:');
  extraInDb.forEach(r => {
    console.log(`  ${r.routeCode} | superName: ${r.superName} | channel: ${r.channel}`);
  });

  await conn.end();
}

run();
