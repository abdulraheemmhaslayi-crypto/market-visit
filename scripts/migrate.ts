import pool from '../lib/db';

async function runMigration() {
  console.log('Starting MySQL database migration...');
  const connection = await pool.getConnection();

  try {
    // 1. Fetch existing data into memory to preserve it
    console.log('Loading existing data into memory...');
    
    let existingCustomers: any[] = [];
    try {
      const [rows]: any = await connection.query('SELECT * FROM `Customer`');
      existingCustomers = rows;
    } catch {
      console.log('Customer table does not exist or cannot be read.');
    }

    let existingMappings: any[] = [];
    try {
      const [rows]: any = await connection.query('SELECT * FROM `CustomerRouteMapping`');
      existingMappings = rows;
    } catch {
      console.log('CustomerRouteMapping table does not exist or cannot be read.');
    }

    let existingVisits: any[] = [];
    try {
      const [rows]: any = await connection.query('SELECT * FROM `Visit`');
      existingVisits = rows;
    } catch {
      console.log('Visit table does not exist or cannot be read.');
    }

    let existingPhotos: any[] = [];
    try {
      const [rows]: any = await connection.query('SELECT * FROM `VisitPhoto`');
      existingPhotos = rows;
    } catch {
      console.log('VisitPhoto table does not exist or cannot be read.');
    }

    let existingNpd: any[] = [];
    try {
      const [rows]: any = await connection.query('SELECT * FROM `NPDResponse`');
      existingNpd = rows;
    } catch {
      console.log('NPDResponse table does not exist or cannot be read.');
    }

    // Disable foreign key checks during schema updates
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // 2. Drop dependent tables to clear foreign key conflicts
    console.log('Dropping tables to clear conflicts...');
    await connection.query('DROP TABLE IF EXISTS `VisitPhoto`');
    await connection.query('DROP TABLE IF EXISTS `NPDResponse`');
    await connection.query('DROP TABLE IF EXISTS `VisitAsset`');
    await connection.query('DROP TABLE IF EXISTS `VisitPowerSkuResult`');
    await connection.query('DROP TABLE IF EXISTS `Visit`');
    await connection.query('DROP TABLE IF EXISTS `CustomerRouteMapping`');
    await connection.query('DROP TABLE IF EXISTS `Customer`');

    // Create foundational tables if they do not exist (for brand new Railway instances)
    console.log('Ensuring foundational tables exist...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`User\` (
        \`id\` VARCHAR(191) PRIMARY KEY,
        \`name\` VARCHAR(191) NOT NULL,
        \`employeeCode\` VARCHAR(191) UNIQUE NOT NULL,
        \`email\` VARCHAR(191) UNIQUE NOT NULL,
        \`passwordHash\` VARCHAR(191) NOT NULL,
        \`mobile\` VARCHAR(191) NOT NULL,
        \`role\` VARCHAR(50) NOT NULL,
        \`status\` ENUM('Active', 'Inactive') NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX \`idx_user_email\` (\`email\`),
        INDEX \`idx_user_employee_code\` (\`employeeCode\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Route\` (
        \`routeCode\` VARCHAR(191) PRIMARY KEY,
        \`routeName\` VARCHAR(191) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`SKU\` (
        \`skuCode\` VARCHAR(191) PRIMARY KEY,
        \`skuName\` VARCHAR(191) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`AuditLog\` (
        \`logId\` VARCHAR(191) PRIMARY KEY,
        \`user\` VARCHAR(191) NOT NULL,
        \`action\` VARCHAR(191) NOT NULL,
        \`entity\` VARCHAR(191) NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Create Manager Table
    console.log('Creating Manager table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`Manager\` (
        \`id\` VARCHAR(191) PRIMARY KEY,
        \`name\` VARCHAR(191) UNIQUE NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Modify User Table
    console.log('Modifying User table...');
    const [userColumns]: any = await connection.query('SHOW COLUMNS FROM `User`');
    const hasManagerId = userColumns.some((col: any) => col.Field === 'managerId');
    if (!hasManagerId) {
      await connection.query('ALTER TABLE `User` ADD COLUMN `managerId` VARCHAR(191) NULL');
      await connection.query('ALTER TABLE `User` ADD CONSTRAINT `fk_user_manager` FOREIGN KEY (`managerId`) REFERENCES `Manager`(`id`) ON DELETE SET NULL');
    }

    // 5. Modify Route Table
    console.log('Modifying Route table...');
    const [routeColumns]: any = await connection.query('SHOW COLUMNS FROM `Route`');
    const hasChannel = routeColumns.some((col: any) => col.Field === 'channel');
    if (!hasChannel) {
      await connection.query("ALTER TABLE `Route` ADD COLUMN `channel` VARCHAR(191) NOT NULL DEFAULT 'GT'");
      await connection.query('ALTER TABLE `Route` ADD COLUMN `supervisorId` VARCHAR(191) NULL');
      await connection.query('ALTER TABLE `Route` ADD COLUMN `managerId` VARCHAR(191) NULL');
      await connection.query('ALTER TABLE `Route` ADD CONSTRAINT `fk_route_supervisor` FOREIGN KEY (`supervisorId`) REFERENCES `User`(`id`) ON DELETE SET NULL');
      await connection.query('ALTER TABLE `Route` ADD CONSTRAINT `fk_route_manager` FOREIGN KEY (`managerId`) REFERENCES `Manager`(`id`) ON DELETE SET NULL');
      await connection.query('CREATE INDEX `idx_route_supervisor` ON `Route`(`supervisorId`)');
      await connection.query('CREATE INDEX `idx_route_manager` ON `Route`(`managerId`)');
    }
    const hasSuperName = routeColumns.some((col: any) => col.Field === 'superName');
    if (!hasSuperName) {
      await connection.query('ALTER TABLE `Route` ADD COLUMN `superName` VARCHAR(191) NULL');
    }

    // 6. Modify SKU Table
    console.log('Modifying SKU table...');
    const [skuColumns]: any = await connection.query('SHOW COLUMNS FROM `SKU`');
    const hasSkuType = skuColumns.some((col: any) => col.Field === 'type');
    if (!hasSkuType) {
      await connection.query("ALTER TABLE `SKU` ADD COLUMN `type` VARCHAR(50) NOT NULL DEFAULT 'SKU'");
      await connection.query('CREATE INDEX `idx_sku_type` ON `SKU`(`type`)');
    }
    const hasBusinessVertical = skuColumns.some((col: any) => col.Field === 'businessVertical');
    if (!hasBusinessVertical) {
      await connection.query('ALTER TABLE `SKU` ADD COLUMN `businessVertical` VARCHAR(191) NULL');
    }

    // 7. Create PowerSKU Table
    console.log('Creating PowerSKU table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`PowerSKU\` (
        \`skuCode\` VARCHAR(191) NOT NULL,
        \`skuName\` VARCHAR(191) NOT NULL,
        \`channel\` VARCHAR(191) NOT NULL,
        PRIMARY KEY (\`skuCode\`, \`channel\`),
        INDEX \`idx_powersku_channel\` (\`channel\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Create Customer Table
    console.log('Creating Customer table...');
    await connection.query(`
      CREATE TABLE \`Customer\` (
        \`cust_rt_id\` VARCHAR(191) PRIMARY KEY,
        \`customerCode\` VARCHAR(191) NOT NULL,
        \`customerName\` VARCHAR(191) NOT NULL,
        \`classification\` VARCHAR(50) NOT NULL,
        \`channel\` VARCHAR(191) NOT NULL,
        \`routeCode\` VARCHAR(191) NOT NULL,
        FOREIGN KEY (\`routeCode\`) REFERENCES \`Route\`(\`routeCode\`) ON DELETE CASCADE,
        INDEX \`idx_customer_route\` (\`routeCode\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Create CustomerRouteMapping
    console.log('Creating CustomerRouteMapping table...');
    await connection.query(`
      CREATE TABLE \`CustomerRouteMapping\` (
        \`cust_rt_id\` VARCHAR(191) PRIMARY KEY,
        \`customerCode\` VARCHAR(191) NOT NULL,
        \`routeCode\` VARCHAR(191) NOT NULL,
        FOREIGN KEY (\`cust_rt_id\`) REFERENCES \`Customer\`(\`cust_rt_id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`routeCode\`) REFERENCES \`Route\`(\`routeCode\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Create Visit table
    console.log('Creating Visit table...');
    await connection.query(`
      CREATE TABLE \`Visit\` (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Create VisitPhoto table
    console.log('Creating VisitPhoto table...');
    await connection.query(`
      CREATE TABLE \`VisitPhoto\` (
        \`photoId\` VARCHAR(191) PRIMARY KEY,
        \`visitId\` VARCHAR(191) NOT NULL,
        \`category\` ENUM('Dairy', 'Beverages', 'Ice Cream', 'Vegetables') NOT NULL,
        \`cloudinaryUrl\` TEXT NOT NULL,
        \`publicId\` VARCHAR(191) NOT NULL,
        \`uploadedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        FOREIGN KEY (\`visitId\`) REFERENCES \`Visit\`(\`visitId\`) ON DELETE CASCADE,
        INDEX \`idx_photo_visit\` (\`visitId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Create NPDResponse table
    console.log('Creating NPDResponse table...');
    await connection.query(`
      CREATE TABLE \`NPDResponse\` (
        \`visitId\` VARCHAR(191) NOT NULL,
        \`skuCode\` VARCHAR(191) NOT NULL,
        \`status\` ENUM('Available', 'Not Available', 'Not Required') NOT NULL,
        PRIMARY KEY (\`visitId\`, \`skuCode\`),
        FOREIGN KEY (\`visitId\`) REFERENCES \`Visit\`(\`visitId\`) ON DELETE CASCADE,
        INDEX \`idx_npd_sku\` (\`skuCode\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. Create VisitAsset table
    console.log('Creating VisitAsset table...');
    await connection.query(`
      CREATE TABLE \`VisitAsset\` (
        \`assetId\` VARCHAR(191) PRIMARY KEY,
        \`visitId\` VARCHAR(191) NOT NULL,
        \`assetType\` ENUM('Chiller', 'Freezer') NOT NULL,
        \`temperature\` DOUBLE NOT NULL,
        \`tempInRange\` TINYINT(1) NOT NULL,
        \`actionRequired\` ENUM('Cleaning', 'Repair', 'Replacement', 'Gas Filling', 'Other', 'None') NOT NULL DEFAULT 'None',
        \`observation\` TEXT NOT NULL,
        \`isFirstInFlow\` TINYINT(1) NOT NULL DEFAULT 0,
        \`fefoFollowed\` TINYINT(1) NOT NULL DEFAULT 0,
        FOREIGN KEY (\`visitId\`) REFERENCES \`Visit\`(\`visitId\`) ON DELETE CASCADE,
        INDEX \`idx_asset_visit\` (\`visitId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 14. Create VisitPowerSkuResult table
    console.log('Creating VisitPowerSkuResult table...');
    await connection.query(`
      CREATE TABLE \`VisitPowerSkuResult\` (
        \`visitId\` VARCHAR(191) NOT NULL,
        \`skuCode\` VARCHAR(191) NOT NULL,
        \`status\` ENUM('Available', 'Not Available', 'Not Required') NOT NULL,
        PRIMARY KEY (\`visitId\`, \`skuCode\`),
        FOREIGN KEY (\`visitId\`) REFERENCES \`Visit\`(\`visitId\`) ON DELETE CASCADE,
        INDEX \`idx_powersku_visit\` (\`visitId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Re-enable foreign key checks now that tables are created
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // 15. Restore Customer Data (Optional - bypassed by default for fast fresh updates)
    const shouldRestore = process.env.RESTORE_DATA === 'true';
    if (shouldRestore) {
      console.log(`Restoring ${existingMappings.length} Customer Mappings...`);
      const customerDetails = new Map<string, any>();
      existingCustomers.forEach((c: any) => {
        customerDetails.set(c.customerCode, c);
      });

      for (const m of existingMappings) {
        const detail = customerDetails.get(m.customerCode) || {
          customerName: 'Unknown',
          classification: 'D',
          channel: 'General Trade',
        };
        const cust_rt_id = `${m.customerCode}|${m.routeCode}`;
        
        await connection.query(`
          INSERT IGNORE INTO \`Customer\` (\`cust_rt_id\`, \`customerCode\`, \`customerName\`, \`classification\`, \`channel\`, \`routeCode\`)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [cust_rt_id, m.customerCode, detail.customerName, detail.classification, detail.channel, m.routeCode]);

        await connection.query(`
          INSERT IGNORE INTO \`CustomerRouteMapping\` (\`cust_rt_id\`, \`customerCode\`, \`routeCode\`)
          VALUES (?, ?, ?)
        `, [cust_rt_id, m.customerCode, m.routeCode]);
      }

      // 16. Restore Visits
      console.log(`Restoring ${existingVisits.length} Visits...`);
      for (const v of existingVisits) {
        const cust_rt_id = `${v.customerCode}|${v.routeCode}`;

        // Ensure mapping customer exists
        await connection.query(`
          INSERT IGNORE INTO \`Customer\` (\`cust_rt_id\`, \`customerCode\`, \`customerName\`, \`classification\`, \`channel\`, \`routeCode\`)
          VALUES (?, ?, ?, 'D', 'General Trade', ?)
        `, [cust_rt_id, v.customerCode, v.customerCode, v.routeCode]);

        await connection.query(`
          INSERT INTO \`Visit\` (\`visitId\`, \`supervisorId\`, \`cust_rt_id\`, \`latitude\`, \`longitude\`, \`accuracy\`, \`status\`, \`createdBy\`, \`visit_datetime\`, \`createdAt\`, \`updatedAt\`)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          v.visitId,
          v.supervisorId,
          cust_rt_id,
          v.latitude,
          v.longitude,
          v.accuracy,
          v.status,
          v.createdBy,
          v.visit_datetime || v.createdAt || new Date(),
          v.createdAt || new Date(),
          v.updatedAt || new Date()
        ]);

        // Insert migrated asset record
        const assetId = `ast_${Math.random().toString(36).substring(2, 9)}`;
        await connection.query(`
          INSERT INTO \`VisitAsset\` (\`assetId\`, \`visitId\`, \`assetType\`, \`temperature\`, \`tempInRange\`, \`actionRequired\`, \`observation\`)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          assetId,
          v.visitId,
          v.assetType || 'Chiller',
          v.temperature || 0,
          v.tempInRange ? 1 : 0,
          v.actionRequired || 'None',
          v.observation || ''
        ]);
      }

      // 17. Restore Photos
      console.log(`Restoring ${existingPhotos.length} Photos...`);
      for (const p of existingPhotos) {
        await connection.query(`
          INSERT INTO \`VisitPhoto\` (\`photoId\`, \`visitId\`, \`category\`, \`cloudinaryUrl\`, \`publicId\`, \`uploadedAt\`)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [p.photoId, p.visitId, p.category, p.cloudinaryUrl, p.publicId, p.uploadedAt]);
      }

      // 18. Restore NPD Responses
      console.log(`Restoring ${existingNpd.length} NPD responses...`);
      for (const n of existingNpd) {
        await connection.query(`
          INSERT INTO \`NPDResponse\` (\`visitId\`, \`skuCode\`, \`status\`)
          VALUES (?, ?, ?)
        `, [n.visitId, n.skuCode, n.status]);
      }
    } else {
      console.log('Bypassing data restoration loops for fast schema reset.');
    }

    console.log('Database migration completed successfully!');
  } catch (error: any) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.error('Database migration failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
