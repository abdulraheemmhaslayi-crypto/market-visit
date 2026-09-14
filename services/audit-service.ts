import { AuditLog } from '@/types';
import pool from '@/lib/db';

function mapRowToAuditLog(row: any): AuditLog {
  return {
    logId: row.logId,
    user: row.user,
    action: row.action,
    entity: row.entity,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export const auditService = {
  async logAction(user: string, action: string, entity: string): Promise<void> {
    const newLog: AuditLog = {
      logId: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      user,
      action,
      entity,
      createdAt: new Date().toISOString(),
    };

    await pool.execute(
      'INSERT INTO `AuditLog` (`logId`, `user`, `action`, `entity`, `createdAt`) VALUES (?, ?, ?, ?, ?)',
      [newLog.logId, newLog.user, newLog.action, newLog.entity, new Date(newLog.createdAt)]
    );
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const [rows]: any = await pool.execute('SELECT * FROM `AuditLog` ORDER BY `createdAt` DESC');
    return rows.map(mapRowToAuditLog);
  }
};

export type AuditService = typeof auditService;
