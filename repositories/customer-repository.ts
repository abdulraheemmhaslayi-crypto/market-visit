import { Customer, CustomerRouteMapping, CustomerClassification } from '@/types';
import pool, { isMssql } from '@/lib/db';
import { getCustMasterChannel } from '@/lib/custmaster-channel';

let customerSchemaChecked = false;
let customerSchemaPromise: Promise<void> | null = null;

async function ensureCustomerTableSchema(): Promise<void> {
  if (customerSchemaChecked || isMssql) return;
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

    try {
      await pool.execute("CREATE INDEX `idx_cust_code` ON `Customer` (`customerCode`)");
    } catch (e) {}
    try {
      await pool.execute("CREATE INDEX `idx_crm_cust` ON `CustomerRouteMapping` (`customerCode`)");
    } catch (e) {}

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
    const rt = (row.routeCode || '').toUpperCase();
    if (rt.startsWith('MT')) ch = 'MT';
    else if (rt.startsWith('IS')) ch = 'INST';
    else ch = 'TT';
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
    if (!customers || customers.length === 0) return { inserted: 0, updated: 0 };

    let inserted = 0;
    let updated = 0;

    // 1. Ensure routes referenced by customers exist in Route table (batch insert)
    const uniqueRoutes = new Map<string, string>();
    for (const cust of customers) {
      if (cust.routeCode && !uniqueRoutes.has(cust.routeCode)) {
        uniqueRoutes.set(cust.routeCode, cust.channel || 'TT');
      }
    }
    const routeEntries = Array.from(uniqueRoutes.entries());
    if (routeEntries.length > 0) {
      const ROUTE_BATCH = 100;
      for (let i = 0; i < routeEntries.length; i += ROUTE_BATCH) {
        const batch = routeEntries.slice(i, i + ROUTE_BATCH);
        try {
          if (isMssql) {
            for (const [rCode, rChannel] of batch) {
              await pool.execute(
                `MERGE INTO \`Route\` AS target
                 USING (SELECT ? AS routeCode, ? AS routeName, ? AS channel) AS source
                 ON target.routeCode = source.routeCode
                 WHEN NOT MATCHED THEN 
                   INSERT (routeCode, routeName, channel) VALUES (source.routeCode, source.routeName, source.channel);`,
                [rCode, `Route ${rCode}`, rChannel || 'GT']
              );
            }
          } else {
            const placeholders = batch.map(() => '(?, ?, ?)').join(', ');
            const params: any[] = [];
            for (const [rCode, rChannel] of batch) {
              params.push(rCode, `Route ${rCode}`, rChannel || 'TT');
            }
            await pool.execute(
              `INSERT IGNORE INTO \`Route\` (\`routeCode\`, \`routeName\`, \`channel\`) VALUES ${placeholders}`,
              params
            );
          }
        } catch (e) {}
      }
    }

    // 2. Deduplicate customers by cust_rt_id
    const customerMap = new Map<string, Customer>();
    for (const cust of customers) {
      if (!cust.cust_rt_id || !cust.customerCode) continue;
      customerMap.set(cust.cust_rt_id, cust);
    }
    const validCustomers = Array.from(customerMap.values());
    if (validCustomers.length === 0) return { inserted: 0, updated: 0 };

    // 3. Batch upsert Customer table
    const CUST_BATCH = 250;
    for (let i = 0; i < validCustomers.length; i += CUST_BATCH) {
      const batch = validCustomers.slice(i, i + CUST_BATCH);
      if (isMssql) {
        for (const cust of batch) {
          const [res]: any = await pool.execute(
            `MERGE INTO \`Customer\` AS target
             USING (SELECT ? AS cust_rt_id, ? AS customerCode, ? AS customerName, ? AS classification, ? AS dairyClassification, ? AS iceCreamClassification, ? AS channel, ? AS routeCode) AS source
             ON target.cust_rt_id = source.cust_rt_id
             WHEN MATCHED THEN
               UPDATE SET 
                 \`customerName\` = source.customerName,
                 \`classification\` = source.classification,
                 \`dairyClassification\` = COALESCE(source.dairyClassification, target.dairyClassification),
                 \`iceCreamClassification\` = COALESCE(source.iceCreamClassification, target.iceCreamClassification),
                 \`channel\` = source.channel,
                 \`customerCode\` = source.customerCode,
                 \`routeCode\` = source.routeCode
             WHEN NOT MATCHED THEN
               INSERT (\`cust_rt_id\`, \`customerCode\`, \`customerName\`, \`classification\`, \`dairyClassification\`, \`iceCreamClassification\`, \`channel\`, \`routeCode\`) 
               VALUES (source.cust_rt_id, source.customerCode, source.customerName, source.classification, source.dairyClassification, source.iceCreamClassification, source.channel, source.routeCode);`,
            [cust.cust_rt_id, cust.customerCode, cust.customerName, cust.classification, cust.dairyClassification || null, cust.iceCreamClassification || null, cust.channel, cust.routeCode]
          );
          if (res?.affectedRows === 1) inserted++; else updated++;
        }
      } else {
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params: any[] = [];
        for (const cust of batch) {
          params.push(
            cust.cust_rt_id,
            cust.customerCode,
            cust.customerName,
            cust.classification,
            cust.dairyClassification || null,
            cust.iceCreamClassification || null,
            cust.channel,
            cust.routeCode
          );
        }
        const [res]: any = await pool.execute(
          `INSERT INTO \`Customer\` (\`cust_rt_id\`, \`customerCode\`, \`customerName\`, \`classification\`, \`dairyClassification\`, \`iceCreamClassification\`, \`channel\`, \`routeCode\`) 
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE 
             \`customerName\` = VALUES(\`customerName\`),
             \`classification\` = VALUES(\`classification\`),
             \`dairyClassification\` = COALESCE(VALUES(\`dairyClassification\`), \`Customer\`.\`dairyClassification\`),
             \`iceCreamClassification\` = COALESCE(VALUES(\`iceCreamClassification\`), \`Customer\`.\`iceCreamClassification\`),
             \`channel\` = VALUES(\`channel\`),
             \`customerCode\` = VALUES(\`customerCode\`),
             \`routeCode\` = VALUES(\`routeCode\`)`,
          params
        );
        const aff = res?.affectedRows || 0;
        inserted += Math.min(batch.length, aff);
        if (aff > batch.length) {
          updated += aff - batch.length;
        }
      }
    }

    // 4. Batch sync dairy/ice cream classifications to Customer_Classification
    const classificationsToSync = new Map<string, { customerCode: string; businessVertical: string; classification: string; channel: string | null }>();
    for (const cust of validCustomers) {
      if (cust.dairyClassification) {
        const key = `${cust.customerCode.toUpperCase()}|Dairy`;
        classificationsToSync.set(key, {
          customerCode: cust.customerCode,
          businessVertical: 'Dairy',
          classification: cust.dairyClassification,
          channel: cust.channel || null,
        });
      }
      if (cust.iceCreamClassification) {
        const key = `${cust.customerCode.toUpperCase()}|Ice Cream`;
        classificationsToSync.set(key, {
          customerCode: cust.customerCode,
          businessVertical: 'Ice Cream',
          classification: cust.iceCreamClassification,
          channel: cust.channel || null,
        });
      }
    }

    const classList = Array.from(classificationsToSync.values());
    if (classList.length > 0) {
      const CLASS_BATCH = 250;
      for (let i = 0; i < classList.length; i += CLASS_BATCH) {
        const batch = classList.slice(i, i + CLASS_BATCH);
        if (isMssql) {
          for (const item of batch) {
            await pool.execute(
              `MERGE INTO \`Customer_Classification\` AS target
               USING (SELECT ? AS customerCode, ? AS businessVertical, ? AS classification, ? AS channel) AS source
               ON target.customerCode = source.customerCode AND target.businessVertical = source.businessVertical
               WHEN MATCHED THEN
                 UPDATE SET \`classification\` = source.classification, \`channel\` = source.channel
               WHEN NOT MATCHED THEN
                 INSERT (\`customerCode\`, \`businessVertical\`, \`classification\`, \`channel\`)
                 VALUES (source.customerCode, source.businessVertical, source.classification, source.channel);`,
              [item.customerCode, item.businessVertical, item.classification, item.channel]
            );
          }
        } else {
          const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
          const params: any[] = [];
          for (const item of batch) {
            params.push(item.customerCode, item.businessVertical, item.classification, item.channel);
          }
          await pool.execute(
            `INSERT INTO \`Customer_Classification\` (\`customerCode\`, \`businessVertical\`, \`classification\`, \`channel\`)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE \`classification\` = VALUES(\`classification\`), \`channel\` = VALUES(\`channel\`)`,
            params
          );
        }
      }
    }

    return { inserted, updated };
  },

  async upsertMappings(mappings: CustomerRouteMapping[]): Promise<{ inserted: number; updated: number }> {
    await ensureCustomerTableSchema();
    if (!mappings || mappings.length === 0) return { inserted: 0, updated: 0 };

    let inserted = 0;
    let updated = 0;

    // 1. Ensure routes referenced by mappings exist (batch insert)
    const uniqueRoutes = new Set<string>();
    for (const m of mappings) {
      if (m.routeCode) uniqueRoutes.add(m.routeCode.trim());
    }
    const routesList = Array.from(uniqueRoutes);
    if (routesList.length > 0) {
      const ROUTE_BATCH = 100;
      for (let i = 0; i < routesList.length; i += ROUTE_BATCH) {
        const batch = routesList.slice(i, i + ROUTE_BATCH);
        try {
          if (isMssql) {
            for (const rCode of batch) {
              await pool.execute(
                `MERGE INTO \`Route\` AS target
                 USING (SELECT ? AS routeCode, ? AS routeName, 'GT' AS channel) AS source
                 ON target.routeCode = source.routeCode
                 WHEN NOT MATCHED THEN 
                   INSERT (routeCode, routeName, channel) VALUES (source.routeCode, source.routeName, source.channel);`,
                [rCode, `Route ${rCode}`]
              );
            }
          } else {
            const placeholders = batch.map(() => '(?, ?, \'TT\')').join(', ');
            const params: any[] = [];
            for (const rCode of batch) {
              params.push(rCode, `Route ${rCode}`);
            }
            await pool.execute(
              `INSERT IGNORE INTO \`Route\` (\`routeCode\`, \`routeName\`, \`channel\`) VALUES ${placeholders}`,
              params
            );
          }
        } catch (e) {}
      }
    }

    // 2. Deduplicate mappings by cust_rt_id
    const mappingMap = new Map<string, CustomerRouteMapping>();
    for (const m of mappings) {
      if (!m.customerCode || !m.routeCode) continue;
      const cust_rt_id = m.cust_rt_id || `${m.customerCode}|${m.routeCode}`;
      mappingMap.set(cust_rt_id, { ...m, cust_rt_id });
    }
    const validMappings = Array.from(mappingMap.values());
    if (validMappings.length === 0) return { inserted, updated };

    // 3. Batch upsert mappings
    const MAP_BATCH = 250;
    for (let i = 0; i < validMappings.length; i += MAP_BATCH) {
      const batch = validMappings.slice(i, i + MAP_BATCH);
      if (isMssql) {
        for (const m of batch) {
          try {
            const [res]: any = await pool.execute(
              `UPDATE \`Customer\` SET \`routeCode\` = ? WHERE \`cust_rt_id\` = ? OR \`customerCode\` = ?`,
              [m.routeCode, m.cust_rt_id, m.customerCode]
            );
            if (res?.affectedRows > 0) updated++; else inserted++;
          } catch (e) {
            inserted++;
          }
        }
      } else {
        const placeholders = batch.map(() => '(?, ?, ?)').join(', ');
        const params: any[] = [];
        for (const m of batch) {
          params.push(m.cust_rt_id, m.customerCode, m.routeCode);
        }
        const [res]: any = await pool.execute(
          `INSERT INTO \`CustomerRouteMapping\` (\`cust_rt_id\`, \`customerCode\`, \`routeCode\`) 
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE 
             \`customerCode\` = VALUES(\`customerCode\`),
             \`routeCode\` = VALUES(\`routeCode\`)`,
          params
        );
        const aff = res?.affectedRows || 0;
        inserted += Math.min(batch.length, aff);
        if (aff > batch.length) {
          updated += aff - batch.length;
        }
      }
    }

    return { inserted, updated };
  },

  async upsertClassifications(classifications: CustomerClassification[]): Promise<{ inserted: number; updated: number }> {
    await ensureCustomerTableSchema();
    if (!classifications || classifications.length === 0) return { inserted: 0, updated: 0 };

    let inserted = 0;
    let updated = 0;

    // 1. Deduplicate by customerCode + businessVertical
    const validMap = new Map<string, CustomerClassification>();
    for (const item of classifications) {
      const code = (item.customerCode || '').trim().toUpperCase();
      const bVert = (item.businessVertical || '').trim();
      const cls = (item.classification || '').trim().toUpperCase();
      const ch = item.channel ? item.channel.trim().toUpperCase() : null;

      if (!code || !cls) continue;
      const key = `${code}|${bVert.toLowerCase()}`;
      validMap.set(key, { customerCode: code, businessVertical: bVert, classification: cls, channel: ch || undefined });
    }

    const uniqueClassifications = Array.from(validMap.values());
    if (uniqueClassifications.length === 0) return { inserted: 0, updated: 0 };

    // 2. Batch upsert into Customer_Classification table
    const BATCH_SIZE = 250;
    for (let i = 0; i < uniqueClassifications.length; i += BATCH_SIZE) {
      const batch = uniqueClassifications.slice(i, i + BATCH_SIZE);

      if (isMssql) {
        for (const item of batch) {
          const [res]: any = await pool.execute(
            `MERGE INTO \`Customer_Classification\` AS target
             USING (SELECT ? AS customerCode, ? AS businessVertical, ? AS classification, ? AS channel) AS source
             ON target.customerCode = source.customerCode AND target.businessVertical = source.businessVertical
             WHEN MATCHED THEN
               UPDATE SET \`classification\` = source.classification, \`channel\` = source.channel
             WHEN NOT MATCHED THEN
               INSERT (\`customerCode\`, \`businessVertical\`, \`classification\`, \`channel\`)
               VALUES (source.customerCode, source.businessVertical, source.classification, source.channel);`,
            [item.customerCode, item.businessVertical, item.classification, item.channel || null]
          );
          if (res?.affectedRows === 1) inserted++; else updated++;
        }
      } else {
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        const params: any[] = [];
        for (const item of batch) {
          params.push(item.customerCode, item.businessVertical, item.classification, item.channel || null);
        }
        const [res]: any = await pool.execute(
          `INSERT INTO \`Customer_Classification\` (\`customerCode\`, \`businessVertical\`, \`classification\`, \`channel\`)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE 
             \`classification\` = VALUES(\`classification\`),
             \`channel\` = VALUES(\`channel\`)`,
          params
        );
        const aff = res?.affectedRows || 0;
        inserted += Math.min(batch.length, aff);
        if (aff > batch.length) {
          updated += aff - batch.length;
        }
      }
    }

    // 3. Fast bulk sync from Customer_Classification to Customer table!
    if (isMssql) {
      try {
        await pool.execute(`
          UPDATE c
          SET 
            c.dairyClassification = CASE WHEN LOWER(cc.businessVertical) = 'dairy' THEN cc.classification ELSE c.dairyClassification END,
            c.iceCreamClassification = CASE WHEN LOWER(cc.businessVertical) LIKE '%ice%' THEN cc.classification ELSE c.iceCreamClassification END,
            c.classification = COALESCE(c.classification, cc.classification),
            c.channel = CASE 
              WHEN cc.channel IS NOT NULL AND cc.channel <> '' AND UPPER(LTRIM(RTRIM(cc.channel))) NOT IN ('GT', 'GENERAL TRADE') THEN cc.channel 
              ELSE c.channel 
            END
          FROM [Customer] c
          JOIN [Customer_Classification] cc ON c.customerCode = cc.customerCode;
        `);
      } catch (err: any) {
        console.warn('Could not bulk update Customer classifications in MSSQL:', err.message);
      }
    } else {
      try {
        // 3a. Update Dairy classifications for exact match
        await pool.execute(`
          UPDATE \`Customer\` c
          JOIN \`Customer_Classification\` cc ON c.customerCode = cc.customerCode AND LOWER(cc.businessVertical) = 'dairy'
          SET 
            c.dairyClassification = cc.classification,
            c.classification = COALESCE(c.classification, cc.classification),
            c.channel = CASE 
              WHEN cc.channel IS NOT NULL AND cc.channel != '' AND UPPER(TRIM(cc.channel)) NOT IN ('GT', 'GENERAL TRADE') THEN cc.channel 
              ELSE c.channel 
            END
        `);

        // 3b. Update Ice Cream classifications for exact match
        await pool.execute(`
          UPDATE \`Customer\` c
          JOIN \`Customer_Classification\` cc ON c.customerCode = cc.customerCode AND LOWER(cc.businessVertical) LIKE '%ice%'
          SET 
            c.iceCreamClassification = cc.classification,
            c.classification = COALESCE(c.classification, cc.classification),
            c.channel = CASE 
              WHEN cc.channel IS NOT NULL AND cc.channel != '' AND UPPER(TRIM(cc.channel)) NOT IN ('GT', 'GENERAL TRADE') THEN cc.channel 
              ELSE c.channel 
            END
        `);

        // 3c. Prefix match variant: Customer has no 'C', Customer_Classification has 'C'
        await pool.execute(`
          UPDATE \`Customer\` c
          JOIN \`Customer_Classification\` cc ON cc.customerCode = CONCAT('C', c.customerCode) AND LOWER(cc.businessVertical) = 'dairy'
          SET 
            c.dairyClassification = cc.classification,
            c.classification = COALESCE(c.classification, cc.classification),
            c.channel = CASE 
              WHEN cc.channel IS NOT NULL AND cc.channel != '' AND UPPER(TRIM(cc.channel)) NOT IN ('GT', 'GENERAL TRADE') THEN cc.channel 
              ELSE c.channel 
            END
          WHERE c.customerCode NOT LIKE 'C%'
        `);
        await pool.execute(`
          UPDATE \`Customer\` c
          JOIN \`Customer_Classification\` cc ON cc.customerCode = CONCAT('C', c.customerCode) AND LOWER(cc.businessVertical) LIKE '%ice%'
          SET 
            c.iceCreamClassification = cc.classification,
            c.classification = COALESCE(c.classification, cc.classification),
            c.channel = CASE 
              WHEN cc.channel IS NOT NULL AND cc.channel != '' AND UPPER(TRIM(cc.channel)) NOT IN ('GT', 'GENERAL TRADE') THEN cc.channel 
              ELSE c.channel 
            END
          WHERE c.customerCode NOT LIKE 'C%'
        `);

        // 3d. Prefix match variant: Customer has 'C', Customer_Classification has no 'C'
        await pool.execute(`
          UPDATE \`Customer\` c
          JOIN \`Customer_Classification\` cc ON c.customerCode = CONCAT('C', cc.customerCode) AND LOWER(cc.businessVertical) = 'dairy'
          SET 
            c.dairyClassification = cc.classification,
            c.classification = COALESCE(c.classification, cc.classification),
            c.channel = CASE 
              WHEN cc.channel IS NOT NULL AND cc.channel != '' AND UPPER(TRIM(cc.channel)) NOT IN ('GT', 'GENERAL TRADE') THEN cc.channel 
              ELSE c.channel 
            END
          WHERE c.customerCode LIKE 'C%'
        `);
        await pool.execute(`
          UPDATE \`Customer\` c
          JOIN \`Customer_Classification\` cc ON c.customerCode = CONCAT('C', cc.customerCode) AND LOWER(cc.businessVertical) LIKE '%ice%'
          SET 
            c.iceCreamClassification = cc.classification,
            c.classification = COALESCE(c.classification, cc.classification),
            c.channel = CASE 
              WHEN cc.channel IS NOT NULL AND cc.channel != '' AND UPPER(TRIM(cc.channel)) NOT IN ('GT', 'GENERAL TRADE') THEN cc.channel 
              ELSE c.channel 
            END
          WHERE c.customerCode LIKE 'C%'
        `);
      } catch (syncErr: any) {
        console.warn('Could not bulk sync Customer table from Customer_Classification:', syncErr.message);
      }
    }

    return { inserted, updated };
  },

  async clearObsoleteCustomers(activeIds: string[]): Promise<number> {
    await ensureCustomerTableSchema();
    if (activeIds.length === 0) {
      return 0;
    }

    const activeSet = new Set(activeIds);
    const [dbRows]: any = await pool.execute('SELECT `cust_rt_id` FROM `Customer`');
    const dbIds: string[] = (dbRows as any[]).map((r) => r.cust_rt_id).filter(Boolean);
    const toDelete = dbIds.filter((id) => !activeSet.has(id));

    if (toDelete.length === 0) return 0;

    let deleted = 0;
    const chunkSize = 250;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      try {
        const [res]: any = await pool.execute(
          `DELETE FROM \`Customer\` 
           WHERE \`cust_rt_id\` IN (${placeholders})
             AND NOT EXISTS (SELECT 1 FROM \`CustomerRouteMapping\` WHERE \`CustomerRouteMapping\`.\`cust_rt_id\` = \`Customer\`.\`cust_rt_id\`)`,
          chunk
        );
        deleted += res.affectedRows || 0;
      } catch (err: any) {
        console.warn('Skipped deleting some obsolete customers due to foreign key constraints:', err.message);
      }
    }
    return deleted;
  },

  async clearObsoleteMappings(activeIds: string[]): Promise<number> {
    await ensureCustomerTableSchema();
    if (activeIds.length === 0) {
      return 0;
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
      try {
        const [res]: any = await pool.execute(
          `DELETE FROM \`CustomerRouteMapping\` WHERE \`cust_rt_id\` IN (${placeholders})`,
          chunk
        );
        deleted += res.affectedRows || 0;
      } catch (err: any) {
        console.warn('Skipped deleting some obsolete mappings due to foreign key constraints:', err.message);
      }
    }
    return deleted;
  },
};
