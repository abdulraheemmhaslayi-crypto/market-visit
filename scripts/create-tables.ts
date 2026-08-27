import pool from '../lib/db';

async function createTables() {
  console.log('Initializing MySQL Database Schema...');
  const connection = await pool.getConnection();

  const dropStatements = [
    'DROP TABLE IF EXISTS `AuditLog`',
    'DROP TABLE IF EXISTS `NPDResponse`',
    'DROP TABLE IF EXISTS `VisitPhoto`',
    'DROP TABLE IF EXISTS `Visit`',
    'DROP TABLE IF EXISTS `CustomerRouteMapping`',
    'DROP TABLE IF EXISTS `Customer_Classification`',
    'DROP TABLE IF EXISTS `SKU`',
    'DROP TABLE IF EXISTS `Customer`',
    'DROP TABLE IF EXISTS `Route`',
    'DROP TABLE IF EXISTS `User`'
  ];

  const ddlStatements = [
    // 0. Manager
    `CREATE TABLE IF NOT EXISTS \`Manager\` (
      \`id\` VARCHAR(191) PRIMARY KEY,
      \`name\` VARCHAR(191) UNIQUE NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 1. User
    `CREATE TABLE IF NOT EXISTS \`User\` (
      \`id\` VARCHAR(191) PRIMARY KEY,
      \`name\` VARCHAR(191) NOT NULL,
      \`employeeCode\` VARCHAR(191) UNIQUE NOT NULL,
      \`email\` VARCHAR(191) UNIQUE NOT NULL,
      \`passwordHash\` VARCHAR(191) NOT NULL,
      \`mobile\` VARCHAR(191) NOT NULL,
      \`role\` VARCHAR(50) NOT NULL,
      \`status\` ENUM('Active', 'Inactive') NOT NULL,
      \`managerId\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX \`idx_user_email\` (\`email\`),
      INDEX \`idx_user_employee_code\` (\`employeeCode\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 2. Route
    `CREATE TABLE IF NOT EXISTS \`Route\` (
      \`routeCode\` VARCHAR(191) PRIMARY KEY,
      \`routeName\` VARCHAR(191) NOT NULL,
      \`channel\` VARCHAR(191) NOT NULL DEFAULT 'GT',
      \`supervisorId\` VARCHAR(191) NULL,
      \`managerId\` VARCHAR(191) NULL,
      \`superName\` VARCHAR(191) NULL,
      INDEX \`idx_route_supervisor\` (\`supervisorId\`),
      INDEX \`idx_route_manager\` (\`managerId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 3. Customer
    `CREATE TABLE IF NOT EXISTS \`Customer\` (
      \`cust_rt_id\` VARCHAR(191) PRIMARY KEY,
      \`customerCode\` VARCHAR(191) NOT NULL,
      \`customerName\` VARCHAR(191) NOT NULL,
      \`classification\` VARCHAR(50) NOT NULL,
      \`dairyClassification\` VARCHAR(50) NULL,
      \`iceCreamClassification\` VARCHAR(50) NULL,
      \`channel\` VARCHAR(191) NOT NULL,
      \`routeCode\` VARCHAR(191) NOT NULL,
      FOREIGN KEY (\`routeCode\`) REFERENCES \`Route\`(\`routeCode\`) ON DELETE CASCADE,
      INDEX \`idx_customer_route\` (\`routeCode\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 3b. Customer_Classification
    `CREATE TABLE IF NOT EXISTS \`Customer_Classification\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`customerCode\` VARCHAR(191) NOT NULL,
      \`businessVertical\` VARCHAR(50) NOT NULL,
      \`classification\` VARCHAR(50) NOT NULL,
      \`channel\` VARCHAR(100) NULL,
      \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`uk_customer_vertical\` (\`customerCode\`, \`businessVertical\`),
      INDEX \`idx_cust_class_code\` (\`customerCode\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 4. CustomerRouteMapping
    `CREATE TABLE IF NOT EXISTS \`CustomerRouteMapping\` (
      \`cust_rt_id\` VARCHAR(191) PRIMARY KEY,
      \`customerCode\` VARCHAR(191) NOT NULL,
      \`routeCode\` VARCHAR(191) NOT NULL,
      FOREIGN KEY (\`cust_rt_id\`) REFERENCES \`Customer\`(\`cust_rt_id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`routeCode\`) REFERENCES \`Route\`(\`routeCode\`) ON DELETE CASCADE,
      INDEX \`idx_mapping_route\` (\`routeCode\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 5. SKU
    `CREATE TABLE IF NOT EXISTS \`SKU\` (
      \`skuCode\` VARCHAR(191) PRIMARY KEY,
      \`skuName\` VARCHAR(191) NOT NULL,
      \`type\` VARCHAR(50) NOT NULL DEFAULT 'SKU',
      \`businessVertical\` VARCHAR(191) NULL,
      INDEX \`idx_sku_type\` (\`type\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 5b. PowerSKU
    `CREATE TABLE IF NOT EXISTS \`PowerSKU\` (
      \`skuCode\` VARCHAR(191) NOT NULL,
      \`skuName\` VARCHAR(191) NOT NULL,
      \`channel\` VARCHAR(191) NOT NULL,
      PRIMARY KEY (\`skuCode\`, \`channel\`),
      INDEX \`idx_powersku_channel\` (\`channel\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 6. Visit
    `CREATE TABLE IF NOT EXISTS \`Visit\` (
      \`visitId\` VARCHAR(191) PRIMARY KEY,
      \`supervisorId\` VARCHAR(191) NOT NULL,
      \`cust_rt_id\` VARCHAR(191) NOT NULL,
      \`visit_type\` ENUM('Visit','No Visit') NOT NULL DEFAULT 'Visit',
      \`reason_category\` VARCHAR(191) NULL,
      \`reason\` TEXT NULL,
      \`latitude\` DOUBLE NOT NULL,
      \`longitude\` DOUBLE NOT NULL,
      \`accuracy\` DOUBLE NOT NULL,
      \`status\` ENUM('Draft', 'Submitted') NOT NULL,
      \`createdBy\` VARCHAR(191) NOT NULL,
      \`visit_datetime\` DATETIME NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      \`sosAsPerBda\` TINYINT(1) NULL,
      FOREIGN KEY (\`cust_rt_id\`) REFERENCES \`Customer\`(\`cust_rt_id\`) ON DELETE CASCADE,
      INDEX \`idx_visit_supervisor\` (\`supervisorId\`),
      INDEX \`idx_visit_cust_rt\` (\`cust_rt_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 7. VisitPhoto
    `CREATE TABLE IF NOT EXISTS \`VisitPhoto\` (
      \`photoId\` VARCHAR(191) PRIMARY KEY,
      \`visitId\` VARCHAR(191) NOT NULL,
      \`category\` ENUM('Dairy', 'Beverages', 'Ice Cream', 'Vegetables') NOT NULL,
      FOREIGN KEY (\`visitId\`) REFERENCES \`Visit\`(\`visitId\`) ON DELETE CASCADE,
      INDEX \`idx_photo_visit\` (\`visitId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 8. NPDResponse
    `CREATE TABLE IF NOT EXISTS \`NPDResponse\` (
      \`visitId\` VARCHAR(191) NOT NULL,
      \`skuCode\` VARCHAR(191) NOT NULL,
      \`status\` ENUM('Available', 'Not Available', 'Not Required') NOT NULL,
      PRIMARY KEY (\`visitId\`, \`skuCode\`),
      FOREIGN KEY (\`visitId\`) REFERENCES \`Visit\`(\`visitId\`) ON DELETE CASCADE,
      FOREIGN KEY (\`skuCode\`) REFERENCES \`SKU\`(\`skuCode\`),
      INDEX \`idx_npd_sku\` (\`skuCode\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 9. AuditLog
    `CREATE TABLE IF NOT EXISTS \`AuditLog\` (
      \`logId\` VARCHAR(191) PRIMARY KEY,
      \`user\` VARCHAR(191) NOT NULL,
      \`action\` VARCHAR(191) NOT NULL,
      \`entity\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  try {
    // Disable foreign key checks to drop smoothly
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const sql of dropStatements) {
      console.log(`Executing: ${sql}...`);
      await connection.query(sql);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    for (const sql of ddlStatements) {
      const tableName = sql.match(/`(\w+)`/)?.[1] || 'Unknown';
      console.log(`Creating table ${tableName}...`);
      await connection.query(sql);
    }
    console.log('All MySQL tables and constraints created successfully.');
  } catch (error: any) {
    console.error('Error creating database schema:', error.message);
  } finally {
    connection.release();
    await pool.end();
  }
}

createTables();
