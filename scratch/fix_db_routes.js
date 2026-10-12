const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });

  console.log('Fixing SAIF vs SAIFULLAH routes in Route table...');
  await conn.execute(`
    UPDATE Route 
    SET supervisorId = 'usr_tgb2s6h', superName = 'SAIF' 
    WHERE routeCode IN ('TRD104', 'TRD109', 'TRD129', 'TRD144', 'TRD158', 'TRI308')
  `);

  await conn.execute(`
    UPDATE Route 
    SET supervisorId = 'usr_rqwxav8', superName = 'SAIFULLAH' 
    WHERE routeCode IN ('MTD207', 'MTD210', 'MTD213', 'MTD218', 'MTI403')
  `);

  await conn.execute(`
    UPDATE Route 
    SET supervisorId = 'usr_pil4rn7', superName = 'ASAD' 
    WHERE routeCode IN ('MTD201', 'MTD205', 'MTD216', 'MTD219', 'MTI402')
  `);

  const [routes] = await conn.execute(`
    SELECT routeCode, channel, supervisorId, superName 
    FROM Route 
    WHERE routeCode IN ('TRD104', 'TRD109', 'TRD129', 'TRD144', 'TRD158', 'TRI308', 'MTD207', 'MTD210', 'MTD213', 'MTD218', 'MTI403', 'MTD216')
    ORDER BY routeCode
  `);

  console.log('Updated routes in DB:');
  console.table(routes);

  await conn.end();
}

run();
