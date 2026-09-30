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
    const [rows] = await conn.query("SELECT visitId, supervisorId, visit_type, reason_category, reason, observation, createdBy, createdAt FROM Visit WHERE cust_rt_id IS NULL OR cust_rt_id = ''");
    console.log('Empty cust_rt_id rows:', rows);
    await conn.end();
  } catch(e) {
    console.log('Failed:', e.message);
  }
}
test();
