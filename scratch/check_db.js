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
    const [users] = await connection.query('SELECT id, name, employeeCode, role FROM `User` LIMIT 3');
    console.log('Users:');
    console.log(users);

    const [routes] = await connection.query('SELECT routeCode, supervisorId, managerId, superName FROM `Route` LIMIT 3');
    console.log('\nRoutes:');
    console.log(routes);

    const [visits] = await connection.query('SELECT visitId, supervisorId, routeCode, cust_rt_id FROM `Visit` LIMIT 3');
    console.log('\nVisits:');
    console.log(visits);
  } catch (e) {
    console.error(e);
  } finally {
    await connection.end();
  }
}

run();
