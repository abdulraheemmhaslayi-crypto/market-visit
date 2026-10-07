const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });

  const [users] = await conn.execute('SELECT id, name, email, employeeCode FROM User WHERE name LIKE "%SAIF%"');
  console.log('Users:', users);

  const [routes] = await conn.execute('SELECT * FROM Route WHERE routeCode = "TRD129"');
  console.log('TRD129 in Route table:', routes);

  await conn.end();
}
check();
