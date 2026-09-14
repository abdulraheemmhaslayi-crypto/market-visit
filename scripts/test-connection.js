const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function testConnections() {
  console.log("=== Testing Railway MySQL Database Connections ===");
  console.log("Environment variables from .env:");
  console.log(`DB_HOST: ${process.env.DB_HOST}`);
  console.log(`DB_PORT: ${process.env.DB_PORT}`);
  console.log(`DB_USER: ${process.env.DB_USER}`);
  console.log(`DB_NAME: ${process.env.DB_NAME}`);

  // Test 1: Using current .env settings
  console.log("\n--- Attempting connection with configured env variables ---");
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 5000,
    });
    console.log("✅ SUCCESS: Connected using configured env!");
    const [tables] = await conn.query("SHOW TABLES");
    console.log("Tables in database:", tables);
    await conn.end();
  } catch (err) {
    console.error("❌ FAILED with configured env:", err.message);
  }

  // Test 2: Using Railway Public Proxy (hayabusa.proxy.rlwy.net:10115)
  console.log("\n--- Attempting connection with Public Proxy (hayabusa.proxy.rlwy.net:10115) ---");
  try {
    const connPublic = await mysql.createConnection({
      host: 'hayabusa.proxy.rlwy.net',
      port: 10115,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'railway',
      connectTimeout: 5000,
    });
    console.log("✅ SUCCESS: Connected to Public Proxy (hayabusa.proxy.rlwy.net:10115)!");
    const [tables] = await connPublic.query("SHOW TABLES");
    console.log("Tables in DB:", tables.map(t => Object.values(t)[0]));
    await connPublic.end();
  } catch (err) {
    console.error("❌ FAILED with Public Proxy:", err.message);
  }
}

testConnections();
