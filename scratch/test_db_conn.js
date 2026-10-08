const mysql = require('mysql2/promise');

async function test(host, port, user, password, database) {
  try {
    console.log(`Testing ${host}:${port}...`);
    const conn = await mysql.createConnection({
      host,
      port: Number(port),
      user,
      password,
      database,
      connectTimeout: 5000,
    });
    console.log(`Connected successfully to ${host}!`);
    const [rows] = await conn.execute('SELECT COUNT(*) as cnt FROM Visit');
    console.log('Total visits in DB:', rows[0].cnt);
    await conn.end();
    return true;
  } catch (err) {
    console.log(`Failed to connect to ${host}:`, err.message);
    return false;
  }
}

async function run() {
  await test('altaria.proxy.rlwy.net', 50182, 'root', 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV', 'railway');
  await test('dandyapp.tech', 3306, 'marketvisit_user', 'VpsHost@2026#Qa7', 'marketvisit');
}

run();
