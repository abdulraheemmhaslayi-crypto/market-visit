const mysql = require('mysql2/promise');

async function test() {
  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });
  
  const [visits] = await conn.execute(`
    SELECT v.visitId, v.supervisorId, v.cust_rt_id, v.customerCode, v.routeCode, v.status, v.createdAt, u.name as supervisorName
    FROM Visit v
    LEFT JOIN User u ON v.supervisorId = u.id
    WHERE v.supervisorId = 'usr_pil4rn7' AND v.status = 'Submitted'
    ORDER BY v.createdAt DESC
  `);
  
  console.log('Total visits for usr_pil4rn7:', visits.length);

  // Group by date
  const byDate = {};
  for (const v of visits) {
    const d = new Date(v.createdAt).toISOString().split('T')[0];
    byDate[d] = (byDate[d] || 0) + 1;
  }
  console.log('Visits by date (UTC):', byDate);

  // Check visits between 2026-10-01 and 2026-10-06
  // Wait, let's see what visits match 2026-10-01 to 2026-10-06 or what the date format is:
  const octVisits = visits.filter(v => {
    const d = new Date(v.createdAt);
    return v.createdAt;
  });

  // Let's print all 38 visits with their local date or visitId
  visits.forEach(v => {
    console.log(`[${new Date(v.createdAt).toISOString()}] ${v.visitId} cust_rt_id=${v.cust_rt_id}`);
  });

  await conn.end();
}

test();
