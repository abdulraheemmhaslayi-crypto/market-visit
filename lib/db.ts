import sql from 'mssql';
import 'dotenv/config';

declare global {
  // eslint-disable-next-line no-var
  var __mssqlPool: sql.ConnectionPool | undefined;
}

const dbConfig: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
  },
  pool: {
    max: 15,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool: sql.ConnectionPool;

if (process.env.NODE_ENV === 'production') {
  pool = new sql.ConnectionPool(dbConfig);
} else {
  if (!global.__mssqlPool) {
    global.__mssqlPool = new sql.ConnectionPool(dbConfig);
  }
  pool = global.__mssqlPool;
}

// Decorate the pool with an execute method to mimic mysql2's pool.execute
(pool as any).execute = async (query: string, params: any[] = []) => {
  if (!pool.connected) {
    await pool.connect();
  }
  const request = pool.request();
  
  // Replace MySQL backticks with SQL Server brackets
  let mssqlQuery = query.replace(/`([^`]+)`/g, '[$1]');
  
  // Replace positional ? with named parameters @p0, @p1, etc.
  if (params && params.length > 0) {
    let paramIndex = 0;
    mssqlQuery = mssqlQuery.replace(/\?/g, () => {
      const paramName = `p${paramIndex}`;
      request.input(paramName, params[paramIndex]);
      paramIndex++;
      return `@${paramName}`;
    });
  }
  
  try {
    const result = await request.query(mssqlQuery);
    
    // If it's a SELECT query, recordsets will have data
    const isSelect = Array.isArray(result.recordsets) && result.recordsets.length > 0;
    
    if (isSelect) {
      const rows = result.recordset || [];
      return [rows, null];
    } else {
      // For INSERT/UPDATE/DELETE
      const affectedRows = result.rowsAffected ? result.rowsAffected.reduce((a, b) => a + b, 0) : 0;
      return [{ affectedRows }, null];
    }
  } catch (err) {
    console.error('Database execute error:', err, 'Query:', mssqlQuery);
    throw err;
  }
};

(pool as any).getConnection = async () => {
  if (!pool.connected) {
    await pool.connect();
  }
  const transaction = new sql.Transaction(pool);
  let activeRequest: sql.Request | null = null;
  let isTransactionActive = false;

  const conn = {
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
      // No-op for mssql pool wrapper
    },
    execute: async (query: string, params: any[] = []) => {
      const request = activeRequest || pool.request();
      
      let mssqlQuery = query.replace(/`([^`]+)`/g, '[$1]');
      
      if (params && params.length > 0) {
        let paramIndex = 0;
        mssqlQuery = mssqlQuery.replace(/\?/g, () => {
          const paramName = `p${paramIndex}`;
          request.input(paramName, params[paramIndex]);
          paramIndex++;
          return `@${paramName}`;
        });
      }
      
      try {
        const result = await request.query(mssqlQuery);
        const isSelect = Array.isArray(result.recordsets) && result.recordsets.length > 0;
        
        if (isSelect) {
          const rows = result.recordset || [];
          return [rows, null];
        } else {
          const affectedRows = result.rowsAffected ? result.rowsAffected.reduce((a, b) => a + b, 0) : 0;
          return [{ affectedRows }, null];
        }
      } catch (err) {
        console.error('Connection execute error:', err, 'Query:', mssqlQuery);
        throw err;
      }
    }
  };
  return conn;
};

export default pool as any;
