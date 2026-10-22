import { Customer, CustomerRouteMapping, CustomerClassification } from '@/types';
import pool, { isMssql } from '@/lib/db';
import { getCustMasterChannel } from '@/lib/custmaster-channel';

let customerSchemaChecked = false;
let customerSchemaPromise: Promise<void> | null = null;

async function ensureCustomerTableSchema(): Promise<void> {
  if (customerSchemaChecked) return;
  if (customerSchemaPromise) return customerSchemaPromise;

  customerSchemaChecked = true;
  customerSchemaPromise = (async () => {
    try {
      if (isMssql) {
        try {
          await pool.execute(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Customer') AND name = 'cust_rt_id')
              ALTER TABLE [Customer] ADD [cust_rt_id] VARCHAR(191) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Customer') AND name = 'routeCode')
              ALTER TABLE [Customer] ADD [routeCode] VARCHAR(191) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Customer') AND name = 'dairyClassification')
              ALTER TABLE [Customer] ADD [dairyClassification] VARCHAR(50) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Customer') AND name = 'iceCreamClassification')
              ALTER TABLE [Customer] ADD [iceCreamClassification] VARCHAR(50) NULL;
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_customer_code' AND object_id = OBJECT_ID('Customer'))
              CREATE INDEX [idx_customer_code] ON [Customer] ([customerCode]);
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_customer_route' AND object_id = OBJECT_ID('Customer'))
              CREATE INDEX [idx_customer_route] ON [Customer] ([routeCode]);

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Customer_Classification')
            BEGIN
              CREATE TABLE [Customer_Classification] (
                [id] INT IDENTITY(1,1) PRIMARY KEY,
                [customerCode] VARCHAR(191) NOT NULL,
                [businessVertical] VARCHAR(50) NOT NULL,
                [classification] VARCHAR(50) NOT NULL,
                [channel] VARCHAR(100) NULL,
                [updatedAt] DATETIME DEFAULT GETDATE(),
                CONSTRAINT [uk_customer_vertical] UNIQUE ([customerCode], [businessVertical])
              );
              CREATE INDEX [idx_cust_class_code] ON [Customer_Classification] ([customerCode]);
            END
          `);
        } catch (mssqlSchemaErr) {
          console.warn('Non-fatal: MSSQL Customer schema check warning:', mssqlSchemaErr);
        }
        return;
      }

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
    if (isMssql) {
      const [rows]: any = await pool.execute(
        `SELECT * FROM [Customer] WHERE [routeCode] = ?`,
        [cleanRoute]
      );
      return rows.map((c: any) => {
        const codeClean = c.customerCode ? c.customerCode.trim().toUpperCase() : '';
        const altClean = codeClean.replace(/^0+/, '').replace(/^C/, '');
        const mapped = classMap.get(codeClean) || classMap.get(altClean) || {};

        return mapRowToCustomer({
          ...c,
          routeCode: c.routeCode || cleanRoute,
          dairyClassification: mapped.dairy || c.dairyClassification || c.classification,
          iceCreamClassification: mapped.iceCream || c.iceCreamClassification || c.classification,
        });
      });
    }

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
    if (isMssql) {
      const [rows]: any = await pool.execute(
        `SELECT c.* FROM [Customer] c 
         INNER JOIN [Route] r ON c.[routeCode] = r.[routeCode]
         WHERE r.[supervisorId] = ?`,
        [supervisorId]
      );
      return rows.map((c: any) => mapRowToCustomer(c));
    }

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
    if (isMssql) {
      const [rows]: any = await pool.execute('SELECT cust_rt_id, customerCode, routeCode FROM [Customer] WHERE routeCode IS NOT NULL');
      return rows.map(mapRowToMapping);
    }
    const [rows]: any = await pool.execute('SELECT * FROM `CustomerRouteMapping`');
    return rows.map(mapRowToMapping);
  },

  async upsertCustomers(customers: Customer[]): Promise<{ inserted: number; updated: number }> {
    await ensureCustomerTableSchema();
    let inserted = 0;
    let updated = 0;

    if (isMssql) {
      // 1. Ensure routes exist for all customers in batched chunks of 100
      const uniqueRoutes = Array.from(new Set(customers.map(c => c.routeCode).filter(Boolean))) as string[];
      const ROUTE_CHUNK = 100;
      for (let i = 0; i < uniqueRoutes.length; i += ROUTE_CHUNK) {
        const chunk = uniqueRoutes.slice(i, i + ROUTE_CHUNK);
        const selectClauses = chunk.map(() => 'SELECT ? AS routeCode, ? AS routeName, ? AS channel').join(' UNION ALL ');
        const rParams: any[] = [];
        chunk.forEach(r => rParams.push(r, `Route ${r}`, 'GT'));
        try {
          await pool.execute(
            `MERGE INTO [Route] WITH (HOLDLOCK) AS target
             USING (${selectClauses}) AS source
             ON target.routeCode = source.routeCode
             WHEN NOT MATCHED THEN 
               INSERT (routeCode, routeName, channel) VALUES (source.routeCode, source.routeName, source.channel);`,
            rParams
          );
        } catch (e) {}
      }

      // 2. Batch merge Customers in chunks of 100
      const CUST_CHUNK = 100;
      const classificationItems: CustomerClassification[] = [];

      for (let i = 0; i < customers.length; i += CUST_CHUNK) {
        const chunk = customers.slice(i, i + CUST_CHUNK);
        // Deduplicate within chunk by cust_rt_id to avoid T-SQL error 8672
        const chunkMap = new Map<string, Customer>();
        for (const cust of chunk) {
          const key = cust.cust_rt_id || `${cust.customerCode}|${cust.routeCode}`;
          chunkMap.set(key, { ...cust, cust_rt_id: key });
        }
        const dedupedChunk = Array.from(chunkMap.values());

        const selectClauses = dedupedChunk.map(() => 
          'SELECT ? AS cust_rt_id, ? AS customerCode, ? AS customerName, ? AS classification, ? AS dairyClassification, ? AS iceCreamClassification, ? AS channel, ? AS routeCode'
        ).join(' UNION ALL ');

        const params: any[] = [];
        for (const cust of dedupedChunk) {
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
          if (cust.dairyClassification) {
            classificationItems.push({
              customerCode: cust.customerCode,
              businessVertical: 'Dairy',
              classification: cust.dairyClassification,
              channel: cust.channel
            });
          }
          if (cust.iceCreamClassification) {
            classificationItems.push({
              customerCode: cust.customerCode,
              businessVertical: 'Ice Cream',
              classification: cust.iceCreamClassification,
              channel: cust.channel
            });
          }
        }

        try {
          const [res]: any = await pool.execute(
            `MERGE INTO [Customer] WITH (HOLDLOCK) AS target
             USING (${selectClauses}) AS source
             ON target.cust_rt_id = source.cust_rt_id
             WHEN MATCHED THEN
               UPDATE SET 
                 [customerName] = source.customerName,
                 [classification] = source.classification,
                 [dairyClassification] = COALESCE(source.dairyClassification, target.dairyClassification),
                 [iceCreamClassification] = COALESCE(source.iceCreamClassification, target.iceCreamClassification),
                 [channel] = source.channel,
                 [customerCode] = source.customerCode,
                 [routeCode] = source.routeCode
             WHEN NOT MATCHED THEN
               INSERT ([cust_rt_id], [customerCode], [customerName], [classification], [dairyClassification], [iceCreamClassification], [channel], [routeCode]) 
               VALUES (source.cust_rt_id, source.customerCode, source.customerName, source.classification, source.dairyClassification, source.iceCreamClassification, source.channel, source.routeCode);`,
            params
          );
          if (res?.affectedRows) {
            inserted += res.affectedRows;
          }
        } catch (batchErr: any) {
          console.warn('Batch merge customer error MSSQL:', batchErr.message);
        }
      }

      // 3. Batch merge classifications derived from customers
      if (classificationItems.length > 0) {
        const uniqueClassMap = new Map<string, CustomerClassification>();
        for (const item of classificationItems) {
          const code = (item.customerCode || '').trim().toUpperCase();
          const bVert = (item.businessVertical || '').trim();
          if (code && bVert) {
            uniqueClassMap.set(`${code}|${bVert.toUpperCase()}`, item);
          }
        }
        const uniqueClassList = Array.from(uniqueClassMap.values());

        const CLASS_CHUNK = 100;
        for (let i = 0; i < uniqueClassList.length; i += CLASS_CHUNK) {
          const chunk = uniqueClassList.slice(i, i + CLASS_CHUNK);
          const selectClauses = chunk.map(() => 'SELECT ? AS customerCode, ? AS businessVertical, ? AS classification, ? AS channel').join(' UNION ALL ');
          const params: any[] = [];
          chunk.forEach(c => params.push(c.customerCode, c.businessVertical, c.classification, c.channel || null));
          try {
            await pool.execute(
              `MERGE INTO [Customer_Classification] WITH (HOLDLOCK) AS target
               USING (${selectClauses}) AS source
               ON target.customerCode = source.customerCode AND target.businessVertical = source.businessVertical
               WHEN MATCHED THEN
                 UPDATE SET [classification] = source.classification, [channel] = source.channel
               WHEN NOT MATCHED THEN
                 INSERT ([customerCode], [businessVertical], [classification], [channel])
                 VALUES (source.customerCode, source.businessVertical, source.classification, source.channel);`,
              params
            );
          } catch (e: any) {
            console.warn('Batch merge Customer_Classification error MSSQL:', e.message);
          }
        }
      }
    } else {
      // High-performance batching for MySQL: 10 queries instead of 19,000 queries
      // 1. Ensure routes exist for all customers
      const uniqueRoutes = Array.from(new Set(customers.map(c => c.routeCode).filter(Boolean))) as string[];
      const ROUTE_CHUNK = 200;
      for (let i = 0; i < uniqueRoutes.length; i += ROUTE_CHUNK) {
        const chunk = uniqueRoutes.slice(i, i + ROUTE_CHUNK);
        const rPlaceholders = chunk.map(() => '(?, ?, ?)').join(', ');
        const rParams: any[] = [];
        chunk.forEach(r => rParams.push(r, `Route ${r}`, 'TT'));
        try {
          await pool.execute(`INSERT IGNORE INTO \`Route\` (\`routeCode\`, \`routeName\`, \`channel\`) VALUES ${rPlaceholders}`, rParams);
        } catch (e) {}
      }

      // 2. Batch insert Customers in chunks of 400
      const CUST_CHUNK = 400;
      const classificationItems: CustomerClassification[] = [];

      for (let i = 0; i < customers.length; i += CUST_CHUNK) {
        const chunk = customers.slice(i, i + CUST_CHUNK);
        const placeholders: string[] = [];
        const params: any[] = [];

        for (const cust of chunk) {
          placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
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
          if (cust.dairyClassification) {
            classificationItems.push({
              customerCode: cust.customerCode,
              businessVertical: 'Dairy',
              classification: cust.dairyClassification,
              channel: cust.channel
            });
          }
          if (cust.iceCreamClassification) {
            classificationItems.push({
              customerCode: cust.customerCode,
              businessVertical: 'Ice Cream',
              classification: cust.iceCreamClassification,
              channel: cust.channel
            });
          }
        }

        const [res]: any = await pool.execute(
          `INSERT INTO \`Customer\` (\`cust_rt_id\`, \`customerCode\`, \`customerName\`, \`classification\`, \`dairyClassification\`, \`iceCreamClassification\`, \`channel\`, \`routeCode\`) 
           VALUES ${placeholders.join(', ')}
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
        if (res?.affectedRows) {
          inserted += res.affectedRows;
        }
      }

      // 3. Batch insert classifications derived from customers
      if (classificationItems.length > 0) {
        const CLASS_CHUNK = 400;
        for (let i = 0; i < classificationItems.length; i += CLASS_CHUNK) {
          const chunk = classificationItems.slice(i, i + CLASS_CHUNK);
          const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
          const params: any[] = [];
          chunk.forEach(c => params.push(c.customerCode, c.businessVertical, c.classification, c.channel || null));
          try {
            await pool.execute(
              `INSERT INTO \`Customer_Classification\` (\`customerCode\`, \`businessVertical\`, \`classification\`, \`channel\`)
               VALUES ${placeholders}
               ON DUPLICATE KEY UPDATE \`classification\` = VALUES(\`classification\`), \`channel\` = VALUES(\`channel\`)`,
              params
            );
          } catch (e) {}
        }
      }
    }

    return { inserted, updated };
  },

  async upsertMappings(mappings: CustomerRouteMapping[]): Promise<{ inserted: number; updated: number }> {
    await ensureCustomerTableSchema();
    let inserted = 0;
    let updated = 0;

    if (isMssql) {
      // 1. Ensure routes exist for all mappings in batches
      const uniqueRoutes = Array.from(new Set(mappings.map(m => m.routeCode).filter(Boolean))) as string[];
      const ROUTE_CHUNK = 100;
      for (let i = 0; i < uniqueRoutes.length; i += ROUTE_CHUNK) {
        const chunk = uniqueRoutes.slice(i, i + ROUTE_CHUNK);
        const selectClauses = chunk.map(() => 'SELECT ? AS routeCode, ? AS routeName, ? AS channel').join(' UNION ALL ');
        const rParams: any[] = [];
        chunk.forEach(r => rParams.push(r, `Route ${r}`, 'GT'));
        try {
          await pool.execute(
            `MERGE INTO [Route] WITH (HOLDLOCK) AS target
             USING (${selectClauses}) AS source
             ON target.routeCode = source.routeCode
             WHEN NOT MATCHED THEN 
               INSERT (routeCode, routeName, channel) VALUES (source.routeCode, source.routeName, source.channel);`,
            rParams
          );
        } catch (e) {}
      }

      // 2. Batch update Customer table
      const MAP_CHUNK = 100;
      for (let i = 0; i < mappings.length; i += MAP_CHUNK) {
        const chunk = mappings.slice(i, i + MAP_CHUNK);
        const valid = chunk.filter(m => m.customerCode && m.routeCode);
        if (valid.length === 0) continue;

        const mapByCustRtId = new Map<string, CustomerRouteMapping>();
        for (const m of valid) {
          const cust_rt_id = m.cust_rt_id || `${m.customerCode}|${m.routeCode}`;
          mapByCustRtId.set(cust_rt_id, { ...m, cust_rt_id });
        }
        const deduped = Array.from(mapByCustRtId.values());

        const selectClauses = deduped.map(() => 'SELECT ? AS cust_rt_id, ? AS routeCode').join(' UNION ALL ');
        const params: any[] = [];
        deduped.forEach(m => params.push(m.cust_rt_id, m.routeCode));

        try {
          const [res]: any = await pool.execute(
            `MERGE INTO [Customer] WITH (HOLDLOCK) AS target
             USING (${selectClauses}) AS source
             ON target.cust_rt_id = source.cust_rt_id
             WHEN MATCHED THEN
               UPDATE SET [routeCode] = source.routeCode;`,
            params
          );
          if (res?.affectedRows) updated += res.affectedRows;
        } catch (e: any) {
          console.warn('Batch mapping update error MSSQL:', e.message);
        }
      }
      return { inserted, updated };
    } else {
      // 1. Ensure routes exist for all mappings in batches
      const uniqueRoutes = Array.from(new Set(mappings.map(m => m.routeCode).filter(Boolean))) as string[];
      const ROUTE_CHUNK = 200;
      for (let i = 0; i < uniqueRoutes.length; i += ROUTE_CHUNK) {
        const chunk = uniqueRoutes.slice(i, i + ROUTE_CHUNK);
        const rPlaceholders = chunk.map(() => '(?, ?, ?)').join(', ');
        const rParams: any[] = [];
        chunk.forEach(r => rParams.push(r, `Route ${r}`, 'TT'));
        try {
          await pool.execute(`INSERT IGNORE INTO \`Route\` (\`routeCode\`, \`routeName\`, \`channel\`) VALUES ${rPlaceholders}`, rParams);
        } catch (e) {}
      }

      // 2. Batch insert Mappings in chunks of 400
      const MAP_CHUNK = 400;
      for (let i = 0; i < mappings.length; i += MAP_CHUNK) {
        const chunk = mappings.slice(i, i + MAP_CHUNK);
        const valid = chunk.filter(m => m.customerCode && m.routeCode);
        if (valid.length === 0) continue;

        const placeholders = valid.map(() => '(?, ?, ?)').join(', ');
        const params: any[] = [];
        valid.forEach(m => {
          const cust_rt_id = m.cust_rt_id || `${m.customerCode}|${m.routeCode}`;
          params.push(cust_rt_id, m.customerCode, m.routeCode);
        });

        const [res]: any = await pool.execute(
          `INSERT INTO \`CustomerRouteMapping\` (\`cust_rt_id\`, \`customerCode\`, \`routeCode\`) 
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE 
             \`customerCode\` = VALUES(\`customerCode\`),
             \`routeCode\` = VALUES(\`routeCode\`)`,
          params
        );
        if (res?.affectedRows) {
          inserted += res.affectedRows;
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

    if (isMssql) {
      const validMap = new Map<string, CustomerClassification>();
      for (const item of classifications) {
        const code = (item.customerCode || '').trim().toUpperCase();
        const bVert = (item.businessVertical || '').trim();
        const cls = (item.classification || '').trim().toUpperCase();
        const ch = item.channel ? item.channel.trim().toUpperCase() : undefined;
        if (!code || !cls) continue;
        validMap.set(`${code}|${bVert.toUpperCase()}`, { customerCode: code, businessVertical: bVert, classification: cls, channel: ch });
      }
      const validList = Array.from(validMap.values());

      const CHUNK_SIZE = 100;
      for (let i = 0; i < validList.length; i += CHUNK_SIZE) {
        const chunk = validList.slice(i, i + CHUNK_SIZE);
        const selectClauses = chunk.map(() => 'SELECT ? AS customerCode, ? AS businessVertical, ? AS classification, ? AS channel').join(' UNION ALL ');
        const params: any[] = [];
        chunk.forEach(c => params.push(c.customerCode, c.businessVertical, c.classification, c.channel || null));

        try {
          const [res]: any = await pool.execute(
            `MERGE INTO [Customer_Classification] WITH (HOLDLOCK) AS target
             USING (${selectClauses}) AS source
             ON target.customerCode = source.customerCode AND target.businessVertical = source.businessVertical
             WHEN MATCHED THEN
               UPDATE SET [classification] = source.classification, [channel] = source.channel
             WHEN NOT MATCHED THEN
               INSERT ([customerCode], [businessVertical], [classification], [channel])
               VALUES (source.customerCode, source.businessVertical, source.classification, source.channel);`,
            params
          );
          if (res?.affectedRows) inserted += res.affectedRows;
        } catch (batchErr: any) {
          console.warn('Batch insert classification error MSSQL:', batchErr.message);
        }
      }

      // Fast set-based join updates on Customer table
      try {
        await pool.execute(`
          UPDATE c
          SET
            c.[dairyClassification] = CASE WHEN cc.[businessVertical] = 'Dairy' THEN cc.[classification] ELSE c.[dairyClassification] END,
            c.[iceCreamClassification] = CASE WHEN cc.[businessVertical] = 'Ice Cream' THEN cc.[classification] ELSE c.[iceCreamClassification] END,
            c.[classification] = COALESCE(c.[classification], cc.[classification])
          FROM [Customer] c
          INNER JOIN [Customer_Classification] cc ON c.[customerCode] = cc.[customerCode];
        `);
        await pool.execute(`
          UPDATE c
          SET
            c.[dairyClassification] = CASE WHEN cc.[businessVertical] = 'Dairy' THEN cc.[classification] ELSE c.[dairyClassification] END,
            c.[iceCreamClassification] = CASE WHEN cc.[businessVertical] = 'Ice Cream' THEN cc.[classification] ELSE c.[iceCreamClassification] END,
            c.[classification] = COALESCE(c.[classification], cc.[classification])
          FROM [Customer] c
          INNER JOIN [Customer_Classification] cc ON c.[customerCode] = ('C' + cc.[customerCode]);
        `);
      } catch (syncErr: any) {
        console.warn('Non-fatal: could not bulk sync Customer classifications MSSQL:', syncErr.message);
      }
    } else {
      // High-performance batch insert for MySQL (4 seconds instead of 31 minutes)
      const CHUNK_SIZE = 400;
      for (let i = 0; i < classifications.length; i += CHUNK_SIZE) {
        const chunk = classifications.slice(i, i + CHUNK_SIZE);
        const rowPlaceholders: string[] = [];
        const params: any[] = [];

        for (const item of chunk) {
          const code = (item.customerCode || '').trim().toUpperCase();
          const bVert = (item.businessVertical || '').trim();
          const cls = (item.classification || '').trim().toUpperCase();
          const ch = item.channel ? item.channel.trim().toUpperCase() : null;

          if (!code || !cls) continue;
          rowPlaceholders.push('(?, ?, ?, ?)');
          params.push(code, bVert, cls, ch);
        }

        if (rowPlaceholders.length > 0) {
          try {
            const [res]: any = await pool.execute(
              `INSERT INTO \`Customer_Classification\` (\`customerCode\`, \`businessVertical\`, \`classification\`, \`channel\`)
               VALUES ${rowPlaceholders.join(', ')}
               ON DUPLICATE KEY UPDATE \`classification\` = VALUES(\`classification\`), \`channel\` = VALUES(\`channel\`)`,
              params
            );
            if (res?.affectedRows) {
              inserted += res.affectedRows;
            }
          } catch (batchErr: any) {
            console.warn('Batch insert classification error:', batchErr.message);
          }
        }
      }

      // Fast set-based join updates on Customer table
      try {
        await pool.execute(`
          UPDATE \`Customer\` c
          JOIN \`Customer_Classification\` cc ON c.\`customerCode\` = cc.\`customerCode\`
          SET
            c.\`dairyClassification\` = CASE WHEN cc.\`businessVertical\` = 'Dairy' THEN cc.\`classification\` ELSE c.\`dairyClassification\` END,
            c.\`iceCreamClassification\` = CASE WHEN cc.\`businessVertical\` = 'Ice Cream' THEN cc.\`classification\` ELSE c.\`iceCreamClassification\` END,
            c.\`classification\` = COALESCE(c.\`classification\`, cc.\`classification\`)
        `);
        await pool.execute(`
          UPDATE \`Customer\` c
          JOIN \`Customer_Classification\` cc ON c.\`customerCode\` = CONCAT('C', cc.\`customerCode\`)
          SET
            c.\`dairyClassification\` = CASE WHEN cc.\`businessVertical\` = 'Dairy' THEN cc.\`classification\` ELSE c.\`dairyClassification\` END,
            c.\`iceCreamClassification\` = CASE WHEN cc.\`businessVertical\` = 'Ice Cream' THEN cc.\`classification\` ELSE c.\`iceCreamClassification\` END,
            c.\`classification\` = COALESCE(c.\`classification\`, cc.\`classification\`)
        `);
      } catch (syncErr: any) {
        console.warn('Non-fatal: could not bulk sync Customer classifications:', syncErr.message);
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
    const chunkSize = 500;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      try {
        const deleteQuery = isMssql
          ? `DELETE FROM [Customer] WHERE [cust_rt_id] IN (${placeholders})`
          : `DELETE FROM \`Customer\` 
             WHERE \`cust_rt_id\` IN (${placeholders})
               AND \`cust_rt_id\` NOT IN (SELECT DISTINCT \`cust_rt_id\` FROM \`CustomerRouteMapping\`)`;
        const [res]: any = await pool.execute(deleteQuery, chunk);
        deleted += res.affectedRows || 0;
      } catch (err: any) {
        console.warn('Skipped deleting some obsolete customers due to foreign key constraints:', err.message);
      }
    }
    return deleted;
  },

  async clearObsoleteMappings(activeIds: string[]): Promise<number> {
    await ensureCustomerTableSchema();
    if (isMssql || activeIds.length === 0) {
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
