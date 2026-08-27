#!/usr/bin/env node
const mysql = require('mysql2/promise');
require('dotenv').config();

const confirmReset = process.argv.includes('--confirm');

if (!confirmReset) {
  console.log('This will delete all rows from the database tables and keep the tables themselves.');
  console.log('Run with --confirm to proceed.');
  process.exit(0);
}

const tables = [
  'AuditLog',
  'NPDResponse',
  'VisitPhoto',
  'Visit',
  'CustomerRouteMapping',
  'SKU',
  'Customer',
  'Route',
  'User'
];

async function resetData() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  const connection = await pool.getConnection();

  try {
    console.log('Deleting data from tables...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      await connection.query(`DELETE FROM \`${table}\``);
      console.log(`Cleared rows from ${table}`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Database data reset completed. Tables were preserved.');
  } catch (error) {
    console.error('Failed to reset database data:', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

resetData();
