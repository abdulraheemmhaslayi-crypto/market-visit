import { SKU, PowerSKU } from '@/types';
import pool from '@/lib/db';

function mapRowToSKU(row: any): SKU {
  return {
    skuCode: row.skuCode,
    skuName: row.skuName,
    type: row.type || 'SKU',
    businessVertical: row.businessVertical || '',
  };
}

function mapRowToPowerSKU(row: any): PowerSKU {
  return {
    skuCode: row.skuCode,
    skuName: row.skuName,
    channel: row.channel,
  };
}

let skuSchemaChecked = false;

async function ensureSkuTableSchema(): Promise<void> {
  if (skuSchemaChecked) return;
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`SKU\` (
        \`skuCode\` VARCHAR(191) PRIMARY KEY,
        \`skuName\` VARCHAR(191) NOT NULL,
        \`type\` VARCHAR(50) NOT NULL DEFAULT 'SKU',
        \`businessVertical\` VARCHAR(191) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`PowerSKU\` (
        \`skuCode\` VARCHAR(191) NOT NULL,
        \`skuName\` VARCHAR(191) NOT NULL,
        \`channel\` VARCHAR(191) NOT NULL,
        PRIMARY KEY (\`skuCode\`, \`channel\`),
        INDEX \`idx_powersku_channel\` (\`channel\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [columnsResult]: any = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SKU'"
    );
    const existingColumns = new Set((columnsResult as any[]).map((row: any) => row.COLUMN_NAME));

    const migrations: string[] = [];
    if (!existingColumns.has('type')) {
      migrations.push("ALTER TABLE `SKU` ADD COLUMN `type` VARCHAR(50) NOT NULL DEFAULT 'SKU'");
    }
    if (!existingColumns.has('businessVertical')) {
      migrations.push("ALTER TABLE `SKU` ADD COLUMN `businessVertical` VARCHAR(191) NULL");
    }

    for (const migration of migrations) {
      try {
        await pool.execute(migration);
      } catch (error: any) {
        if (!/duplicate column|already exists|doesn't exist|Unknown column/i.test(error.message || '')) {
          // ignore duplicate column errors
        }
      }
    }

    skuSchemaChecked = true;
  } catch (err) {
    console.error('Failed to ensure SKU table schema:', err);
  }
}

export const skuRepository = {
  async getAllSkus(): Promise<SKU[]> {
    await ensureSkuTableSchema();
    const [rows]: any = await pool.execute('SELECT * FROM `SKU`');
    return rows.map(mapRowToSKU);
  },

  async getSkusByType(type: string): Promise<SKU[]> {
    await ensureSkuTableSchema();
    const [rows]: any = await pool.execute('SELECT * FROM `SKU` WHERE `type` = ?', [type]);
    return rows.map(mapRowToSKU);
  },

  async getAllPowerSkus(): Promise<PowerSKU[]> {
    await ensureSkuTableSchema();
    const [rows]: any = await pool.execute('SELECT * FROM `PowerSKU`');
    return rows.map(mapRowToPowerSKU);
  },

  async getPowerSkusByChannel(channel: string): Promise<PowerSKU[]> {
    await ensureSkuTableSchema();
    const [rows]: any = await pool.execute('SELECT * FROM `PowerSKU` WHERE `channel` = ?', [channel]);
    return rows.map(mapRowToPowerSKU);
  },

  async upsertSkus(skus: SKU[]): Promise<{ inserted: number; updated: number }> {
    await ensureSkuTableSchema();
    let inserted = 0;
    let updated = 0;

    for (const sku of skus) {
      const typeVal = sku.type || 'SKU';
      const businessVerticalVal = sku.businessVertical || null;
      const [res]: any = await pool.execute(
        `INSERT INTO \`SKU\` (\`skuCode\`, \`skuName\`, \`type\`, \`businessVertical\`)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           \`skuName\` = VALUES(\`skuName\`),
           \`type\` = VALUES(\`type\`),
           \`businessVertical\` = VALUES(\`businessVertical\`)`,
        [sku.skuCode, sku.skuName, typeVal, businessVerticalVal]
      );
      if (res.affectedRows === 1) {
        inserted++;
      } else {
        updated++;
      }
    }

    return { inserted, updated };
  },

  async upsertPowerSkus(powerSkus: PowerSKU[]): Promise<{ inserted: number; updated: number }> {
    await ensureSkuTableSchema();
    let inserted = 0;
    let updated = 0;

    for (const ps of powerSkus) {
      const [res]: any = await pool.execute(
        `INSERT INTO \`PowerSKU\` (\`skuCode\`, \`skuName\`, \`channel\`) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           \`skuName\` = VALUES(\`skuName\`)`,
        [ps.skuCode, ps.skuName, ps.channel]
      );
      if (res.affectedRows === 1) {
        inserted++;
      } else {
        updated++;
      }
    }

    return { inserted, updated };
  },

  async clearObsoleteSkus(activeCodes: string[]): Promise<number> {
    await ensureSkuTableSchema();
    if (activeCodes.length === 0) {
      const [result]: any = await pool.execute('DELETE FROM `SKU`');
      return result.affectedRows || 0;
    }

    const activeSet = new Set(activeCodes);
    const [dbRows]: any = await pool.execute('SELECT `skuCode` FROM `SKU`');
    const dbCodes: string[] = (dbRows as any[]).map((r) => r.skuCode).filter(Boolean);
    const toDelete = dbCodes.filter((code) => !activeSet.has(code));

    if (toDelete.length === 0) return 0;

    let deleted = 0;
    const chunkSize = 500;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const [res]: any = await pool.execute(
        `DELETE FROM \`SKU\` WHERE \`skuCode\` IN (${placeholders})`,
        chunk
      );
      deleted += res.affectedRows || 0;
    }
    return deleted;
  },

  async clearObsoletePowerSkus(activeKeys: string[]): Promise<number> {
    await ensureSkuTableSchema();
    if (activeKeys.length === 0) {
      const [result]: any = await pool.execute('DELETE FROM `PowerSKU`');
      return result.affectedRows || 0;
    }

    const activeSet = new Set(activeKeys.map((k) => k.toUpperCase()));
    const [dbRows]: any = await pool.execute('SELECT UPPER(CONCAT(`skuCode`, \'_\', `channel`)) as pkey, `id` FROM `PowerSKU`');
    const toDeleteIds: number[] = (dbRows as any[])
      .filter((r) => r.pkey && !activeSet.has(r.pkey))
      .map((r) => r.id);

    if (toDeleteIds.length === 0) return 0;

    let deleted = 0;
    const chunkSize = 500;
    for (let i = 0; i < toDeleteIds.length; i += chunkSize) {
      const chunk = toDeleteIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const [res]: any = await pool.execute(
        `DELETE FROM \`PowerSKU\` WHERE \`id\` IN (${placeholders})`,
        chunk
      );
      deleted += res.affectedRows || 0;
    }
    return deleted;
  },
};
