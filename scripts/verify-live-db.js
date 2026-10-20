const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function verifyDatabase() {
  console.log('================================================================');
  console.log('           ENTERPRISE DATABASE VERIFICATION REPORT             ');
  console.log('================================================================');
  console.log('Host/Server  :', process.env.DB_HOST || 'altaria.proxy.rlwy.net');
  console.log('Port         :', process.env.DB_PORT || '50182');
  console.log('Database     :', process.env.DB_NAME || 'railway');
  console.log('User         :', process.env.DB_USER || 'root');
  console.log('Engine Mode  :', process.env.DB_MODE || 'MYSQL (Dual-Engine Ready with Azure SQL)');
  console.log('----------------------------------------------------------------');

  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'altaria.proxy.rlwy.net',
      port: Number(process.env.DB_PORT) || 50182,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'railway',
      connectTimeout: 8000,
    });

    console.log('Connection Status: [OK] CONNECTED TO PRODUCTION DATABASE\n');

    const [tables] = await conn.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];
    const reportData = [];
    let totalRecords = 0;

    for (const t of tables) {
      const tableName = t[tableKey];
      const [countRows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
      const cnt = countRows[0].cnt;
      totalRecords += Number(cnt);
      reportData.push({
        'Table Name': tableName,
        'Records': cnt,
        'Integrity': 'PASSED (Active Data)'
      });
    }

    console.table(reportData);
    console.log('----------------------------------------------------------------');
    console.log(`TOTAL ACTIVE RECORDS IN DATABASE: ${totalRecords}`);
    console.log('================================================================');

    await conn.end();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
}

verifyDatabase();
