import { User } from '@/types';
import pool from '@/lib/db';

async function ensureUserRoleColumn() {
  try {
    await pool.execute('ALTER TABLE `User` MODIFY COLUMN `role` VARCHAR(50) NOT NULL');
  } catch (error: any) {
    const message = error?.message || '';
    if (message.includes('doesn\'t exist') || message.includes('Unknown column')) {
      throw error;
    }
  }
}

// Maps raw database rows to the typed User domain model
function mapRowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    employeeCode: row.employeeCode,
    email: row.email,
    passwordHash: row.passwordHash,
    mobile: row.mobile,
    role: row.role as any,
    status: row.status as any,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export const userRepository = {
  async getUserByEmail(email: string): Promise<User | null> {
    const [rows]: any = await pool.execute(
      'SELECT * FROM `User` WHERE LOWER(`email`) = LOWER(?) LIMIT 1',
      [email]
    );
    if (rows.length === 0) return null;
    return mapRowToUser(rows[0]);
  },

  async getUserByEmployeeCode(code: string): Promise<User | null> {
    const [rows]: any = await pool.execute(
      'SELECT * FROM `User` WHERE `employeeCode` = ? LIMIT 1',
      [code]
    );
    if (rows.length === 0) return null;
    return mapRowToUser(rows[0]);
  },

  async getUserById(id: string): Promise<User | null> {
    const [rows]: any = await pool.execute(
      'SELECT * FROM `User` WHERE `id` = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) return null;
    return mapRowToUser(rows[0]);
  },

  async getAllUsers(): Promise<User[]> {
    const [rows]: any = await pool.execute('SELECT * FROM `User`');
    return rows.map(mapRowToUser);
  },

  async createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    await ensureUserRoleColumn();

    const newUser: User = {
      ...user,
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };

    await pool.execute(
      `INSERT INTO \`User\` (id, name, employeeCode, email, passwordHash, mobile, role, status, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUser.id,
        newUser.name,
        newUser.employeeCode,
        newUser.email,
        newUser.passwordHash,
        newUser.mobile,
        newUser.role,
        newUser.status,
        new Date(newUser.createdAt),
      ]
    );
    return newUser;
  },

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    await ensureUserRoleColumn();

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      setClauses.push('`name` = ?');
      values.push(updates.name);
    }
    if (updates.employeeCode !== undefined) {
      setClauses.push('`employeeCode` = ?');
      values.push(updates.employeeCode);
    }
    if (updates.email !== undefined) {
      setClauses.push('`email` = ?');
      values.push(updates.email);
    }
    if (updates.passwordHash !== undefined) {
      setClauses.push('`passwordHash` = ?');
      values.push(updates.passwordHash);
    }
    if (updates.mobile !== undefined) {
      setClauses.push('`mobile` = ?');
      values.push(updates.mobile);
    }
    if (updates.role !== undefined) {
      setClauses.push('`role` = ?');
      values.push(updates.role);
    }
    if (updates.status !== undefined) {
      setClauses.push('`status` = ?');
      values.push(updates.status);
    }

    if (setClauses.length > 0) {
      values.push(id);
      const sql = `UPDATE \`User\` SET ${setClauses.join(', ')} WHERE \`id\` = ?`;
      await pool.execute(sql, values);
    }

    const updatedUser = await this.getUserById(id);
    if (!updatedUser) throw new Error('User not found after update');
    return updatedUser;
  }
};
