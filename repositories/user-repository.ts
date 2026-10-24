import { User, UserRole, UserStatus } from '@/types';
import pool from '@/lib/db';

export interface CanonicalUser {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
  defaultPassword: string;
  createdAt: string;
}

export const CANONICAL_USERS: CanonicalUser[] = [
  {
    id: 'usr_003xs5n',
    name: 'RIZVI',
    employeeCode: 'SUP011',
    email: 'rizvi@marketvisit.com',
    mobile: '+97466450058',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$0qe02fWNhggwnG6.0UstDO9r3HwEvUTxic00iSjDLYkQXG4SJU3B.',
    defaultPassword: 'rizvi@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_mansoor',
    name: 'Mansoor',
    employeeCode: 'SUP0015',
    email: 'mansoor@dandy.qa',
    mobile: '+97450410091',
    role: 'Fleet',
    status: 'Active',
    passwordHash: '$2b$10$4l7M4eVAanQrz1T.CEvqxOXH/KD9WOU33sPiYxElTt3yCtfOgn5zK',
    defaultPassword: 'mansoor@12345',
    createdAt: '2026-09-15T00:00:00.000Z',
  },
  {
    id: 'usr_juned',
    name: 'juned',
    employeeCode: 'SUP0016',
    email: 'juned@dandy.qa',
    mobile: '+97433603802',
    role: 'Fleet',
    status: 'Active',
    passwordHash: '$2b$10$xYqzt4UZLkKGnn1YKDK3GOaITlXFISG/Y6VqP1bOFyi5t7wdElMja',
    defaultPassword: 'juned@12345',
    createdAt: '2026-09-15T00:00:00.000Z',
  },
  {
    id: 'usr_5ab06hm',
    name: 'YASAR',
    employeeCode: 'SUP009',
    email: 'yasar@marketvisit.com',
    mobile: '+97433195649',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$YIlEkTIMIPtT0BTUr4QHSOudwCF4HQHknB6ciA9BLov.vcDXcP3Aa',
    defaultPassword: 'yasar@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_9rmd7jo',
    name: 'WASIM',
    employeeCode: 'SUP016',
    email: 'wasim@marketvisit.com',
    mobile: '+97433198280',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$GSrkqO/JEIqUYnC0stHloO/uu9a3gdFl0VMC/5aN7Cp/Y/pueAepW',
    defaultPassword: 'wasim@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_a98ufvf',
    name: 'WALI',
    employeeCode: 'SUP007',
    email: 'wali@marketvisit.com',
    mobile: '+97466934767',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$BvKsuHiLyGgRUtE8P3Cc1ela3yWgOgxbCUsG691ILg7KVNlov/Doq',
    defaultPassword: 'wali@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_dw607k6',
    name: 'KISHAN',
    employeeCode: 'SUP005',
    email: 'kishan@marketvisit.com',
    mobile: '+97450396891',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$lsHbyW9foEDLWZAtvu4QI.0x3KeW4fjpfNc9uRC4p7b243TZlbc7G',
    defaultPassword: 'kishan@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_f69dr5u',
    name: 'Admin',
    employeeCode: 'ADMIN001',
    email: 'admin@marketvisit.com',
    mobile: '+97450828097',
    role: 'Admin',
    status: 'Active',
    passwordHash: '$2b$10$6bgi/9PrqvJbVS7ldTNNl.phzYalTdrvW63i7GdOQYf57OnmE7yKq',
    defaultPassword: 'admin@123',
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  {
    id: 'usr_gyye49e',
    name: 'ZEESHAN',
    employeeCode: 'SUP010',
    email: 'zeeshan@marketvisit.com',
    mobile: '+97433536449',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$Bgg1frcMcg9sUa7MxMnReuxqLdjxi9.ZpgOIVAfTNQSWg4JGoV5KK',
    defaultPassword: 'zeeshan@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_p1facpm',
    name: 'DANISH',
    employeeCode: 'Sup002',
    email: 'danish@marketvisit.com',
    mobile: '+97455371973',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$qMEy28AzKazfghnHxmwjyOfBY4fFbNBgkNk7tyurGLyUu3p/cuBqW',
    defaultPassword: 'danish@12345',
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  {
    id: 'usr_pil4rn7',
    name: 'ASAD',
    employeeCode: 'SUP0061',
    email: 'asad@marketvisit.com',
    mobile: '+97433095605',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$v9BgmF5CTPy0o.qoUlduiuHJ0UcxQ4pTDT2H6YBskS.bzRqSjKfuq',
    defaultPassword: 'asad@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_rqupsuk',
    name: 'subadmin',
    employeeCode: 'SUB01',
    email: 'subadmin@marketvisit.com',
    mobile: '+97450828097',
    role: 'Sub-Admin',
    status: 'Active',
    passwordHash: '$2b$10$givZlmOCN7wdKHcM8NCazOX74Q9AMl4.ApQShz3jbDXcFER9BenJW',
    defaultPassword: 'subadmin@12345',
    createdAt: '2026-08-10T00:00:00.000Z',
  },
  {
    id: 'usr_rqwxav8',
    name: 'SAIFULLAH',
    employeeCode: 'SUP014',
    email: 'saifullah@marketvisit.com',
    mobile: '+97433099647',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$CMeY882pIXRxhAa9Lkwtm.Ds6j/ydtaYMLKKACgt.pQ7D1MmK6yFi',
    defaultPassword: 'saifullah@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_sup001',
    name: 'Supervisor User',
    employeeCode: 'SUP001',
    email: 'supervisor@marketvisit.com',
    mobile: '9876543210',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$4P9wk3XtdrqfzfglDOs89uABagteUM0RaQJ9l8nG2Ow3Sow3UjCLy',
    defaultPassword: 'supervisor@123',
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  {
    id: 'usr_tgb2s6h',
    name: 'SAIF',
    employeeCode: 'SUP008',
    email: 'saif@marketvisit.com',
    mobile: '+97433080436',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$MJQBkf.lJqGQiPNNXMxySuvTMwuyMUk7D6RvVktSBI20IygpFn29S',
    defaultPassword: 'saif@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_tokhkzo',
    name: 'MUSAVEER',
    employeeCode: 'SUP006',
    email: 'musaveer@marketvisit.com',
    mobile: '+97450644243',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$Y.w.Wn0ZI82BPf4zDnwJH.t5XHk/bE3qoO2LSQbyQFqQwdsl8e0iq',
    defaultPassword: 'musaveer@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_vepni0r',
    name: 'RASHWIN',
    employeeCode: 'SUP015',
    email: 'rashwin@marketvisit.com',
    mobile: '+97466237411',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$AO7QCDrkYfsVG/HulnpyKeWtZMj7S6hODPLFdRFbdCklvpTmiuz1K',
    defaultPassword: 'rashwin@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_wrbc47b',
    name: 'JAVED',
    employeeCode: 'SUP004',
    email: 'javed@marketvisit.com',
    mobile: '+97433483049',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$9vCcKm8RlrCCI5FnwzuMaeK7aObuIBdm2F7g.O8qnnC8WfxA5R0vC',
    defaultPassword: 'javed@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_x315bhi',
    name: 'JAHID',
    employeeCode: 'SUP003',
    email: 'jahid@marketvisit.com',
    mobile: '+97433195991',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$ou/KBmO7qAuOiejYFzl44uPy1i/Pek1fDnn3HqgA1LfbYrR.QcmGa',
    defaultPassword: 'jahid@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_xojy60l',
    name: 'MOHSIN',
    employeeCode: 'SUP012',
    email: 'mohsin@marketvisit.com',
    mobile: '+97455764631',
    role: 'Supervisor',
    status: 'Active',
    passwordHash: '$2b$10$RCf0mgwRh9K/VVv6FTZyROJu997KBPje8JXYLHEgmcAqQcBEtcD4K',
    defaultPassword: 'mohsin@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
];

let hasEnsuredCanonicalUsers = false;
let ensuringPromise: Promise<void> | null = null;

async function ensureUserRoleColumn() {
  try {
    await pool.execute('ALTER TABLE `User` MODIFY COLUMN `role` VARCHAR(50) NOT NULL');
  } catch (error: any) {
    const message = error?.message || '';
    if (message.includes("doesn't exist") || message.includes('Unknown column')) {
      throw error;
    }
  }
}

export async function ensureCanonicalUsers(): Promise<void> {
  if (hasEnsuredCanonicalUsers) return;
  if (ensuringPromise) return ensuringPromise;

  ensuringPromise = (async () => {
    try {
      await ensureUserRoleColumn().catch(() => {});
      const [existingRows]: any = await pool.execute('SELECT * FROM `User`');
      const existingUsers = Array.isArray(existingRows) ? existingRows : [];

      for (const canonical of CANONICAL_USERS) {
        const match = existingUsers.find((u: any) =>
          (u.email && u.email.toLowerCase() === canonical.email.toLowerCase()) ||
          (u.name && u.name.toUpperCase().trim() === canonical.name.toUpperCase().trim()) ||
          (u.employeeCode && u.employeeCode.toUpperCase().trim() === canonical.employeeCode.toUpperCase().trim())
        );

        if (!match) {
          await pool.execute(
            `INSERT INTO \`User\` (id, name, employeeCode, email, passwordHash, mobile, role, status, createdAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              canonical.id,
              canonical.name,
              canonical.employeeCode,
              canonical.email,
              canonical.passwordHash,
              canonical.mobile,
              canonical.role,
              canonical.status,
              new Date(canonical.createdAt),
            ]
          );
        } else {
          const needsUpdate =
            match.employeeCode !== canonical.employeeCode ||
            match.name !== canonical.name ||
            match.role !== canonical.role ||
            match.status !== canonical.status ||
            (canonical.mobile && match.mobile !== canonical.mobile && match.mobile === '—') ||
            match.email.toLowerCase() !== canonical.email.toLowerCase() ||
            !match.passwordHash;

          if (needsUpdate) {
            await pool.execute(
              `UPDATE \`User\` 
               SET \`name\` = ?, \`employeeCode\` = ?, \`email\` = ?, \`mobile\` = ?, \`role\` = ?, \`status\` = ?, \`passwordHash\` = COALESCE(?, \`passwordHash\`)
               WHERE \`id\` = ?`,
              [
                canonical.name,
                canonical.employeeCode,
                canonical.email,
                canonical.mobile || match.mobile,
                canonical.role,
                canonical.status,
                canonical.passwordHash,
                match.id,
              ]
            );
          }
        }
      }
      hasEnsuredCanonicalUsers = true;
    } catch (err) {
      console.error('Failed to ensure canonical users in database:', err);
    } finally {
      ensuringPromise = null;
    }
  })();

  return ensuringPromise;
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
  ensureCanonicalUsers,

  async getUserByEmail(email: string): Promise<User | null> {
    await ensureCanonicalUsers();
    const [rows]: any = await pool.execute(
      'SELECT * FROM `User` WHERE LOWER(`email`) = LOWER(?) LIMIT 1',
      [email]
    );
    if (rows.length === 0) return null;
    return mapRowToUser(rows[0]);
  },

  async getUserByEmployeeCode(code: string): Promise<User | null> {
    await ensureCanonicalUsers();
    const [rows]: any = await pool.execute(
      'SELECT * FROM `User` WHERE LOWER(`employeeCode`) = LOWER(?) LIMIT 1',
      [code]
    );
    if (rows.length === 0) return null;
    return mapRowToUser(rows[0]);
  },

  async findUserForLogin(identifier: string): Promise<User | null> {
    await ensureCanonicalUsers();
    const raw = (identifier || '').trim();
    if (!raw) return null;
    let lower = raw.toLowerCase();

    // Strip legacy SV- prefix if entered (e.g. SV-RASHWIN -> rashwin)
    if (lower.startsWith('sv-')) {
      lower = lower.substring(3).trim();
    }

    // Auto-correct common domain typos (e.g. saif@marketvist.com -> saif@marketvisit.com)
    let normalized = lower;
    if (normalized.includes('@marketvist.com') || normalized.includes('@maketvisit.com') || normalized.includes('@markitvisit.com')) {
      normalized = normalized.replace(/@(marketvist|maketvisit|markitvisit)\.com/, '@marketvisit.com');
    }
    if (normalized.includes('@marketvisit.qa')) {
      normalized = normalized.replace(/@marketvisit\.qa/, '@marketvisit.com');
    }

    const usernamePrefix = lower.includes('@') ? lower.split('@')[0].trim() : lower;

    const [rows]: any = await pool.execute(
      `SELECT * FROM \`User\` 
       WHERE LOWER(\`email\`) = ? 
          OR LOWER(\`email\`) = ?
          OR LOWER(\`employeeCode\`) = ?
          OR \`employeeCode\` = ?
          OR LOWER(\`name\`) = ?
          OR LOWER(\`email\`) = CONCAT(?, '@marketvisit.com')
          OR (LOWER(\`name\`) = ? AND ? != '')
       ORDER BY (LOWER(\`email\`) = ?) DESC, (LOWER(\`email\`) = ?) DESC
       LIMIT 1`,
      [lower, normalized, lower, raw, lower, usernamePrefix, usernamePrefix, usernamePrefix, lower, normalized]
    );

    if (rows.length > 0) {
      return mapRowToUser(rows[0]);
    }
    return null;
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
    await ensureCanonicalUsers();
    const [rows]: any = await pool.execute('SELECT * FROM `User` ORDER BY `createdAt` ASC, `name` ASC');
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
