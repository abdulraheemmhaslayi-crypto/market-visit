const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const hash = '$2b$10$xANokfvRXd/XsM009BIC1euSO5eHLed8NrkJzI669T924C6Btn2uW';
    const [result] = await connection.query(
      'UPDATE `User` SET `passwordHash` = ? WHERE `role` = "Supervisor"',
      [hash]
    );
    console.log('Update result:', result);
  } catch (e) {
    console.error(e);
  } finally {
    await connection.end();
  }
}

run();
