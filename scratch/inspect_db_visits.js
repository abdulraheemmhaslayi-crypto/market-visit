const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  console.log('Connecting to:', process.env.DB_HOST, process.env.DB_PORT, process.env.DB_USER, process.env.DB_NAME);
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'marketvisit',
      connectTimeout: 5000,
    });
    const [users] = await pool.execute('SELECT id, name, role, email FROM User WHERE name LIKE "%ASAD%" OR name LIKE "%SAIF%"');
    console.log('Relevant Users:', users);

    const asad = users.find(u => u.name === 'ASAD');
    if (asad) {
      console.log('Asad User ID:', asad.id);
      const [visits] = await pool.execute(`
        SELECT visitId, supervisorId, cust_rt_id, routeCode, customerCode, status, createdAt, visit_type
        FROM Visit
        WHERE supervisorId = ? AND status = 'Submitted'
        ORDER BY createdAt ASC
      `, [asad.id]);
      console.log(`Total submitted visits for ASAD in DB: ${visits.length}`);
      
      const byDate = {};
      visits.forEach(v => {
        const d = new Date(v.createdAt).toISOString().split('T')[0];
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(v);
      });
      for (const [d, list] of Object.entries(byDate)) {
        console.log(`\nDate: ${d} (count: ${list.length})`);
        list.forEach(v => {
          console.log(`  visitId: ${v.visitId} | cust_rt_id: ${v.cust_rt_id} | route: ${v.routeCode} | cust: ${v.customerCode} | type: ${v.visit_type}`);
        });
      }
    }
    await pool.end();
  } catch (err) {
    console.error('DB Error:', err);
  }
}

check();
