import fs from 'fs';
import path from 'path';
import pool from '@/lib/db';

export interface AuditActionItem {
  id: string;
  photoId: string;
  visitId: string;
  outlet: string;
  route: string;
  supervisor: string;
  manager?: string;
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
        \`route\` VARCHAR(191) NULL,
        \`supervisor\` VARCHAR(191) NULL,
        \`category\` VARCHAR(100) NULL,
        \`originalPhotoUrl\` TEXT NULL,
        \`gmComment\` TEXT NOT NULL,
        \`gmName\` VARCHAR(191) NULL,
        \`priority\` VARCHAR(50) DEFAULT 'Normal',
        \`deadline\` VARCHAR(100) NULL,
        \`actionStatus\` VARCHAR(50) DEFAULT 'PENDING',
        \`supervisorComment\` TEXT NULL,
        \`proofPhotoUrl\` TEXT NULL,
        \`actionTakenAt\` VARCHAR(100) NULL,
        \`gmVerifiedAt\` VARCHAR(100) NULL,
        \`gmResolutionNotes\` TEXT NULL,
        \`createdAt\` VARCHAR(100) NOT NULL,
        \`updatedAt\` VARCHAR(100) NOT NULL
      )
    `);

    await pool.execute(
      `REPLACE INTO \`AuditActionItem\`
       (id, photoId, visitId, outlet, route, supervisor, category, originalPhotoUrl, gmComment, gmName, priority, deadline, actionStatus, supervisorComment, proofPhotoUrl, actionTakenAt, gmVerifiedAt, gmResolutionNotes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.photoId,
        item.visitId,
        item.outlet || '',
        item.route || '',
        item.supervisor || '',
        item.category || '',
        item.originalPhotoUrl || '',
        item.gmComment,
        item.gmName,
        item.priority,
        item.deadline || null,
        item.actionStatus,
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
    // Graceful fallback: local JSON store will handle persistence
  }
}

export const auditActionRepository = {
  async getAll(): Promise<AuditActionItem[]> {
    return readLocalItems();
  },

  async getByPhotoId(photoId: string): Promise<AuditActionItem[]> {
    const all = readLocalItems();
    return all.filter((i) => i.photoId === photoId);
  },

  async getById(id: string): Promise<AuditActionItem | null> {
    const all = readLocalItems();
    return all.find((i) => i.id === id) || null;
  },

  async create(data: {
    photoId: string;
    visitId: string;
    outlet: string;
    route: string;
    supervisor: string;
    manager?: string;
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
      route: data.route,
      supervisor: data.supervisor,
      manager: data.manager,
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

    // Async DB replication if reachable
    syncToDbSafe(newItem).catch(() => {});

    return newItem;
  },

  async update(id: string, updates: Partial<AuditActionItem>): Promise<AuditActionItem | null> {
    const items = readLocalItems();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;

    const updated: AuditActionItem = {
      ...items[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    items[idx] = updated;
    writeLocalItems(items);

    // Async DB replication if reachable
    syncToDbSafe(updated).catch(() => {});

    return updated;
  },

  async delete(id: string): Promise<boolean> {
    const items = readLocalItems();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return false;
    writeLocalItems(filtered);
    return true;
  },
};
