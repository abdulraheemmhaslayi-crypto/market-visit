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
    const [rows] = await conn.query("SELECT visitId, cust_rt_id, supervisorId, createdAt, visit_datetime FROM Visit ORDER BY createdAt DESC LIMIT 10");
    console.log('Top 10 visits by createdAt DESC:');
    rows.forEach(r => console.log(r.visitId, r.cust_rt_id, r.createdAt, r.visit_datetime));

    const [rows2] = await conn.query("SELECT visitId, cust_rt_id, supervisorId, createdAt, visit_datetime FROM Visit ORDER BY visit_datetime DESC LIMIT 10");
    console.log('Top 10 visits by visit_datetime DESC:');
    rows2.forEach(r => console.log(r.visitId, r.cust_rt_id, r.createdAt, r.visit_datetime));

    const [nullCustRt] = await conn.query("SELECT visitId, cust_rt_id, routeCode, customerCode, createdAt FROM Visit WHERE cust_rt_id IS NULL OR cust_rt_id = ''");
    console.log('Visits with null/empty cust_rt_id count:', nullCustRt.length);
    if (nullCustRt.length > 0) {
      console.log('Sample empty cust_rt_id:', nullCustRt.slice(0, 5));
    }

    await conn.end();
  } catch(e) {
    console.log('Failed:', e.message);
  }
}
test();
