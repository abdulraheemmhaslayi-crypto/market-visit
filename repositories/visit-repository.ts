import { Visit, VisitPhoto, NPDResponse, VisitAsset, VisitPowerSkuResult } from '@/types';
import pool from '@/lib/db';
import mysql from 'mysql2/promise';

function mapRowToVisit(row: any): Visit {
  const [customerCode, routeCode] = (row.cust_rt_id || '').split('|');
  return {
    visitId: row.visitId,
    supervisorId: row.supervisorId,
    cust_rt_id: row.cust_rt_id,
    visit_type: row.visit_type as any,
    reason_category: row.reason_category,
    reason: row.reason,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    status: row.status as any,
    createdBy: row.createdBy,
    visit_datetime: row.visit_datetime instanceof Date ? row.visit_datetime.toISOString() : row.visit_datetime,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    sosAsPerBda: row.sosAsPerBda === null ? null : (row.sosAsPerBda === 1 || row.sosAsPerBda === true),
    routeCode: routeCode || '',
    customerCode: customerCode || '',
    dairyClassification: row.dairyClassification || row.dairy_classification || undefined,
    iceCreamClassification: row.iceCreamClassification || row.ice_cream_classification || undefined,
  };
}

function mapRowToPhoto(row: any): VisitPhoto {
  const uploadDate = row.uploadedAt || row.createdAt || row.uploaded_at || row.created_at;
  return {
    photoId: row.photoId || row.id,
    visitId: row.visitId || row.visit_id,
    category: row.category as any,
    cloudinaryUrl: row.cloudinaryUrl || row.url || row.photoUrl || row.image_url || '',
    publicId: row.publicId || row.public_id || row.photoId || '',
    uploadedAt: uploadDate instanceof Date ? uploadDate.toISOString() : (uploadDate ? String(uploadDate) : new Date().toISOString()),
    appName: row.appName || row.app_name || row.application || 'Chrome',
  };
}

function mapRowToNpd(row: any): NPDResponse {
  return {
    responseId: `${row.visitId}_${row.skuCode}`,
    visitId: row.visitId,
    skuCode: row.skuCode,
    status: row.status as any,
  };
}

async function ensureVisitTableSchema(connection: mysql.Connection | mysql.PoolConnection): Promise<void> {
  const [columnsResult]: any = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Visit'"
  );
  const existingColumns = new Set((columnsResult as any[]).map((row: any) => row.COLUMN_NAME));

  const migrations: string[] = [];

  if (!existingColumns.has('visit_type')) {
    migrations.push("ALTER TABLE `Visit` ADD COLUMN `visit_type` ENUM('Visit','No Visit') NOT NULL DEFAULT 'Visit'");
  }
  if (!existingColumns.has('reason_category')) {
    migrations.push("ALTER TABLE `Visit` ADD COLUMN `reason_category` VARCHAR(191) NULL");
  }
  if (!existingColumns.has('reason')) {
    migrations.push("ALTER TABLE `Visit` ADD COLUMN `reason` TEXT NULL");
  }
  if (!existingColumns.has('observation')) {
    migrations.push("ALTER TABLE `Visit` ADD COLUMN `observation` TEXT NULL");
  }
  if (!existingColumns.has('sosAsPerBda')) {
    migrations.push("ALTER TABLE `Visit` ADD COLUMN `sosAsPerBda` TINYINT(1) NULL");
  }
  if (!existingColumns.has('visit_datetime')) {
    migrations.push("ALTER TABLE `Visit` ADD COLUMN `visit_datetime` DATETIME NULL");
  }

  if (!existingColumns.has('cust_rt_id')) {
    migrations.push("ALTER TABLE `Visit` ADD COLUMN `cust_rt_id` VARCHAR(191) NULL");
  }
  if (!existingColumns.has('dairyClassification')) {
    migrations.push("ALTER TABLE `Visit` ADD COLUMN `dairyClassification` VARCHAR(50) NULL");
  }
  if (!existingColumns.has('iceCreamClassification')) {
    migrations.push("ALTER TABLE `Visit` ADD COLUMN `iceCreamClassification` VARCHAR(50) NULL");
  }

  const [custRtColumns]: any = await connection.execute("SHOW COLUMNS FROM `Visit` LIKE 'cust_rt_id'");
  if (custRtColumns?.[0]?.Null === 'NO') {
    migrations.push("ALTER TABLE `Visit` MODIFY COLUMN `cust_rt_id` VARCHAR(191) NULL");
  }

  if (existingColumns.has('temperature')) {
    migrations.push("ALTER TABLE `Visit` MODIFY COLUMN `temperature` DOUBLE NULL");
  }
  if (existingColumns.has('assetType')) {
    migrations.push("ALTER TABLE `Visit` MODIFY COLUMN `assetType` VARCHAR(50) NULL");
  }
  if (existingColumns.has('tempInRange')) {
    migrations.push("ALTER TABLE `Visit` MODIFY COLUMN `tempInRange` TINYINT(1) NULL");
  }
  if (existingColumns.has('actionRequired')) {
    migrations.push("ALTER TABLE `Visit` MODIFY COLUMN `actionRequired` VARCHAR(50) NULL");
  }
  if (existingColumns.has('observation')) {
    migrations.push("ALTER TABLE `Visit` MODIFY COLUMN `observation` TEXT NULL");
  }

  for (const migration of migrations) {
    try {
      await connection.execute(migration);
    } catch (error: any) {
      if (!/duplicate column|already exists|doesn't exist|Unknown column/i.test(error.message || '')) {
        throw error;
      }
    }
  }

  // Ensure VisitAsset table exists and has all required columns
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`VisitAsset\` (
        \`assetId\` VARCHAR(191) PRIMARY KEY,
        \`visitId\` VARCHAR(191) NOT NULL,
        \`assetType\` VARCHAR(50) NOT NULL,
        \`temperature\` DOUBLE NULL,
        \`tempInRange\` TINYINT(1) NULL,
        \`actionRequired\` VARCHAR(50) NULL,
        \`observation\` TEXT NULL,
        \`isFirstInFlow\` TINYINT(1) NULL DEFAULT 0,
        \`fefoFollowed\` TINYINT(1) NULL DEFAULT 0,
        INDEX \`idx_asset_visit\` (\`visitId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [vaColumnsResult]: any = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'VisitAsset'"
    );
    const existingVaColumns = new Set((vaColumnsResult as any[]).map((row: any) => row.COLUMN_NAME));

    if (!existingVaColumns.has('assetId')) {
      await connection.execute("ALTER TABLE `VisitAsset` ADD COLUMN `assetId` VARCHAR(191) NULL");
    }
    if (!existingVaColumns.has('isFirstInFlow')) {
      await connection.execute("ALTER TABLE `VisitAsset` ADD COLUMN `isFirstInFlow` TINYINT(1) NULL DEFAULT 0");
    }
    if (!existingVaColumns.has('fefoFollowed')) {
      await connection.execute("ALTER TABLE `VisitAsset` ADD COLUMN `fefoFollowed` TINYINT(1) NULL DEFAULT 0");
    }

    // Migrate PRIMARY KEY if table was created with legacy composite (visitId, assetType)
    try {
      const [pkColsResult]: any = await connection.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'VisitAsset' AND CONSTRAINT_NAME = 'PRIMARY'"
      );
      const pkCols = (pkColsResult as any[]).map((r: any) => r.COLUMN_NAME);
      if (pkCols.includes('visitId') && pkCols.includes('assetType') && !pkCols.includes('assetId')) {
        // Backfill assetId where null
        await connection.execute("UPDATE `VisitAsset` SET `assetId` = CONCAT('ast_', `visitId`, '_', `assetType`) WHERE `assetId` IS NULL OR `assetId` = ''");
        await connection.execute("ALTER TABLE `VisitAsset` DROP PRIMARY KEY, ADD PRIMARY KEY (`assetId`)");
      }
    } catch (pkErr) {}
  } catch (e) {
    // Non-blocking VisitAsset migration
  }

  await ensureVisitPhotoTableSchema(connection);
}

async function ensureVisitPhotoTableSchema(connection: mysql.Connection | mysql.PoolConnection): Promise<void> {
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`VisitPhoto\` (
        \`photoId\` VARCHAR(191) PRIMARY KEY,
        \`visitId\` VARCHAR(191) NOT NULL,
        \`category\` VARCHAR(50) NOT NULL,
        \`cloudinaryUrl\` TEXT NOT NULL,
        \`publicId\` VARCHAR(191) NOT NULL,
        \`uploadedAt\` DATETIME NOT NULL,
        \`appName\` VARCHAR(191) NULL DEFAULT 'Chrome',
        INDEX \`idx_photo_visit\` (\`visitId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [vpColumnsResult]: any = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'VisitPhoto'"
    );
    const existingVpColumns = new Set((vpColumnsResult as any[]).map((row: any) => row.COLUMN_NAME));

    if (!existingVpColumns.has('photoId') && existingVpColumns.has('id')) {
      await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `id` `photoId` VARCHAR(191) NOT NULL");
    }

    if (!existingVpColumns.has('visitId') && existingVpColumns.has('visit_id')) {
      await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `visit_id` `visitId` VARCHAR(191) NOT NULL");
    }

    if (!existingVpColumns.has('cloudinaryUrl')) {
      if (existingVpColumns.has('url')) {
        await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `url` `cloudinaryUrl` TEXT NOT NULL");
      } else if (existingVpColumns.has('photoUrl')) {
        await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `photoUrl` `cloudinaryUrl` TEXT NOT NULL");
      } else if (existingVpColumns.has('image_url')) {
        await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `image_url` `cloudinaryUrl` TEXT NOT NULL");
      } else {
        await connection.execute("ALTER TABLE `VisitPhoto` ADD COLUMN `cloudinaryUrl` TEXT NOT NULL");
      }
    }

    if (!existingVpColumns.has('publicId')) {
      if (existingVpColumns.has('public_id')) {
        await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `public_id` `publicId` VARCHAR(191) NULL DEFAULT ''");
      } else {
        await connection.execute("ALTER TABLE `VisitPhoto` ADD COLUMN `publicId` VARCHAR(191) NULL DEFAULT ''");
      }
    }

    if (!existingVpColumns.has('uploadedAt')) {
      if (existingVpColumns.has('createdAt')) {
        await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `createdAt` `uploadedAt` DATETIME NOT NULL");
      } else if (existingVpColumns.has('created_at')) {
        await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `created_at` `uploadedAt` DATETIME NOT NULL");
      } else if (existingVpColumns.has('uploaded_at')) {
        await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `uploaded_at` `uploadedAt` DATETIME NOT NULL");
      } else {
        await connection.execute("ALTER TABLE `VisitPhoto` ADD COLUMN `uploadedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
      }
    }

    if (!existingVpColumns.has('appName')) {
      if (existingVpColumns.has('app_name')) {
        await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `app_name` `appName` VARCHAR(191) NULL DEFAULT 'Chrome'");
      } else if (existingVpColumns.has('application')) {
        await connection.execute("ALTER TABLE `VisitPhoto` CHANGE COLUMN `application` `appName` VARCHAR(191) NULL DEFAULT 'Chrome'");
      } else {
        await connection.execute("ALTER TABLE `VisitPhoto` ADD COLUMN `appName` VARCHAR(191) NULL DEFAULT 'Chrome'");
      }
    }
  } catch (e) {
    // Non-blocking VisitPhoto migration
  }
}

function toMysqlDatetime(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export const visitRepository = {
  async getVisitById(visitId: string): Promise<Visit | null> {
    const connection = await pool.getConnection();
    try {
      await ensureVisitTableSchema(connection);
      const [rows]: any = await connection.execute(
        'SELECT * FROM `Visit` WHERE `visitId` = ? LIMIT 1',
        [visitId]
      );
      if (rows.length === 0) return null;
      return mapRowToVisit(rows[0]);
    } finally {
      connection.release();
    }
  },

  async getVisitsBySupervisor(supervisorId: string): Promise<Visit[]> {
    const connection = await pool.getConnection();
    try {
      await ensureVisitTableSchema(connection);
      const [rows]: any = await connection.execute(
        'SELECT * FROM `Visit` WHERE `supervisorId` = ?',
        [supervisorId]
      );
      return rows.map(mapRowToVisit);
    } finally {
      connection.release();
    }
  },

  async getAllVisits(): Promise<Visit[]> {
    const connection = await pool.getConnection();
    try {
      await ensureVisitTableSchema(connection);
      const [rows]: any = await connection.execute('SELECT * FROM `Visit`');
      return rows.map(mapRowToVisit);
    } finally {
      connection.release();
    }
  },

  async getVisitPhotos(visitId: string): Promise<VisitPhoto[]> {
    const connection = await pool.getConnection();
    try {
      await ensureVisitPhotoTableSchema(connection);
      const [rows]: any = await connection.execute(
        'SELECT * FROM `VisitPhoto` WHERE `visitId` = ?',
        [visitId]
      );
      return rows.map(mapRowToPhoto);
    } finally {
      connection.release();
    }
  },

  async getNpdResponses(visitId: string): Promise<NPDResponse[]> {
    const [rows]: any = await pool.execute(
      'SELECT * FROM `NPDResponse` WHERE `visitId` = ?',
      [visitId]
    );
    return rows.map(mapRowToNpd);
  },

  async getAllNpdResponses(): Promise<NPDResponse[]> {
    const [rows]: any = await pool.execute('SELECT * FROM `NPDResponse`');
    return rows.map(mapRowToNpd);
  },

  async getVisitAssets(visitId: string): Promise<VisitAsset[]> {
    const [rows]: any = await pool.execute(
      'SELECT * FROM `VisitAsset` WHERE `visitId` = ?',
      [visitId]
    );
    return rows.map((r: any) => ({
      assetId: r.assetId || `ast_${Math.random().toString(36).substring(2, 9)}`,
      visitId: r.visitId,
      assetType: r.assetType as any,
      temperature: r.temperature,
      tempInRange: r.tempInRange === 1 || r.tempInRange === true,
      actionRequired: r.actionRequired as any,
      observation: r.observation || '',
      isFirstInFlow: r.isFirstInFlow === 1 || r.isFirstInFlow === true,
      fefoFollowed: r.fefoFollowed === 1 || r.fefoFollowed === true,
    }));
  },

  async getVisitPowerSkuResults(visitId: string): Promise<VisitPowerSkuResult[]> {
    const [rows]: any = await pool.execute(
      'SELECT * FROM `VisitPowerSkuResult` WHERE `visitId` = ?',
      [visitId]
    );
    return rows.map((r: any) => ({
      visitId: r.visitId,
      skuCode: r.skuCode,
      status: r.status as any,
    }));
  },

  async saveVisitRecord(visit: Visit, connection?: mysql.Connection | mysql.PoolConnection): Promise<void> {
    const executor = connection || pool;
    const isNoVisit = visit.visit_type === 'No Visit';

    const visitDatetimeVal = toMysqlDatetime(visit.visit_datetime) || toMysqlDatetime(visit.createdAt) || new Date();
    const createdAtVal = toMysqlDatetime(visit.createdAt) || new Date();
    const updatedAtVal = toMysqlDatetime(visit.updatedAt) || new Date();

    await executor.execute(
      `
      INSERT INTO \`Visit\` (
        \`visitId\`, \`supervisorId\`, \`cust_rt_id\`, \`dairyClassification\`, \`iceCreamClassification\`, \`visit_type\`, \`reason_category\`, \`reason\`, \`observation\`,
        \`latitude\`, \`longitude\`, \`accuracy\`, \`status\`, 
        \`createdBy\`, \`visit_datetime\`, \`createdAt\`, \`updatedAt\`, \`sosAsPerBda\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`supervisorId\` = VALUES(\`supervisorId\`),
        \`cust_rt_id\` = VALUES(\`cust_rt_id\`),
        \`dairyClassification\` = VALUES(\`dairyClassification\`),
        \`iceCreamClassification\` = VALUES(\`iceCreamClassification\`),
        \`visit_type\` = VALUES(\`visit_type\`),
        \`reason_category\` = VALUES(\`reason_category\`),
        \`reason\` = VALUES(\`reason\`),
        \`observation\` = VALUES(\`observation\`),
        \`latitude\` = VALUES(\`latitude\`),
        \`longitude\` = VALUES(\`longitude\`),
        \`accuracy\` = VALUES(\`accuracy\`),
        \`status\` = VALUES(\`status\`),
        \`createdBy\` = VALUES(\`createdBy\`),
        \`visit_datetime\` = VALUES(\`visit_datetime\`),
        \`updatedAt\` = VALUES(\`updatedAt\`),
        \`sosAsPerBda\` = VALUES(\`sosAsPerBda\`)
    `,
      [
        visit.visitId,
        visit.supervisorId,
        visit.cust_rt_id || null,
        visit.dairyClassification || null,
        visit.iceCreamClassification || null,
        visit.visit_type || 'Visit',
        isNoVisit ? (visit.reason_category || null) : null,
        isNoVisit ? (visit.reason || null) : (visit.observation || null),
        visit.observation || null,
        visit.latitude,
        visit.longitude,
        visit.accuracy,
        visit.status,
        visit.createdBy,
        visitDatetimeVal,
        createdAtVal,
        updatedAtVal,
        visit.sosAsPerBda === null ? null : (visit.sosAsPerBda ? 1 : 0),
      ]
    );
  },

  async deletePhotosForVisit(visitId: string, connection?: mysql.Connection | mysql.PoolConnection): Promise<void> {
    const executor = connection || pool;
    await executor.execute('DELETE FROM `VisitPhoto` WHERE `visitId` = ?', [visitId]);
  },

  async insertPhotos(photos: VisitPhoto[], connection?: mysql.Connection | mysql.PoolConnection): Promise<void> {
    const executor = connection || pool;
    await ensureVisitPhotoTableSchema(executor);
    for (const p of photos) {
      const uploadedAtVal = toMysqlDatetime(p.uploadedAt) || new Date();
      const appNameVal = p.appName || 'Chrome';
      const publicIdVal = p.publicId || p.photoId || '';
      try {
        await executor.execute(
          `INSERT INTO \`VisitPhoto\` (\`photoId\`, \`visitId\`, \`category\`, \`cloudinaryUrl\`, \`publicId\`, \`uploadedAt\`, \`appName\`) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [p.photoId, p.visitId, p.category, p.cloudinaryUrl, publicIdVal, uploadedAtVal, appNameVal]
        );
      } catch (err: any) {
        if (err.message && err.message.includes('Unknown column')) {
          await ensureVisitPhotoTableSchema(executor);
          await executor.execute(
            `INSERT INTO \`VisitPhoto\` (\`photoId\`, \`visitId\`, \`category\`, \`cloudinaryUrl\`, \`publicId\`, \`uploadedAt\`, \`appName\`) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [p.photoId, p.visitId, p.category, p.cloudinaryUrl, publicIdVal, uploadedAtVal, appNameVal]
          );
        } else {
          throw err;
        }
      }
    }
  },

  async deleteNpdForVisit(visitId: string, connection?: mysql.Connection | mysql.PoolConnection): Promise<void> {
    const executor = connection || pool;
    await executor.execute('DELETE FROM `NPDResponse` WHERE `visitId` = ?', [visitId]);
  },

  async insertNpd(npdResponses: NPDResponse[], connection?: mysql.Connection | mysql.PoolConnection): Promise<void> {
    const executor = connection || pool;
    for (const n of npdResponses) {
      await executor.execute(
        'INSERT INTO `NPDResponse` (`visitId`, `skuCode`, `status`) VALUES (?, ?, ?)',
        [n.visitId, n.skuCode, n.status]
      );
    }
  },

  async deleteAssetsForVisit(visitId: string, connection?: mysql.Connection | mysql.PoolConnection): Promise<void> {
    const executor = connection || pool;
    await executor.execute('DELETE FROM `VisitAsset` WHERE `visitId` = ?', [visitId]);
  },

  async insertAssets(assets: VisitAsset[], connection?: mysql.Connection | mysql.PoolConnection): Promise<void> {
    const executor = connection || pool;
    for (const ast of assets) {
      const assetIdVal = ast.assetId || `ast_${ast.visitId}_${ast.assetType}_${Math.random().toString(36).substring(2, 9)}`;
      try {
        await executor.execute(
          `INSERT INTO \`VisitAsset\` (\`assetId\`, \`visitId\`, \`assetType\`, \`temperature\`, \`tempInRange\`, \`actionRequired\`, \`observation\`, \`isFirstInFlow\`, \`fefoFollowed\`) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             \`assetType\` = VALUES(\`assetType\`),
             \`temperature\` = VALUES(\`temperature\`),
             \`tempInRange\` = VALUES(\`tempInRange\`),
             \`actionRequired\` = VALUES(\`actionRequired\`),
             \`observation\` = VALUES(\`observation\`),
             \`isFirstInFlow\` = VALUES(\`isFirstInFlow\`),
             \`fefoFollowed\` = VALUES(\`fefoFollowed\`)`,
          [assetIdVal, ast.visitId, ast.assetType, ast.temperature ?? null, ast.tempInRange ? 1 : 0, ast.actionRequired, ast.observation || '', ast.isFirstInFlow ? 1 : 0, ast.fefoFollowed ? 1 : 0]
        );
      } catch (err: any) {
        if (err.message && err.message.includes('Unknown column')) {
          await executor.execute(
            `INSERT INTO \`VisitAsset\` (\`visitId\`, \`assetType\`, \`temperature\`, \`tempInRange\`, \`actionRequired\`, \`observation\`) 
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               \`temperature\` = VALUES(\`temperature\`),
               \`tempInRange\` = VALUES(\`tempInRange\`),
               \`actionRequired\` = VALUES(\`actionRequired\`),
               \`observation\` = VALUES(\`observation\`)`,
            [ast.visitId, ast.assetType, ast.temperature ?? null, ast.tempInRange ? 1 : 0, ast.actionRequired, ast.observation || '']
          );
        } else {
          throw err;
        }
      }
    }
  },

  async deletePowerSkuResultsForVisit(visitId: string, connection?: mysql.Connection | mysql.PoolConnection): Promise<void> {
    const executor = connection || pool;
    await executor.execute('DELETE FROM `VisitPowerSkuResult` WHERE `visitId` = ?', [visitId]);
  },

  async insertPowerSkuResults(results: VisitPowerSkuResult[], connection?: mysql.Connection | mysql.PoolConnection): Promise<void> {
    const executor = connection || pool;
    for (const r of results) {
      await executor.execute(
        'INSERT INTO `VisitPowerSkuResult` (`visitId`, `skuCode`, `status`) VALUES (?, ?, ?)',
        [r.visitId, r.skuCode, r.status]
      );
    }
  },

  async saveVisit(
    visit: Visit,
    assets: VisitAsset[],
    photos: VisitPhoto[],
    powerSkuResults: VisitPowerSkuResult[],
    npdResponses: NPDResponse[]
  ): Promise<Visit> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await this.saveVisitRecord(visit, connection);
      
      await this.deleteAssetsForVisit(visit.visitId, connection);
      await this.insertAssets(assets, connection);
      
      await this.deletePhotosForVisit(visit.visitId, connection);
      await this.insertPhotos(photos, connection);
      
      await this.deletePowerSkuResultsForVisit(visit.visitId, connection);
      await this.insertPowerSkuResults(powerSkuResults, connection);

      await this.deleteNpdForVisit(visit.visitId, connection);
      await this.insertNpd(npdResponses, connection);

      await connection.commit();
      const savedVisit = await this.getVisitById(visit.visitId);
      if (!savedVisit) throw new Error('Visit not found after saving');
      return savedVisit;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async deleteVisit(visitId: string): Promise<void> {
    // Native ON DELETE CASCADE automatically handles VisitPhoto, VisitAsset, NPDResponse, VisitPowerSkuResult removal
    await pool.execute('DELETE FROM `Visit` WHERE `visitId` = ?', [visitId]);
  },
};
