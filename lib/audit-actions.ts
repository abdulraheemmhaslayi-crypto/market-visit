import fs from 'fs';
import path from 'path';
import pool, { isMssql } from '@/lib/db';

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

  // Supervisor Acknowledgement
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;

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

let auditSchemaChecked = false;

function mapRowToAuditAction(row: any): AuditActionItem {
  if (!row) return row;
  return {
    ...row,
    acknowledged: Boolean(row.acknowledged === 1 || row.acknowledged === true || row.acknowledged === '1'),
    acknowledgedAt: row.acknowledgedAt || undefined,
    acknowledgedBy: row.acknowledgedBy || undefined,
  };
}

async function ensureAuditTable(): Promise<void> {
  if (auditSchemaChecked) return;
  try {
    if (isMssql) {
      await pool.execute(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditActionItem')
        BEGIN
          CREATE TABLE [AuditActionItem] (
            [id] VARCHAR(191) PRIMARY KEY,
            [photoId] VARCHAR(191) NOT NULL,
            [visitId] VARCHAR(191) NOT NULL,
            [outlet] VARCHAR(191) NULL,
            [outletCode] VARCHAR(100) NULL,
            [route] VARCHAR(191) NULL,
            [supervisor] VARCHAR(191) NULL,
            [manager] VARCHAR(191) NULL,
            [channel] VARCHAR(100) NULL,
            [category] VARCHAR(100) NULL,
            [originalPhotoUrl] NVARCHAR(MAX) NULL,
            [gmComment] NVARCHAR(MAX) NOT NULL,
            [gmName] VARCHAR(191) NULL,
            [priority] VARCHAR(50) DEFAULT 'Normal',
            [deadline] VARCHAR(100) NULL,
            [acknowledged] BIT DEFAULT 0,
            [acknowledgedAt] VARCHAR(100) NULL,
            [acknowledgedBy] VARCHAR(191) NULL,
            [actionStatus] VARCHAR(50) DEFAULT 'PENDING',
            [supervisorComment] NVARCHAR(MAX) NULL,
            [proofPhotoUrl] NVARCHAR(MAX) NULL,
            [actionTakenAt] VARCHAR(100) NULL,
            [gmVerifiedAt] VARCHAR(100) NULL,
            [gmResolutionNotes] NVARCHAR(MAX) NULL,
            [createdAt] VARCHAR(100) NOT NULL,
            [updatedAt] VARCHAR(100) NOT NULL
          );
        END
      `);
      try {
        await pool.execute(`
          IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_audit_photoId' AND object_id = OBJECT_ID('AuditActionItem'))
            CREATE INDEX [idx_audit_photoId] ON [AuditActionItem] ([photoId]);
          IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_audit_actionStatus' AND object_id = OBJECT_ID('AuditActionItem'))
            CREATE INDEX [idx_audit_actionStatus] ON [AuditActionItem] ([actionStatus]);
        `);
      } catch {}
    } else {
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
          \`acknowledged\` TINYINT(1) DEFAULT 0,
          \`acknowledgedAt\` VARCHAR(100) NULL,
          \`acknowledgedBy\` VARCHAR(191) NULL,
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

      await pool.execute(`
        ALTER TABLE \`AuditActionItem\`
        MODIFY COLUMN \`proofPhotoUrl\` LONGTEXT NULL,
        MODIFY COLUMN \`originalPhotoUrl\` LONGTEXT NULL
      `).catch(() => {});

      await pool.execute(`
        ALTER TABLE \`AuditActionItem\`
        ADD COLUMN IF NOT EXISTS \`acknowledged\` TINYINT(1) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS \`acknowledgedAt\` VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS \`acknowledgedBy\` VARCHAR(191) NULL
      `).catch(async () => {
        try { await pool.execute('ALTER TABLE `AuditActionItem` ADD COLUMN `acknowledged` TINYINT(1) DEFAULT 0'); } catch {}
        try { await pool.execute('ALTER TABLE `AuditActionItem` ADD COLUMN `acknowledgedAt` VARCHAR(100) NULL'); } catch {}
        try { await pool.execute('ALTER TABLE `AuditActionItem` ADD COLUMN `acknowledgedBy` VARCHAR(191) NULL'); } catch {}
      });
    }
    auditSchemaChecked = true;
  } catch (err: any) {
    console.warn('DB ensure table for audit action item:', err?.message);
  }
}

// Reliable dual-database sync (MSSQL MERGE INTO and MySQL ON DUPLICATE KEY UPDATE)
async function syncToDbSafe(item: AuditActionItem): Promise<void> {
  try {
    await ensureAuditTable();

    const params = [
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
      item.acknowledged ? 1 : 0,
      item.acknowledgedAt || null,
      item.acknowledgedBy || null,
      item.actionStatus || 'PENDING',
      item.supervisorComment || null,
      item.proofPhotoUrl || null,
      item.actionTakenAt || null,
      item.gmVerifiedAt || null,
      item.gmResolutionNotes || null,
      item.createdAt,
      item.updatedAt,
    ];

    if (isMssql) {
      await pool.execute(
        `MERGE INTO \`AuditActionItem\` AS target
         USING (SELECT ? AS id, ? AS photoId, ? AS visitId, ? AS outlet, ? AS outletCode,
                       ? AS route, ? AS supervisor, ? AS manager, ? AS channel, ? AS category,
                       ? AS originalPhotoUrl, ? AS gmComment, ? AS gmName, ? AS priority, ? AS deadline,
                       ? AS acknowledged, ? AS acknowledgedAt, ? AS acknowledgedBy,
                       ? AS actionStatus, ? AS supervisorComment, ? AS proofPhotoUrl, ? AS actionTakenAt,
                       ? AS gmVerifiedAt, ? AS gmResolutionNotes, ? AS createdAt, ? AS updatedAt) AS source
         ON target.id = source.id
         WHEN MATCHED THEN
           UPDATE SET
             target.photoId = source.photoId,
             target.visitId = source.visitId,
             target.outlet = source.outlet,
             target.outletCode = source.outletCode,
             target.route = source.route,
             target.supervisor = source.supervisor,
             target.manager = source.manager,
             target.channel = source.channel,
             target.category = source.category,
             target.originalPhotoUrl = source.originalPhotoUrl,
             target.gmComment = source.gmComment,
             target.gmName = source.gmName,
             target.priority = source.priority,
             target.deadline = source.deadline,
             target.acknowledged = source.acknowledged,
             target.acknowledgedAt = source.acknowledgedAt,
             target.acknowledgedBy = source.acknowledgedBy,
             target.actionStatus = source.actionStatus,
             target.supervisorComment = source.supervisorComment,
             target.proofPhotoUrl = source.proofPhotoUrl,
             target.actionTakenAt = source.actionTakenAt,
             target.gmVerifiedAt = source.gmVerifiedAt,
             target.gmResolutionNotes = source.gmResolutionNotes,
             target.updatedAt = source.updatedAt
         WHEN NOT MATCHED THEN
           INSERT (
             id, photoId, visitId, outlet, outletCode, route, supervisor, manager, channel, category,
             originalPhotoUrl, gmComment, gmName, priority, deadline, acknowledged, acknowledgedAt, acknowledgedBy,
             actionStatus, supervisorComment, proofPhotoUrl, actionTakenAt, gmVerifiedAt, gmResolutionNotes, createdAt, updatedAt
           ) VALUES (
             source.id, source.photoId, source.visitId, source.outlet, source.outletCode,
             source.route, source.supervisor, source.manager, source.channel, source.category,
             source.originalPhotoUrl, source.gmComment, source.gmName, source.priority, source.deadline,
             source.acknowledged, source.acknowledgedAt, source.acknowledgedBy,
             source.actionStatus, source.supervisorComment, source.proofPhotoUrl, source.actionTakenAt,
             source.gmVerifiedAt, source.gmResolutionNotes, source.createdAt, source.updatedAt
           );`,
        params
      );
    } else {
      await pool.execute(
        `INSERT INTO \`AuditActionItem\` (
           \`id\`, \`photoId\`, \`visitId\`, \`outlet\`, \`outletCode\`, \`route\`, \`supervisor\`,
           \`manager\`, \`channel\`, \`category\`, \`originalPhotoUrl\`, \`gmComment\`, \`gmName\`,
           \`priority\`, \`deadline\`, \`acknowledged\`, \`acknowledgedAt\`, \`acknowledgedBy\`,
           \`actionStatus\`, \`supervisorComment\`, \`proofPhotoUrl\`,
           \`actionTakenAt\`, \`gmVerifiedAt\`, \`gmResolutionNotes\`, \`createdAt\`, \`updatedAt\`
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           \`photoId\` = VALUES(\`photoId\`),
           \`visitId\` = VALUES(\`visitId\`),
           \`outlet\` = VALUES(\`outlet\`),
           \`outletCode\` = VALUES(\`outletCode\`),
           \`route\` = VALUES(\`route\`),
           \`supervisor\` = VALUES(\`supervisor\`),
           \`manager\` = VALUES(\`manager\`),
           \`channel\` = VALUES(\`channel\`),
           \`category\` = VALUES(\`category\`),
           \`originalPhotoUrl\` = VALUES(\`originalPhotoUrl\`),
           \`gmComment\` = VALUES(\`gmComment\`),
           \`gmName\` = VALUES(\`gmName\`),
           \`priority\` = VALUES(\`priority\`),
           \`deadline\` = VALUES(\`deadline\`),
           \`acknowledged\` = VALUES(\`acknowledged\`),
           \`acknowledgedAt\` = VALUES(\`acknowledgedAt\`),
           \`acknowledgedBy\` = VALUES(\`acknowledgedBy\`),
           \`actionStatus\` = VALUES(\`actionStatus\`),
           \`supervisorComment\` = VALUES(\`supervisorComment\`),
           \`proofPhotoUrl\` = VALUES(\`proofPhotoUrl\`),
           \`actionTakenAt\` = VALUES(\`actionTakenAt\`),
           \`gmVerifiedAt\` = VALUES(\`gmVerifiedAt\`),
           \`gmResolutionNotes\` = VALUES(\`gmResolutionNotes\`),
           \`updatedAt\` = VALUES(\`updatedAt\`)`,
        params
      );
    }
  } catch (err) {
    console.warn('DB replication for audit action notice:', (err as any)?.message);
  }
}

export const auditActionRepository = {
  async clearAll(): Promise<void> {
    try {
      await ensureAuditTable();
      await pool.execute('DELETE FROM `AuditActionItem`').catch(() => {});
    } catch {}
    writeLocalItems([]);
  },

  async getAll(): Promise<AuditActionItem[]> {
    try {
      await ensureAuditTable();
      const [rows]: any = await pool.execute('SELECT * FROM `AuditActionItem` ORDER BY `createdAt` DESC');
      if (Array.isArray(rows) && rows.length > 0) {
        const mapped = rows.map(mapRowToAuditAction);
        // Keep local cache synced with DB source of truth
        writeLocalItems(mapped);
        return mapped;
      }
    } catch (err) {
      // Fallback to local store
    }
    return readLocalItems();
  },

  async getByPhotoId(photoId: string): Promise<AuditActionItem[]> {
    try {
      await ensureAuditTable();
      const [rows]: any = await pool.execute('SELECT * FROM `AuditActionItem` WHERE `photoId` = ?', [photoId]);
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map(mapRowToAuditAction);
      }
    } catch (err) {}
    const all = readLocalItems();
    return all.filter((i) => i.photoId === photoId);
  },

  async getById(id: string): Promise<AuditActionItem | null> {
    try {
      await ensureAuditTable();
      const [rows]: any = await pool.execute('SELECT * FROM `AuditActionItem` WHERE `id` = ? OR `photoId` = ?', [id, id]);
      if (Array.isArray(rows) && rows.length > 0) {
        return mapRowToAuditAction(rows[0]);
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
    acknowledged?: boolean;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
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
      acknowledged: Boolean(data.acknowledged),
      acknowledgedAt: data.acknowledgedAt,
      acknowledgedBy: data.acknowledgedBy,
      actionStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    const items = readLocalItems();
    items.unshift(newItem);
    writeLocalItems(items);

    // Replicate to database (MSSQL or MySQL)
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
        await ensureAuditTable();
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

    // Replicate to database (MSSQL or MySQL)
    await syncToDbSafe(updated);

    return updated;
  },

  async delete(id: string): Promise<boolean> {
    try {
      await ensureAuditTable();
      await pool.execute('DELETE FROM `AuditActionItem` WHERE `id` = ?', [id]);
    } catch (err) {}
    const items = readLocalItems();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return false;
    writeLocalItems(filtered);
    return true;
  },
};
