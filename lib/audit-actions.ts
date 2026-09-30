import fs from 'fs';
import path from 'path';
import pool from '@/lib/db';

export interface AuditActionItem {
  id: string;
  photoId: string;
  visitId: string;
  outlet: string;
  outletCode?: string;
  route: string;
  supervisor: string;
  manager?: string;
  channel?: string;
  category: string;
  originalPhotoUrl: string;

  // GM Feedback
  gmComment: string;
  gmName: string;
  priority: 'Normal' | 'Urgent';
  deadline?: string;
  createdAt: string;

  // Supervisor Action & Proof
  actionStatus: 'PENDING' | 'SUBMITTED' | 'RESOLVED';
  supervisorComment?: string;
  proofPhotoUrl?: string;
  actionTakenAt?: string;

  // Review & Closure
  gmVerifiedAt?: string;
  gmResolutionNotes?: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'audit-action-items.json');

// Ensure data folder and file exists
function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readLocalItems(): AuditActionItem[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading audit-action-items.json:', err);
    return [];
  }
}

function writeLocalItems(items: AuditActionItem[]): void {
  ensureFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing audit-action-items.json:', err);
  }
}

// Optional safe database sync (fails silently if DB offline)
async function syncToDbSafe(item: AuditActionItem): Promise<void> {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`AuditActionItem\` (
        \`id\` VARCHAR(191) PRIMARY KEY,
        \`photoId\` VARCHAR(191) NOT NULL,
        \`visitId\` VARCHAR(191) NOT NULL,
        \`outlet\` VARCHAR(191) NULL,
        \`outletCode\` VARCHAR(100) NULL,
        \`route\` VARCHAR(191) NULL,
        \`supervisor\` VARCHAR(191) NULL,
        \`manager\` VARCHAR(191) NULL,
        \`channel\` VARCHAR(100) NULL,
        \`category\` VARCHAR(100) NULL,
        \`originalPhotoUrl\` LONGTEXT NULL,
        \`gmComment\` TEXT NOT NULL,
        \`gmName\` VARCHAR(191) NULL,
        \`priority\` VARCHAR(50) DEFAULT 'Normal',
        \`deadline\` VARCHAR(100) NULL,
        \`actionStatus\` VARCHAR(50) DEFAULT 'PENDING',
        \`supervisorComment\` TEXT NULL,
        \`proofPhotoUrl\` LONGTEXT NULL,
        \`actionTakenAt\` VARCHAR(100) NULL,
        \`gmVerifiedAt\` VARCHAR(100) NULL,
        \`gmResolutionNotes\` TEXT NULL,
        \`createdAt\` VARCHAR(100) NOT NULL,
        \`updatedAt\` VARCHAR(100) NOT NULL,
        INDEX \`idx_photoId\` (\`photoId\`),
        INDEX \`idx_actionStatus\` (\`actionStatus\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure columns support large image payloads if table already existed as TEXT
    await pool.execute(`
      ALTER TABLE \`AuditActionItem\`
      MODIFY COLUMN \`proofPhotoUrl\` LONGTEXT NULL,
      MODIFY COLUMN \`originalPhotoUrl\` LONGTEXT NULL
    `).catch(() => {});

    await pool.execute(
      `REPLACE INTO \`AuditActionItem\`
       (id, photoId, visitId, outlet, outletCode, route, supervisor, manager, channel, category, originalPhotoUrl, gmComment, gmName, priority, deadline, actionStatus, supervisorComment, proofPhotoUrl, actionTakenAt, gmVerifiedAt, gmResolutionNotes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.photoId,
        item.visitId,
        item.outlet || '',
        item.outletCode || '',
        item.route || '',
        item.supervisor || '',
        item.manager || '',
        item.channel || 'GT',
        item.category || '',
        item.originalPhotoUrl || '',
        item.gmComment || '',
        item.gmName || 'General Manager',
        item.priority || 'Normal',
        item.deadline || null,
        item.actionStatus || 'PENDING',
        item.supervisorComment || null,
        item.proofPhotoUrl || null,
        item.actionTakenAt || null,
        item.gmVerifiedAt || null,
        item.gmResolutionNotes || null,
        item.createdAt,
        item.updatedAt,
      ]
    );
  } catch (err) {
    console.warn('DB replication for audit action notice:', (err as any)?.message);
  }
}

export const auditActionRepository = {
  async getAll(): Promise<AuditActionItem[]> {
    try {
      const [rows]: any = await pool.execute('SELECT * FROM `AuditActionItem` ORDER BY `createdAt` DESC');
      if (Array.isArray(rows) && rows.length > 0) {
        return rows as AuditActionItem[];
      }
    } catch (err) {
      // Fallback to local store
    }
    return readLocalItems();
  },

  async getByPhotoId(photoId: string): Promise<AuditActionItem[]> {
    try {
      const [rows]: any = await pool.execute('SELECT * FROM `AuditActionItem` WHERE `photoId` = ?', [photoId]);
      if (Array.isArray(rows) && rows.length > 0) {
        return rows as AuditActionItem[];
      }
    } catch (err) {}
    const all = readLocalItems();
    return all.filter((i) => i.photoId === photoId);
  },

  async getById(id: string): Promise<AuditActionItem | null> {
    try {
      const [rows]: any = await pool.execute('SELECT * FROM `AuditActionItem` WHERE `id` = ? OR `photoId` = ?', [id, id]);
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0] as AuditActionItem;
      }
    } catch (err) {}
    const all = readLocalItems();
    return all.find((i) => i.id === id || i.photoId === id) || null;
  },

  async create(data: {
    photoId: string;
    visitId: string;
    outlet: string;
    outletCode?: string;
    route: string;
    supervisor: string;
    manager?: string;
    channel?: string;
    category: string;
    originalPhotoUrl: string;
    gmComment: string;
    gmName?: string;
    priority?: 'Normal' | 'Urgent';
    deadline?: string;
  }): Promise<AuditActionItem> {
    const now = new Date().toISOString();
    const newItem: AuditActionItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      photoId: data.photoId,
      visitId: data.visitId,
      outlet: data.outlet,
      outletCode: data.outletCode || '',
      route: data.route,
      supervisor: data.supervisor,
      manager: data.manager,
      channel: data.channel || 'GT',
      category: data.category,
      originalPhotoUrl: data.originalPhotoUrl,
      gmComment: data.gmComment,
      gmName: data.gmName || 'General Manager',
      priority: data.priority || 'Normal',
      deadline: data.deadline,
      actionStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    const items = readLocalItems();
    items.unshift(newItem);
    writeLocalItems(items);

    // Replicate to MySQL
    await syncToDbSafe(newItem);

    return newItem;
  },

  async update(id: string, updates: Partial<AuditActionItem>, fallbackPhotoId?: string): Promise<AuditActionItem | null> {
    const items = readLocalItems();
    let idx = items.findIndex((i) => i.id === id || (fallbackPhotoId && i.photoId === fallbackPhotoId) || i.photoId === id);

    let baseItem: AuditActionItem;
    if (idx !== -1) {
      baseItem = items[idx];
    } else {
      // Check database
      let dbItem: AuditActionItem | null = null;
      try {
        const [rows]: any = await pool.execute('SELECT * FROM `AuditActionItem` WHERE `id` = ? OR `photoId` = ?', [id, fallbackPhotoId || id]);
        if (Array.isArray(rows) && rows.length > 0) {
          dbItem = rows[0] as AuditActionItem;
        }
      } catch (err) {}

      if (dbItem) {
        baseItem = dbItem;
      } else {
        // Synthesize fallback item if updating an unrecorded item
        baseItem = {
          id: id.startsWith('act_') ? id : `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          photoId: fallbackPhotoId || id,
          visitId: 'VISIT-REF',
          outlet: 'Store Attachment',
          outletCode: '',
          route: 'N/A',
          supervisor: 'Field Supervisor',
          category: 'Audit Photo',
          originalPhotoUrl: '',
          gmComment: 'Corrective action directive',
          gmName: 'General Manager',
          priority: 'Normal',
          actionStatus: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const updated: AuditActionItem = {
      ...baseItem,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (idx !== -1) {
      items[idx] = updated;
    } else {
      items.unshift(updated);
    }
    writeLocalItems(items);

    // Replicate to MySQL
    await syncToDbSafe(updated);

    return updated;
  },

  async delete(id: string): Promise<boolean> {
    try {
      await pool.execute('DELETE FROM `AuditActionItem` WHERE `id` = ?', [id]);
    } catch (err) {}
    const items = readLocalItems();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return false;
    writeLocalItems(filtered);
    return true;
  },
};
