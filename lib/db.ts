import 'dotenv/config';

declare global {
  // eslint-disable-next-line no-var
  var __mssqlPool: any | undefined;
  // eslint-disable-next-line no-var
  var __mysqlPool: any | undefined;
}

// Determine if we should connect using Microsoft SQL Server (Azure SQL) or MySQL
const isMssql =
  process.env.DB_MODE !== 'MYSQL' &&
  (process.env.DB_MODE === 'MSSQL' ||
    Boolean(
      (process.env.DB_SERVER && !process.env.DB_SERVER.includes('rlwy.net')) ||
      (process.env.DB_PORT && (Number(process.env.DB_PORT) === 1433 || Number(process.env.DB_PORT) === 3342))
    ));

function transformQueryForMssql(query: string, params: any[] = []) {
  // 1. Replace MySQL backticks with SQL Server brackets
  let q = query.replace(/`([^`]+)`/g, '[$1]');

  // 2. Replace MySQL NOW() with SQL Server GETDATE()
  q = q.replace(/\bNOW\(\)/gi, 'GETDATE()');

  // 3. Replace MySQL IFNULL with SQL Server ISNULL
  q = q.replace(/\bIFNULL\(/gi, 'ISNULL(');

  // 4. Replace MySQL DATABASE() with SQL Server DB_NAME()
  q = q.replace(/\bDATABASE\(\)/gi, 'DB_NAME()');

  // 5. Replace TABLE_SCHEMA = DB_NAME() with TABLE_CATALOG = DB_NAME()
  q = q.replace(/TABLE_SCHEMA\s*=\s*DB_NAME\(\)/gi, 'TABLE_CATALOG = DB_NAME()');

  // 6. Convert ALTER TABLE [tbl] ADD COLUMN [col] to ALTER TABLE [tbl] ADD [col]
  q = q.replace(/ALTER\s+TABLE\s+\[(\w+)\]\s+ADD\s+COLUMN\s+/gi, 'ALTER TABLE [$1] ADD ');

  // 7. Convert CREATE TABLE IF NOT EXISTS [tbl] (...) ENGINE=... to IF NOT EXISTS ... CREATE TABLE [tbl] (...)
  const createTableMatch = q.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+\[(\w+)\]\s*\(([\s\S]+)\)\s*(?:ENGINE[\s\S]*);?$/i);
  if (createTableMatch) {
    const tblName = createTableMatch[1];
    let body = createTableMatch[2];
    body = body.replace(/AUTO_INCREMENT/gi, 'IDENTITY(1,1)');
    q = `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '${tblName}') CREATE TABLE [${tblName}] (${body});`;
  }

  // 8. Convert trailing LIMIT N to SELECT TOP N
  const limitMatch = q.match(/\s+LIMIT\s+(\d+)\s*$/i);
  if (limitMatch) {
    const limitCount = limitMatch[1];
    q = q.replace(/\s+LIMIT\s+\d+\s*$/i, '');
    if (/^\s*SELECT\s+/i.test(q) && !/^\s*SELECT\s+TOP\s+/i.test(q)) {
      q = q.replace(/^\s*SELECT\s+/i, `SELECT TOP ${limitCount} `);
    }
  }

  // 9. Convert positional ? parameters to named @p0, @p1, ...
  const requestInputs: { name: string; value: any }[] = [];
  if (params && params.length > 0) {
    let paramIndex = 0;
    q = q.replace(/\?/g, () => {
      const paramName = `p${paramIndex}`;
      requestInputs.push({ name: paramName, value: params[paramIndex] });
      paramIndex++;
      return `@${paramName}`;
    });
  }

  return { q, requestInputs };
}

function createMysqlPool() {
  const mysql = require('mysql2/promise');
  const isAzure = Boolean(process.env.WEBSITE_HOSTNAME);
  const isLocalHost = !process.env.DB_HOST || process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';

  // If deployed on Azure App Service without custom host, or if DB_HOST is localhost,
  // automatically route to production Railway cloud database
  const host = (isAzure && isLocalHost) ? 'altaria.proxy.rlwy.net' : (process.env.DB_HOST || process.env.DB_SERVER || 'altaria.proxy.rlwy.net');
  const port = (isAzure && isLocalHost) ? 50182 : (Number(process.env.DB_PORT) || 50182);
  const user = (isAzure && isLocalHost) ? 'root' : (process.env.DB_USER || 'root');
  const password = (isAzure && isLocalHost) ? 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV' : (process.env.DB_PASSWORD || 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV');
  const database = (isAzure && isLocalHost) ? 'railway' : (process.env.DB_NAME || 'railway');

  const mysqlConfig = {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 15,
    maxIdle: 10,
    idleTimeout: 30000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 15000,
  };

  const p = (process.env.NODE_ENV === 'production')
    ? mysql.createPool(mysqlConfig)
    : (global.__mysqlPool || (global.__mysqlPool = mysql.createPool(mysqlConfig)));

  // Prevent uncaught pool socket errors from terminating the Node.js process on Azure
  try {
    p.on?.('error', (err: any) => {
      console.warn('[Azure MySQL Pool Warning]:', err?.message || err);
    });
  } catch {}

  return p;
}

let pool: any;

if (isMssql) {
  // ==========================================
  // MICROSOFT SQL SERVER / AZURE SQL DATABASE
  // ==========================================
  let sql: any = null;
  try {
    sql = eval('require')('mssql');
  } catch {}

  if (sql && sql.ConnectionPool) {
    const serverHost = process.env.DB_SERVER || process.env.DB_HOST || 'localhost';
    const serverPort = Number(process.env.DB_PORT) || 1433;

    const dbConfig = {
      server: serverHost,
      port: serverPort,
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'FieldVisitDB',
      options: {
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: true,
      },
      pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      connectionTimeout: 15000,
    };

    if (process.env.NODE_ENV === 'production') {
      pool = new sql.ConnectionPool(dbConfig);
    } else {
      if (!global.__mssqlPool) {
        global.__mssqlPool = new sql.ConnectionPool(dbConfig);
      }
      pool = global.__mssqlPool;
    }

    pool.execute = async (query: string, params: any[] = []) => {
      if (!pool.connected) {
        await pool.connect();
      }
      const request = pool.request();
      const { q, requestInputs } = transformQueryForMssql(query, params);

      for (const input of requestInputs) {
        request.input(input.name, input.value);
      }

      try {
        const result = await request.query(q);
        const isSelect = Array.isArray(result.recordsets) && result.recordsets.length > 0;
        if (isSelect) {
          return [result.recordset || [], null];
        } else {
          const affectedRows = result.rowsAffected ? result.rowsAffected.reduce((a: number, b: number) => a + b, 0) : 0;
          return [{ affectedRows }, null];
        }
      } catch (err: any) {
        console.error('MSSQL execute error:', err.message, 'Query:', q);
        throw err;
      }
    };

    pool.getConnection = async () => {
      if (!pool.connected) {
        await pool.connect();
      }
      const transaction = new sql.Transaction(pool);
      let activeRequest: any = null;
      let isTransactionActive = false;

      return {
        beginTransaction: async () => {
          await transaction.begin();
          activeRequest = new sql.Request(transaction);
          isTransactionActive = true;
        },
        commit: async () => {
          if (isTransactionActive) {
            await transaction.commit();
            isTransactionActive = false;
            activeRequest = null;
          }
        },
        rollback: async () => {
          if (isTransactionActive) {
            await transaction.rollback();
            isTransactionActive = false;
            activeRequest = null;
          }
        },
        release: () => {
          // No-op for mssql wrapper
        },
        execute: async (query: string, params: any[] = []) => {
          const request = activeRequest || pool.request();
          const { q, requestInputs } = transformQueryForMssql(query, params);

          for (const input of requestInputs) {
            request.input(input.name, input.value);
          }

          try {
            const result = await request.query(q);
            const isSelect = Array.isArray(result.recordsets) && result.recordsets.length > 0;
            if (isSelect) {
              return [result.recordset || [], null];
            } else {
              const affectedRows = result.rowsAffected ? result.rowsAffected.reduce((a: number, b: number) => a + b, 0) : 0;
              return [{ affectedRows }, null];
            }
          } catch (err: any) {
            console.error('MSSQL connection execute error:', err.message, 'Query:', q);
            throw err;
          }
        },
      };
    };
  } else {
    // If MSSQL driver failed to load, fall back cleanly to MySQL
    console.warn('MSSQL driver unavailable, falling back to MySQL connection pool.');
    pool = createMysqlPool();
  }
} else {
  // ==========================================
  // MYSQL (MYSQL2 / RAILWAY / LOCAL)
  // ==========================================
  pool = createMysqlPool();
}

export { isMssql };
export default pool;
