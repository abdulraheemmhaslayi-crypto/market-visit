const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });

  const [users] = await conn.execute('SELECT id, name, role, email FROM User WHERE name LIKE "%ASAD%" OR name LIKE "%SAIF%"');
  console.log('Users:', users);

  const asad = users.find(u => u.name === 'ASAD');
  console.log('ASAD user:', asad);

  const [visits] = await conn.execute(`
    SELECT v.visitId, v.supervisorId, v.cust_rt_id, v.routeCode, v.customerCode, v.status, v.createdAt, v.visit_type,
           u.name as supervisorName
    FROM Visit v
    LEFT JOIN User u ON v.supervisorId = u.id
    WHERE v.supervisorId = ? AND v.status = 'Submitted'
      AND v.createdAt >= '2026-10-01 00:00:00' AND v.createdAt <= '2026-10-06 23:59:59'
    ORDER BY v.createdAt ASC
  `, [asad.id]);

  console.log(`\nFound ${visits.length} visits for ASAD between Oct 1 and Oct 6:`);
  visits.forEach((v, idx) => {
    const d = new Date(v.createdAt).toISOString().split('T')[0];
    console.log(`${idx + 1}. [${d}] visitId=${v.visitId} cust_rt_id=${v.cust_rt_id} routeCode=${v.routeCode} custCode=${v.customerCode} sup=${v.supervisorName}`);
  });

  await conn.end();
}

run();
