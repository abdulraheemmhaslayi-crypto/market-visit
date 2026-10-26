const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function testAuth() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await conn.query('SELECT name, email, employeeCode, passwordHash FROM `User`');
    let passed = 0;
    for (const r of rows) {
      let pass = `${r.name.toLowerCase()}@12345`;
      if (r.name === 'Admin') pass = 'admin@123';
      else if (r.name === 'Supervisor User') pass = 'supervisor@123';
      
      const ok = bcrypt.compareSync(pass, r.passwordHash);
      if (!ok) {
        console.error(`FAILED: ${r.name} with password ${pass}`);
      } else {
        passed++;
      }
    }
    console.log(`Verification completed: ${passed}/${rows.length} users passed authentication test!`);
  } finally {
    await conn.end();
  }
}

testAuth().catch(console.error);
