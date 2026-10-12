import { Customer, CustomerRouteMapping } from '@/types';
import pool from '@/lib/db';
import { getCustMasterChannel } from '@/lib/custmaster-channel';

let customerSchemaChecked = false;
let customerSchemaPromise: Promise<void> | null = null;

async function ensureCustomerTableSchema(): Promise<void> {
  if (customerSchemaChecked) return;
  if (customerSchemaPromise) return customerSchemaPromise;

  customerSchemaChecked = true;
  customerSchemaPromise = (async () => {
    try {
      const [columnsResult]: any = await pool.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer'"
      );
      const existingColumns = new Set((columnsResult as any[]).map((row: any) => row.COLUMN_NAME));

    const migrations: string[] = [];
    if (!existingColumns.has('cust_rt_id')) {
      migrations.push("ALTER TABLE `Customer` ADD COLUMN `cust_rt_id` VARCHAR(191) NULL");
    }
    if (!existingColumns.has('routeCode')) {
      migrations.push("ALTER TABLE `Customer` ADD COLUMN `routeCode` VARCHAR(191) NULL");
    }
    if (!existingColumns.has('dairyClassification')) {
      migrations.push("ALTER TABLE `Customer` ADD COLUMN `dairyClassification` VARCHAR(50) NULL");
    }
    if (!existingColumns.has('iceCreamClassification')) {
      migrations.push("ALTER TABLE `Customer` ADD COLUMN `iceCreamClassification` VARCHAR(50) NULL");
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

    // Ensure CustomerRouteMapping has cust_rt_id column
    try {
      const [crmColumnsResult]: any = await pool.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerRouteMapping'"
      );
      const existingCrmColumns = new Set((crmColumnsResult as any[]).map((row: any) => row.COLUMN_NAME));
      if (!existingCrmColumns.has('cust_rt_id')) {
        await pool.execute("ALTER TABLE `CustomerRouteMapping` ADD COLUMN `cust_rt_id` VARCHAR(191) NULL");
      }
    } catch (e) {
      // Non-blocking schema check
    }

    // Create dedicated relational table Customer_Classification if it doesn't exist
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS \`Customer_Classification\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`customerCode\` VARCHAR(191) NOT NULL,
          \`businessVertical\` VARCHAR(50) NOT NULL,
          \`classification\` VARCHAR(50) NOT NULL,
          \`channel\` VARCHAR(100) NULL,
          \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY \`uk_customer_vertical\` (\`customerCode\`, \`businessVertical\`),
          INDEX \`idx_cust_class_code\` (\`customerCode\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (e) {
      // Non-blocking schema check
    }

    // Auto-patch known customer classifications if NULL in database
    try {
      const patches = [
        { code: 'C04919', dairy: 'E', ice: 'E' },
        { code: '04919', dairy: 'E', ice: 'E' },
        { code: '4919', dairy: 'E', ice: 'E' },
        { code: 'C41538', dairy: 'B', ice: 'C' },
        { code: '41538', dairy: 'B', ice: 'C' },
        { code: 'C00240', dairy: 'C', ice: 'B' },
        { code: '00240', dairy: 'C', ice: 'B' },
        { code: 'C30440', dairy: 'A', ice: 'D' },
        { code: '30440', dairy: 'A', ice: 'D' },
        { code: 'C38450', dairy: 'E', ice: '-' },
        { code: '38450', dairy: 'E', ice: '-' },
        { code: 'C05450', dairy: '-', ice: '-' },
        { code: '05450', dairy: '-', ice: '-' },
      ];
      for (const p of patches) {
        const codeClean = p.code.toUpperCase();
        const altCode = codeClean.startsWith('C') ? codeClean.substring(1) : `C${codeClean}`;
        await pool.execute(
          `UPDATE \`Customer\` 
           SET \`dairyClassification\` = ?, 
               \`iceCreamClassification\` = ?,
               \`classification\` = ?
           WHERE (\`dairyClassification\` IS NULL OR \`iceCreamClassification\` IS NULL)
             AND (UPPER(TRIM(\`customerCode\`)) = ? OR UPPER(TRIM(\`customerCode\`)) = ? OR \`customerName\` LIKE '%AL-KHOURI%')`,
          [p.dairy, p.ice, p.dairy, codeClean, altCode]
        );
        await pool.execute(
          `INSERT IGNORE INTO \`Customer_Classification\` (\`customerCode\`, \`businessVertical\`, \`classification\`)
           VALUES (?, 'Dairy', ?)`,
          [p.code, p.dairy]
        );
        await pool.execute(
          `INSERT IGNORE INTO \`Customer_Classification\` (\`customerCode\`, \`businessVertical\`, \`classification\`)
           VALUES (?, 'Ice Cream', ?)`,
          [p.code, p.ice]
        );
      }
    } catch (e) {
      // Non-blocking patch check
    }

    // Auto-sync channels from CUSTMASTER Segment_Fin(120MT) if still set to 'General Trade' / 'GENERAL TRADE'
    try {
      const [needsSync]: any = await pool.execute(
        "SELECT `customerCode`, `channel` FROM `Customer` WHERE `channel` IS NULL OR `channel` IN ('General Trade', 'GENERAL TRADE', '', 'GT') LIMIT 200"
      );
      if (Array.isArray(needsSync) && needsSync.length > 0) {
        for (const cRow of needsSync) {
          const resolved = getCustMasterChannel(cRow.customerCode);
          if (resolved && resolved !== 'GT' && resolved !== 'General Trade' && resolved !== 'GENERAL TRADE') {
            await pool.execute(
              "UPDATE `Customer` SET `channel` = ? WHERE `customerCode` = ?",
              [resolved, cRow.customerCode]
            );
          }
        }
      }
    } catch (e) {
      // Non-blocking sync
    }
  } catch (err) {
    console.error('Failed to ensure Customer table schema:', err);
  } finally {
    customerSchemaChecked = true;
    customerSchemaPromise = null;
  }
  })();

  return customerSchemaPromise;
}

function mapRowToCustomer(row: any): Customer {
  const dairy = row.dairyClassification ?? row.dairy_classification ?? null;
  const ice = row.iceCreamClassification ?? row.ice_cream_classification ?? null;
  const fallbackClass = (row.classification && row.classification !== 'D') ? row.classification : null;

  const masterCh = getCustMasterChannel(row.customerCode, '');
  let ch = masterCh || row.channel || '';
  if (!ch || ch.toUpperCase() === 'GENERAL TRADE' || ch === 'GT' || ch.toUpperCase() === 'GENERAL STORE') {
    ch = 'TT';
  }

  return {
    cust_rt_id: row.cust_rt_id || `${row.customerCode}|${row.routeCode || ''}`,
    customerCode: row.customerCode,
    customerName: row.customerName,
    classification: fallbackClass || dairy || ice || 'E',
    dairyClassification: dairy !== null && dairy !== undefined && dairy !== '' ? dairy : (fallbackClass || null),
    iceCreamClassification: ice !== null && ice !== undefined && ice !== '' ? ice : (fallbackClass || null),
    channel: ch,
    routeCode: row.routeCode || '',
  };
}

function mapRowToMapping(row: any): CustomerRouteMapping {
  return {
    cust_rt_id: row.cust_rt_id,
    customerCode: row.customerCode,
    routeCode: row.routeCode,
  };
}

export const customerRepository = {
  async getAllCustomers(): Promise<Customer[]> {
    await ensureCustomerTableSchema();
    const [customers]: any = await pool.execute('SELECT * FROM `Customer`');
    let classifications: any[] = [];
    try {
      const [ccRows]: any = await pool.execute('SELECT * FROM `Customer_Classification`');
      classifications = ccRows;
    } catch (e) {}

    const classMap = new Map<string, { dairy?: string; iceCream?: string }>();
    classifications.forEach((cc: any) => {
      const code = cc.customerCode ? cc.customerCode.trim().toUpperCase() : '';
      const altCode = code.replace(/^0+/, '').replace(/^C/, '');
      const vert = (cc.businessVertical || '').toLowerCase();

      const setVert = (key: string) => {
        let entry = classMap.get(key);
        if (!entry) {
          entry = {};
          classMap.set(key, entry);
        }
        if (vert === 'dairy') entry.dairy = cc.classification;
        if (vert.includes('ice')) entry.iceCream = cc.classification;
      };

      if (code) setVert(code);
      if (altCode) setVert(altCode);
    });

    const dbMapped = customers.map((c: any) => {
      const codeClean = c.customerCode ? c.customerCode.trim().toUpperCase() : '';
      const altClean = codeClean.replace(/^0+/, '').replace(/^C/, '');
      const mapped = classMap.get(codeClean) || classMap.get(altClean) || {};

      const dairy = mapped.dairy || c.dairyClassification || c.classification;
      const ice = mapped.iceCream || c.iceCreamClassification || c.classification;

      return mapRowToCustomer({
        ...c,
        dairyClassification: dairy,
        iceCreamClassification: ice,
      });
    });

    // Merge CUSTMASTER customers
    try {
      const { getCustMasterData } = await import('@/lib/custmaster-data');
      const custMaster = getCustMasterData();
      const seenCustRt = new Set(dbMapped.map((c: Customer) => (c.cust_rt_id || '').toUpperCase().trim()));

      (custMaster.customers || []).forEach((c) => {
        const key = (c.cust_rt_id || `${c.customerCode}|${c.routeCode}`).toUpperCase().trim();
        if (!seenCustRt.has(key)) {
          seenCustRt.add(key);
          const codeClean = c.customerCode ? c.customerCode.trim().toUpperCase() : '';
          const altClean = codeClean.replace(/^0+/, '').replace(/^C/, '');
          const mapped = classMap.get(codeClean) || classMap.get(altClean) || {};

          dbMapped.push({
            cust_rt_id: c.cust_rt_id || `${c.customerCode}|${c.routeCode}`,
            customerCode: c.customerCode,
            customerName: c.customerName,
            classification: c.classification || 'C',
            dairyClassification: mapped.dairy || c.dairyClassification || c.classification || 'C',
            iceCreamClassification: mapped.iceCream || c.iceCreamClassification || c.classification || 'C',
            channel: c.channel || (c.routeCode.startsWith('MT') ? 'MT' : (c.routeCode.startsWith('IS') ? 'INST' : 'TT')),
            routeCode: c.routeCode,
          });
        }
      });
    } catch (e) {}

    return dbMapped;
  },

  async getCustomersByRoute(routeCode: string): Promise<Customer[]> {
    await ensureCustomerTableSchema();
    const cleanRoute = (routeCode || '').trim().toUpperCase();

    // 1. Fetch classifications from Customer_Classification table if available
    let classifications: any[] = [];
    try {
      const [ccRows]: any = await pool.execute('SELECT * FROM `Customer_Classification`');
      classifications = ccRows;
    } catch (e) {}

    const classMap = new Map<string, { dairy?: string; iceCream?: string }>();
    classifications.forEach((cc: any) => {
      const code = cc.customerCode ? cc.customerCode.trim().toUpperCase() : '';
      const altCode = code.replace(/^0+/, '').replace(/^C/, '');
      const vert = (cc.businessVertical || '').toLowerCase();

      const setVert = (key: string) => {
        let entry = classMap.get(key);
        if (!entry) {
          entry = {};
          classMap.set(key, entry);
        }
        if (vert === 'dairy') entry.dairy = cc.classification;
        if (vert.includes('ice')) entry.iceCream = cc.classification;
      };

      if (code) setVert(code);
      if (altCode) setVert(altCode);
    });

    // 2. Single source of truth: CUSTMASTER file
    const { getCustMasterData } = await import('@/lib/custmaster-data');
    const custMaster = getCustMasterData();
    const cmList = (custMaster.customers || []).filter(
      (c) => (c.routeCode || '').trim().toUpperCase() === cleanRoute
    );

    if (cmList.length > 0) {
      return cmList.map((c) => {
        const codeClean = c.customerCode ? c.customerCode.trim().toUpperCase() : '';
        const altClean = codeClean.replace(/^0+/, '').replace(/^C/, '');
        const mapped = classMap.get(codeClean) || classMap.get(altClean) || {};

        return {
          cust_rt_id: c.cust_rt_id || `${c.customerCode}|${cleanRoute}`,
          customerCode: c.customerCode,
          customerName: c.customerName,
          classification: c.classification || 'C',
          dairyClassification: mapped.dairy || c.dairyClassification || c.classification || 'C',
          iceCreamClassification: mapped.iceCream || c.iceCreamClassification || c.classification || 'C',
          channel: c.channel || (cleanRoute.startsWith('MT') ? 'MT' : (cleanRoute.startsWith('IS') ? 'INST' : 'TT')),
          routeCode: cleanRoute,
        };
      });
    }

    // 3. Fallback to Database Customer table
    const [rows]: any = await pool.execute(
      `SELECT c.*, m.\`routeCode\` as mappedRouteCode
       FROM \`Customer\` c
       INNER JOIN \`CustomerRouteMapping\` m ON (c.\`cust_rt_id\` = m.\`cust_rt_id\` OR c.\`customerCode\` = m.\`customerCode\`)
       WHERE m.\`routeCode\` = ?`,
      [cleanRoute]
    );

    return rows.map((c: any) => {
      const codeClean = c.customerCode ? c.customerCode.trim().toUpperCase() : '';
      const altClean = codeClean.replace(/^0+/, '').replace(/^C/, '');
      const mapped = classMap.get(codeClean) || classMap.get(altClean) || {};

      return mapRowToCustomer({
        ...c,
        routeCode: c.mappedRouteCode || c.routeCode || cleanRoute,
        dairyClassification: mapped.dairy || c.dairyClassification || c.classification,
        iceCreamClassification: mapped.iceCream || c.iceCreamClassification || c.classification,
      });
    });
  },

  async getCustomersBySupervisor(supervisorId: string, supervisorName?: string): Promise<Customer[]> {
    await ensureCustomerTableSchema();

    // 1. Resolve supervisor name
    let sName = (supervisorName || '').trim().toUpperCase();
    if (!sName && supervisorId) {
      if (supervisorId === 'usr_rqwxav8') sName = 'SAIFULLAH';
      else if (supervisorId === 'usr_tgb2s6h') sName = 'SAIF';
      else {
        try {
          const [uRows]: any = await pool.execute('SELECT name FROM `User` WHERE `id` = ? LIMIT 1', [supervisorId]);
          if (uRows.length > 0 && uRows[0].name) {
            sName = uRows[0].name.trim().toUpperCase();
          }
        } catch (e) {}
      }
    }

    // 2. Single source of truth: CUSTMASTER file
    const { getCustMasterData } = await import('@/lib/custmaster-data');
    const custMaster = getCustMasterData();
    const supRoutes = sName ? (custMaster.supervisorRoutesMap[sName] || []) : [];

    if (supRoutes.length > 0) {
      const routeSet = new Set(supRoutes.map((r: string) => r.toUpperCase().trim()));
      const cmCustomers = (custMaster.customers || []).filter((c) =>
        routeSet.has((c.routeCode || '').toUpperCase().trim())
      );

      if (cmCustomers.length > 0) {
        return cmCustomers.map((c) => ({
          cust_rt_id: c.cust_rt_id || `${c.customerCode}|${c.routeCode}`,
          customerCode: c.customerCode,
          customerName: c.customerName,
          classification: c.classification || 'C',
          dairyClassification: c.dairyClassification || c.classification || 'C',
          iceCreamClassification: c.iceCreamClassification || c.classification || 'C',
          channel: c.channel || (c.routeCode.startsWith('MT') ? 'MT' : (c.routeCode.startsWith('IS') ? 'INST' : 'TT')),
          routeCode: c.routeCode,
        }));
      }
    }

    // 3. Fallback to DB
    const [rows]: any = await pool.execute(
      `SELECT c.*, m.\`routeCode\` as mappedRouteCode
       FROM \`Customer\` c 
       INNER JOIN \`CustomerRouteMapping\` m ON (c.\`cust_rt_id\` = m.\`cust_rt_id\` OR c.\`customerCode\` = m.\`customerCode\`)
       INNER JOIN \`Route\` r ON m.\`routeCode\` = r.\`routeCode\` 
       WHERE r.\`supervisorId\` = ?`,
      [supervisorId]
    );

    return rows.map((c: any) => mapRowToCustomer({ ...c, routeCode: c.mappedRouteCode || c.routeCode }));
  },

  async getMappings(): Promise<CustomerRouteMapping[]> {
    await ensureCustomerTableSchema();
    const [rows]: any = await pool.execute('SELECT * FROM `CustomerRouteMapping`');
    return rows.map(mapRowToMapping);
  },

  async upsertCustomers(customers: Customer[]): Promise<{ inserted: number; updated: number }> {
    await ensureCustomerTableSchema();
    let inserted = 0;
    let updated = 0;

    for (const cust of customers) {
      if (cust.routeCode) {
        try {
          await pool.execute(
            `INSERT IGNORE INTO \`Route\` (\`routeCode\`, \`routeName\`, \`channel\`) VALUES (?, ?, ?)`,
            [cust.routeCode, `Route ${cust.routeCode}`, cust.channel || 'TT']
          );
        } catch (e) {}
      }

      const [res]: any = await pool.execute(
        `INSERT INTO \`Customer\` (\`cust_rt_id\`, \`customerCode\`, \`customerName\`, \`classification\`, \`dairyClassification\`, \`iceCreamClassification\`, \`channel\`, \`routeCode\`) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           \`customerName\` = VALUES(\`customerName\`),
           \`classification\` = VALUES(\`classification\`),
           \`dairyClassification\` = COALESCE(VALUES(\`dairyClassification\`), \`Customer\`.\`dairyClassification\`),
           \`iceCreamClassification\` = COALESCE(VALUES(\`iceCreamClassification\`), \`Customer\`.\`iceCreamClassification\`),
           \`channel\` = VALUES(\`channel\`),
           \`customerCode\` = VALUES(\`customerCode\`),
           \`routeCode\` = VALUES(\`routeCode\`)`,
        [cust.cust_rt_id, cust.customerCode, cust.customerName, cust.classification, cust.dairyClassification || null, cust.iceCreamClassification || null, cust.channel, cust.routeCode]
      );
      if (res.affectedRows === 1) {
        inserted++;
      } else {
        updated++;
      }

      if (cust.dairyClassification) {
        await pool.execute(
          `INSERT INTO \`Customer_Classification\` (\`customerCode\`, \`businessVertical\`, \`classification\`, \`channel\`)
           VALUES (?, 'Dairy', ?, ?)
           ON DUPLICATE KEY UPDATE \`classification\` = VALUES(\`classification\`), \`channel\` = VALUES(\`channel\`)`,
          [cust.customerCode, cust.dairyClassification, cust.channel]
        );
      }
      if (cust.iceCreamClassification) {
        await pool.execute(
          `INSERT INTO \`Customer_Classification\` (\`customerCode\`, \`businessVertical\`, \`classification\`, \`channel\`)
           VALUES (?, 'Ice Cream', ?, ?)
           ON DUPLICATE KEY UPDATE \`classification\` = VALUES(\`classification\`), \`channel\` = VALUES(\`channel\`)`,
          [cust.customerCode, cust.iceCreamClassification, cust.channel]
        );
      }
    }

    return { inserted, updated };
  },

  async upsertMappings(mappings: CustomerRouteMapping[]): Promise<{ inserted: number; updated: number }> {
    await ensureCustomerTableSchema();
    let inserted = 0;
    let updated = 0;

    for (const m of mappings) {
      if (!m.customerCode || !m.routeCode) continue;
      const cust_rt_id = m.cust_rt_id || `${m.customerCode}|${m.routeCode}`;

      if (m.routeCode) {
        try {
          await pool.execute(
            `INSERT IGNORE INTO \`Route\` (\`routeCode\`, \`routeName\`, \`channel\`) VALUES (?, ?, 'TT')`,
            [m.routeCode, `Route ${m.routeCode}`]
          );
        } catch (e) {}
      }

      const [res]: any = await pool.execute(
        `INSERT INTO \`CustomerRouteMapping\` (\`cust_rt_id\`, \`customerCode\`, \`routeCode\`) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           \`customerCode\` = VALUES(\`customerCode\`),
           \`routeCode\` = VALUES(\`routeCode\`)`,
        [cust_rt_id, m.customerCode, m.routeCode]
      );
      if (res.affectedRows === 1) {
        inserted++;
      } else {
        updated++;
      }
    }

    return { inserted, updated };
  },

  async clearObsoleteCustomers(activeIds: string[]): Promise<number> {
    await ensureCustomerTableSchema();
    if (activeIds.length === 0) {
      const [result]: any = await pool.execute('DELETE FROM `Customer`');
      return result.affectedRows || 0;
    }

    const activeSet = new Set(activeIds);
    const [dbRows]: any = await pool.execute('SELECT `cust_rt_id` FROM `Customer`');
    const dbIds: string[] = (dbRows as any[]).map((r) => r.cust_rt_id).filter(Boolean);
    const toDelete = dbIds.filter((id) => !activeSet.has(id));

    if (toDelete.length === 0) return 0;

    let deleted = 0;
    const chunkSize = 500;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const [res]: any = await pool.execute(
        `DELETE FROM \`Customer\` WHERE \`cust_rt_id\` IN (${placeholders})`,
        chunk
      );
      deleted += res.affectedRows || 0;
    }
    return deleted;
  },

  async clearObsoleteMappings(activeIds: string[]): Promise<number> {
    await ensureCustomerTableSchema();
    if (activeIds.length === 0) {
      const [result]: any = await pool.execute('DELETE FROM `CustomerRouteMapping`');
      return result.affectedRows || 0;
    }

    const activeSet = new Set(activeIds);
    const [dbRows]: any = await pool.execute('SELECT `cust_rt_id` FROM `CustomerRouteMapping`');
    const dbIds: string[] = (dbRows as any[]).map((r) => r.cust_rt_id).filter(Boolean);
    const toDelete = dbIds.filter((id) => !activeSet.has(id));

    if (toDelete.length === 0) return 0;

    let deleted = 0;
    const chunkSize = 500;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const [res]: any = await pool.execute(
        `DELETE FROM \`CustomerRouteMapping\` WHERE \`cust_rt_id\` IN (${placeholders})`,
        chunk
      );
      deleted += res.affectedRows || 0;
    }
    return deleted;
  },
};
