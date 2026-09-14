#!/usr/bin/env node
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdminUser() {
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
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@marketvisit.com';
    const adminEmployeeCode = process.env.ADMIN_EMPLOYEE_CODE || 'ADMIN001';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin@123';

    const [existingRows] = await connection.query(
      'SELECT id FROM `User` WHERE LOWER(email) = LOWER(?) OR employeeCode = ? LIMIT 1',
      [adminEmail, adminEmployeeCode]
    );

    if (existingRows.length > 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await connection.query(
        'UPDATE `User` SET passwordHash = ?, status = "Active", name = ? WHERE id = ?',
        [passwordHash, process.env.ADMIN_NAME || 'Admin', existingRows[0].id]
      );
      console.log(`Admin user updated successfully with password: ${adminPassword}`);
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const id = 'usr_' + Math.random().toString(36).substring(2, 9);

    await connection.query(
      'INSERT INTO `User` (id, name, employeeCode, email, passwordHash, mobile, role, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        process.env.ADMIN_NAME || 'Admin',
        adminEmployeeCode,
        adminEmail,
        passwordHash,
        process.env.ADMIN_MOBILE || '0000000000',
        'Admin',
        'Active',
        new Date()
      ]
    );

    console.log('Admin user created successfully.');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
  } catch (error) {
    console.error('Failed to create admin user:', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

createAdminUser();
