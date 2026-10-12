import { Route } from '@/types';
import pool from '@/lib/db';

function mapRowToRoute(row: any): Route {
  return {
    routeCode: row.routeCode,
    routeName: row.routeName,
    channel: row.channel,
    supervisorId: row.supervisorId,
    managerId: row.managerId,
    superName: row.superName,
  };
}

let routeSchemaChecked = false;
let routeSchemaPromise: Promise<void> | null = null;

async function ensureRouteTableSchema(): Promise<void> {
  if (routeSchemaChecked) return;
  if (routeSchemaPromise) return routeSchemaPromise;

  routeSchemaChecked = true;
  routeSchemaPromise = (async () => {
    try {
      await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`Manager\` (
        \`id\` VARCHAR(191) PRIMARY KEY,
        \`name\` VARCHAR(191) UNIQUE NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`Route\` (
        \`routeCode\` VARCHAR(191) PRIMARY KEY,
        \`routeName\` VARCHAR(191) NOT NULL,
        \`channel\` VARCHAR(191) NOT NULL DEFAULT 'GT',
        \`supervisorId\` VARCHAR(191) NULL,
        \`managerId\` VARCHAR(191) NULL,
        \`superName\` VARCHAR(191) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [columnsResult]: any = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Route'"
    );
    const existingColumns = new Set((columnsResult as any[]).map((row: any) => row.COLUMN_NAME));

    const migrations: string[] = [];
    if (!existingColumns.has('channel')) {
      migrations.push("ALTER TABLE `Route` ADD COLUMN `channel` VARCHAR(191) NOT NULL DEFAULT 'GT'");
    }
    if (!existingColumns.has('supervisorId')) {
      migrations.push("ALTER TABLE `Route` ADD COLUMN `supervisorId` VARCHAR(191) NULL");
    }
    if (!existingColumns.has('managerId')) {
      migrations.push("ALTER TABLE `Route` ADD COLUMN `managerId` VARCHAR(191) NULL");
    }
    if (!existingColumns.has('superName')) {
      migrations.push("ALTER TABLE `Route` ADD COLUMN `superName` VARCHAR(191) NULL");
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

  } catch (err) {
    console.error('Failed to ensure Route table schema:', err);
  } finally {
    routeSchemaChecked = true;
    routeSchemaPromise = null;
  }
  })();

  return routeSchemaPromise;
}

export const routeRepository = {
  async getAllRoutes(): Promise<Route[]> {
    await ensureRouteTableSchema();
    const { getCustMasterData } = await import('@/lib/custmaster-data');
    const custMaster = getCustMasterData();

    let dbRoutes: Route[] = [];
    try {
      const [rows]: any = await pool.execute('SELECT * FROM `Route`');
      dbRoutes = rows.map(mapRowToRoute);
    } catch (e) {}

    const routeMap = new Map<string, Route>();
    // First, populate from DB
    dbRoutes.forEach((r) => {
      routeMap.set(r.routeCode.toUpperCase().trim(), r);
    });

    // CUSTMASTER is the source of truth for all valid routes
    (custMaster.routes || []).forEach((r) => {
      const cleanCode = r.routeCode.toUpperCase().trim();
      const existing = routeMap.get(cleanCode);
      const channel = cleanCode.startsWith('MT') ? 'MT' : (cleanCode.startsWith('IS') ? 'INST' : 'TT');
      if (existing) {
        existing.superName = r.superName || existing.superName;
        existing.managerName = r.managerName || existing.managerName;
        existing.channel = channel;
      } else {
        routeMap.set(cleanCode, {
          routeCode: r.routeCode,
          routeName: r.routeName || `Route ${r.routeCode}`,
          channel,
          superName: r.superName,
          managerName: r.managerName,
        });
      }
    });

    return Array.from(routeMap.values());
  },

  async getRoutesBySupervisor(supervisorId: string, supervisorName?: string): Promise<Route[]> {
    await ensureRouteTableSchema();
    const { getCustMasterData } = await import('@/lib/custmaster-data');
    const custMaster = getCustMasterData();

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

    // 2. If CUSTMASTER has routes for this supervisor, return them directly
    if (sName) {
      const supRoutes = custMaster.supervisorRoutesMap[sName] || [];
      if (supRoutes.length > 0) {
        return supRoutes.map((rtCode: string) => {
          const cleanCode = rtCode.toUpperCase().trim();
          const rObj = (custMaster.routes || []).find((r) => r.routeCode.toUpperCase().trim() === cleanCode);
          const channel = cleanCode.startsWith('MT') ? 'MT' : (cleanCode.startsWith('IS') ? 'INST' : 'TT');
          return {
            routeCode: cleanCode,
            routeName: rObj?.routeName || `Route ${cleanCode}`,
            channel,
            superName: sName,
            managerName: rObj?.managerName || custMaster.routeManagerMap[cleanCode] || '',
          };
        });
      }
    }

    // Fallback to database Route table
    let sql = 'SELECT * FROM `Route` WHERE `supervisorId` = ?';
    const params: any[] = [supervisorId];

    if (sName) {
      const normalizedName = sName.toLowerCase().replace(/\s+/g, '');
      sql += ' OR (LOWER(REPLACE(IFNULL(`superName`, \'\'), \' \', \'\')) = ?)';
      params.push(normalizedName);
    }
    const [rows]: any = await pool.execute(sql, params);
    let mapped = rows.map(mapRowToRoute);

    if (sName === 'SAIFULLAH' || supervisorId === 'usr_rqwxav8') {
      mapped = mapped.filter((r: Route) => !r.routeCode.startsWith('TR'));
    } else if (sName === 'SAIF' || supervisorId === 'usr_tgb2s6h') {
      mapped = mapped.filter((r: Route) => !r.routeCode.startsWith('MT'));
    }

    return mapped;
  },

  async isRouteAssignedToSupervisor(routeCode: string, supervisorId: string, supervisorName?: string): Promise<boolean> {
    await ensureRouteTableSchema();
    const cleanRoute = (routeCode || '').trim().toUpperCase();

    // 1. Resolve supervisor name reliably
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

    // 2. Check CUSTMASTER first as the single source of truth
    const { getCustMasterData } = await import('@/lib/custmaster-data');
    const custMaster = getCustMasterData();
    const assignedSup = (custMaster.routeSupervisorMap[cleanRoute] || '').trim().toUpperCase();

    if (assignedSup && sName) {
      // Disambiguate SAIFULLAH (Modern Trade) vs SAIF (Traditional Trade)
      if (sName === 'SAIFULLAH' || supervisorId === 'usr_rqwxav8') {
        return assignedSup === 'SAIFULLAH';
      }
      if (sName === 'SAIF' || supervisorId === 'usr_tgb2s6h') {
        return assignedSup === 'SAIF';
      }
      return assignedSup === sName;
    }

    // 3. Check if route exists in DB
    const [routeRows]: any = await pool.execute('SELECT * FROM `Route` WHERE `routeCode` = ? LIMIT 1', [cleanRoute]);
    if (routeRows.length === 0) return true;

    const route = routeRows[0];
    if (!route.supervisorId && !route.superName) return true;

    if (route.supervisorId === supervisorId) return true;

    if (sName && route.superName) {
      const norm1 = sName.toLowerCase().replace(/\s+/g, '');
      const norm2 = route.superName.trim().toLowerCase().replace(/\s+/g, '');
      if (norm1 === norm2) return true;
    }

    try {
      const [uRows]: any = await pool.execute('SELECT employeeCode FROM `User` WHERE `id` = ? LIMIT 1', [supervisorId]);
      if (uRows.length > 0 && route.supervisorId === uRows[0].employeeCode) {
        return true;
      }
    } catch (e) {}

    return false;
  },

  async upsertRoutes(routes: Route[]): Promise<{ inserted: number; updated: number }> {
    await ensureRouteTableSchema();
    let inserted = 0;
    let updated = 0;

    for (const route of routes) {
      const supervisorId = route.supervisorId || null;
      const managerId = route.managerId || null;
      const channel = route.channel || 'GT';
      const superName = route.superName || null;

      const [res]: any = await pool.execute(
        `INSERT INTO \`Route\` (\`routeCode\`, \`routeName\`, \`channel\`, \`supervisorId\`, \`managerId\`, \`superName\`)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           \`routeName\` = VALUES(\`routeName\`),
           \`channel\` = VALUES(\`channel\`),
           \`supervisorId\` = VALUES(\`supervisorId\`),
           \`managerId\` = VALUES(\`managerId\`),
           \`superName\` = VALUES(\`superName\`)`,
        [route.routeCode, route.routeName, channel, supervisorId, managerId, superName]
      );
      if (res.affectedRows === 1) {
        inserted++;
      } else {
        updated++;
      }
    }

    return { inserted, updated };
  },

  async backfillSupervisorByName(supervisorId: string, supervisorName: string): Promise<number> {
    await ensureRouteTableSchema();
    const normalizedName = supervisorName.trim().toLowerCase().replace(/\s+/g, '');
    const [rows]: any = await pool.execute(
      'SELECT `routeCode` FROM `Route` WHERE `supervisorId` IS NULL AND `superName` IS NOT NULL AND LOWER(REPLACE(`superName`, \' \', \'\')) = ?',
      [normalizedName]
    );
    if (rows.length === 0) return 0;

    const routeCodes = rows.map((r: any) => r.routeCode);
    const placeholders = routeCodes.map(() => '?').join(',');
    const [result]: any = await pool.execute(
      `UPDATE \`Route\` SET \`supervisorId\` = ? WHERE \`routeCode\` IN (${placeholders})`,
      [supervisorId, ...routeCodes]
    );
    return result.affectedRows || 0;
  },

  async clearObsoleteRoutes(activeCodes: string[]): Promise<number> {
    await ensureRouteTableSchema();
    if (activeCodes.length === 0) {
      const [result]: any = await pool.execute('DELETE FROM `Route`');
      return result.affectedRows || 0;
    }

    const activeSet = new Set(activeCodes);
    const [dbRows]: any = await pool.execute('SELECT `routeCode` FROM `Route`');
    const dbCodes: string[] = (dbRows as any[]).map((r) => r.routeCode).filter(Boolean);
    const toDelete = dbCodes.filter((code) => !activeSet.has(code));

    if (toDelete.length === 0) return 0;

    let deleted = 0;
    const chunkSize = 500;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const [res]: any = await pool.execute(
        `DELETE FROM \`Route\` WHERE \`routeCode\` IN (${placeholders})`,
        chunk
      );
      deleted += res.affectedRows || 0;
    }
    return deleted;
  },
};
