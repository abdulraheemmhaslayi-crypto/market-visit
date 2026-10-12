const mysql = require('mysql2/promise');

async function test() {
  try {
    const conn = await mysql.createConnection({
      host: 'altaria.proxy.rlwy.net',
      port: 50182,
      user: 'root',
      password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
      database: 'railway',
      connectTimeout: 8000,
    });
    const [pskuCount] = await conn.query("SELECT COUNT(*) as count FROM VisitPowerSkuResult");
    console.log('VisitPowerSkuResult count:', pskuCount);

    const [pskuSample] = await conn.query("SELECT * FROM VisitPowerSkuResult LIMIT 5");
    console.log('VisitPowerSkuResult sample:', pskuSample);

    const [matchVisit] = await conn.query("SELECT * FROM Visit WHERE visitId = 'MV-20260927102953-ZF13CJ1P'");
    console.log('Exact match visit in railway:', matchVisit);

    // Let's search if ANY table has ZF13CJ1P
    const [tables] = await conn.query("SHOW TABLES");
    console.log('Tables:', tables.map(t => Object.values(t)[0]));

    for (const t of tables.map(t => Object.values(t)[0])) {
      try {
        const [cols] = await conn.query(`SHOW COLUMNS FROM \`${t}\``);
        const hasVisitId = cols.some(c => c.Field === 'visitId');
        if (hasVisitId) {
          const [found] = await conn.query(`SELECT * FROM \`${t}\` WHERE visitId LIKE '%ZF13CJ1P%'`);
          if (found.length > 0) {
            console.log(`FOUND in table ${t}:`, found);
          }
        }
      } catch(e) {}
    }

    await conn.end();
  } catch(e) {
    console.log('Failed:', e.message);
  }
}
test();
