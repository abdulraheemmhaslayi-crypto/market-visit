const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });

  const [visits] = await conn.execute(`
    SELECT v.visitId, v.supervisorId, v.cust_rt_id, v.routeCode, v.customerCode, v.status, v.createdAt, v.visit_type
    FROM Visit v
    WHERE v.supervisorId = 'usr_pil4rn7' AND v.status = 'Submitted'
    ORDER BY v.createdAt DESC
  `);

  console.log(`Total visits for ASAD: ${visits.length}`);
  visits.slice(0, 25).forEach(v => {
    console.log(`[${new Date(v.createdAt).toISOString()}] visitId=${v.visitId} cust_rt_id=${v.cust_rt_id} routeCode=${v.routeCode} custCode=${v.customerCode}`);
  });

  await conn.end();
}

run();
