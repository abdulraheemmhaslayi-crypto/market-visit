const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });

  const [routes] = await conn.execute(`
    SELECT routeCode, routeName, channel, supervisorId, superName
    FROM Route
    WHERE superName LIKE "%SAIF%" OR routeCode LIKE "%MT%" OR routeCode LIKE "%TR%"
    ORDER BY routeCode ASC
  `);

  console.log(`Routes matching SAIF/MT/TR: ${routes.length}`);
  routes.filter(r => (r.superName || '').includes('SAIF') || (r.supervisorId === 'usr_rqwxav8') || (r.supervisorId === 'usr_tgb2s6h')).forEach(r => {
    console.log(`Route: ${r.routeCode} | Name: ${r.routeName} | Channel: ${r.channel} | supId: ${r.supervisorId} | superName: ${r.superName}`);
  });

  await conn.end();
}

run();
