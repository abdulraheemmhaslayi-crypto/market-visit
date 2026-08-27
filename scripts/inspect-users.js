const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspectUsers() {
  console.log("Connecting to DB:", process.env.DB_HOST, process.env.DB_PORT);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [users] = await conn.query("SELECT id, name, employeeCode, email, status, role, passwordHash FROM `User`");
    console.log("Total users in User table:", users.length);
    console.log(users);
  } catch (err) {
    console.error("Error inspecting users:", err);
  } finally {
    await conn.end();
  }
}

inspectUsers();
