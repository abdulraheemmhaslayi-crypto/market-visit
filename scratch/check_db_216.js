const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });

  const [r] = await conn.execute('SELECT * FROM Route WHERE routeCode LIKE "%216%"');
  console.log('Routes with 216 in DB:', r);
  await conn.end();
}

run();
