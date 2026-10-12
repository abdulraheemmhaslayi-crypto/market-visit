const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });

  const [rows] = await conn.execute(`
    SELECT MIN(createdAt) as minDate, MAX(createdAt) as maxDate, COUNT(*) as cnt, supervisorId
    FROM Visit
    GROUP BY supervisorId
  `);
  console.log('Visits summary by supervisorId:', rows);

  // Check sample visits
  const [samples] = await conn.execute(`
    SELECT visitId, supervisorId, cust_rt_id, routeCode, customerCode, status, createdAt, visit_type
    FROM Visit
    ORDER BY createdAt DESC
    LIMIT 10
  `);
  console.log('Latest 10 visits:', samples);

  await conn.end();
}

run();
