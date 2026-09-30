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
    const [tables] = await conn.query("SHOW TABLES LIKE '%Classif%'");
    console.log('Tables matching Classif:', tables);

    const [cols] = await conn.query("SHOW COLUMNS FROM Customer_Classification");
    console.log('Customer_Classification cols:', cols.map(c => c.Field));

    const [rows] = await conn.query("SELECT * FROM Customer_Classification LIMIT 5");
    console.log('Customer_Classification rows:', rows);

    const [count] = await conn.query("SELECT COUNT(*) as count FROM Customer_Classification");
    console.log('Customer_Classification count:', count);

    const [custCols] = await conn.query("SHOW COLUMNS FROM Customer");
    console.log('Customer cols:', custCols.map(c => c.Field));

    const [custSample] = await conn.query("SELECT customerCode, customerName, channel, classification, dairyClassification, iceCreamClassification FROM Customer LIMIT 5");
    console.log('Customer sample:', custSample);

    await conn.end();
  } catch(e) {
    console.log('Failed:', e.message);
  }
}
test();
