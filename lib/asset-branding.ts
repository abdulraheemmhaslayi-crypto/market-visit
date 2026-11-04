import fs from 'fs';
import path from 'path';
import pool, { isMssql } from '@/lib/db';

export interface AssetBrandingRequest {
  id: string;
  requestNumber: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  routeCode: string;
  supervisorId: string;
  supervisorName: string;
  visitId?: string;
  visitDate?: string;
  assetType?: string;
  assetModel?: string;
  sizeModel?: string;
  brandingRequired: boolean;
  brandingScope?: string;
  photoUrl?: string;
  classification?: string;
  channel?: string;
  notes?: string;
  status: 'Pending Acknowledgement' | 'Acknowledged' | 'Approved' | 'Rejected';
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  decision?: 'Approved' | 'Rejected';
  decisionBy?: string;
  decisionByName?: string;
  decisionAt?: string;
  adminComment?: string;
  updatedAt: string;
}

export interface CreateBrandingRequestInput {
  outletId?: string;
  outletCode: string;
  outletName: string;
  routeCode: string;
  supervisorId: string;
  supervisorName: string;
  visitId?: string;
  visitDate?: string;
  assetType?: string;
  assetModel?: string;
  sizeModel?: string;
  brandingRequired?: boolean;
  brandingScope?: string;
  photoUrl?: string;
  classification?: string;
  channel?: string;
  notes?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'asset-branding-requests.json');

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readLocalItems(): AssetBrandingRequest[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      return items.map((i) => ({
        ...i,
        assetType: i.assetType || 'Chiller',
        assetModel: i.assetModel || i.sizeModel || 'Single Door',
        sizeModel: i.sizeModel || i.assetModel || 'Single Door',
      }));
    }
    return [];
  } catch (err) {
    console.error('Error reading asset-branding-requests.json:', err);
    return [];
  }
}

function writeLocalItems(items: AssetBrandingRequest[]): void {
  ensureFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing asset-branding-requests.json:', err);
  }
}

function lookupCustomerMeta(code: string): { classification?: string; channel?: string } {
  try {
    const custFile = path.join(DATA_DIR, 'customers.json');
    if (fs.existsSync(custFile)) {
      const custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
      const found = custs.find((c: any) => c.customerCode === code || c.cust_rt_id === code);
      if (found) {
        return {
          classification: found.classification || found.dairyClassification || found.iceCreamClassification || 'C',
          channel: found.channel || 'GT',
        };
      }
    }
  } catch {}
  return { classification: 'C', channel: 'GT' };
}

let brandingTableChecked = false;

async function ensureBrandingTable(): Promise<void> {
  if (brandingTableChecked) return;
  try {
    if (isMssql) {
      await pool.execute(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Asset_Branding_Requests')
        BEGIN
          CREATE TABLE [Asset_Branding_Requests] (
            [id] VARCHAR(191) PRIMARY KEY,
            [requestNumber] VARCHAR(50) NOT NULL,
            [outletId] VARCHAR(191) NULL,
            [outletCode] VARCHAR(100) NOT NULL,
            [outletName] NVARCHAR(255) NOT NULL,
            [routeCode] VARCHAR(100) NOT NULL,
            [supervisorId] VARCHAR(191) NOT NULL,
            [supervisorName] NVARCHAR(255) NOT NULL,
            [visitId] VARCHAR(191) NULL,
            [visitDate] VARCHAR(100) NULL,
            [assetType] VARCHAR(100) NULL,
            [assetModel] VARCHAR(100) NULL,
            [sizeModel] VARCHAR(100) NULL,
            [brandingRequired] BIT DEFAULT 1,
            [brandingScope] NVARCHAR(255) NULL,
            [photoUrl] NVARCHAR(MAX) NULL,
            [classification] VARCHAR(100) NULL,
            [channel] VARCHAR(100) NULL,
            [notes] NVARCHAR(MAX) NULL,
            [status] VARCHAR(50) DEFAULT 'Pending Acknowledgement',
            [createdAt] DATETIME DEFAULT GETDATE(),
            [acknowledgedBy] VARCHAR(191) NULL,
            [acknowledgedByName] NVARCHAR(255) NULL,
            [acknowledgedAt] DATETIME NULL,
            [decision] VARCHAR(50) NULL,
            [decisionBy] VARCHAR(191) NULL,
            [decisionByName] NVARCHAR(255) NULL,
            [decisionAt] DATETIME NULL,
            [adminComment] NVARCHAR(MAX) NULL,
            [updatedAt] DATETIME DEFAULT GETDATE()
          );
          CREATE INDEX [IX_Branding_Outlet] ON [Asset_Branding_Requests]([outletCode]);
          CREATE INDEX [IX_Branding_Status] ON [Asset_Branding_Requests]([status]);
        END
      `);
    } else {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS \`Asset_Branding_Requests\` (
          \`id\` VARCHAR(191) PRIMARY KEY,
          \`requestNumber\` VARCHAR(50) NOT NULL,
          \`outletId\` VARCHAR(191) NULL,
          \`outletCode\` VARCHAR(100) NOT NULL,
          \`outletName\` VARCHAR(255) NOT NULL,
          \`routeCode\` VARCHAR(100) NOT NULL,
          \`supervisorId\` VARCHAR(191) NOT NULL,
          \`supervisorName\` VARCHAR(255) NOT NULL,
          \`visitId\` VARCHAR(191) NULL,
          \`visitDate\` VARCHAR(100) NULL,
          \`assetType\` VARCHAR(100) NULL,
          \`assetModel\` VARCHAR(100) NULL,
          \`sizeModel\` VARCHAR(100) NULL,
          \`brandingRequired\` TINYINT(1) DEFAULT 1,
          \`brandingScope\` VARCHAR(255) NULL,
          \`photoUrl\` LONGTEXT NULL,
          \`classification\` VARCHAR(100) NULL,
          \`channel\` VARCHAR(100) NULL,
          \`notes\` TEXT NULL,
          \`status\` VARCHAR(50) DEFAULT 'Pending Acknowledgement',
          \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`acknowledgedBy\` VARCHAR(191) NULL,
          \`acknowledgedByName\` VARCHAR(255) NULL,
          \`acknowledgedAt\` DATETIME NULL,
          \`decision\` VARCHAR(50) NULL,
          \`decisionBy\` VARCHAR(191) NULL,
          \`decisionByName\` VARCHAR(255) NULL,
          \`decisionAt\` DATETIME NULL,
          \`adminComment\` TEXT NULL,
          \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_branding_outlet\` (\`outletCode\`),
          INDEX \`idx_branding_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Add missing columns if table already existed
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `photoUrl` LONGTEXT NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `classification` VARCHAR(100) NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `channel` VARCHAR(100) NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `assetType` VARCHAR(100) NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `assetModel` VARCHAR(100) NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `sizeModel` VARCHAR(100) NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `notes` TEXT NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `decision` VARCHAR(50) NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `decisionBy` VARCHAR(191) NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `decisionByName` VARCHAR(255) NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `decisionAt` DATETIME NULL');
      } catch {}
      try {
        await pool.execute('ALTER TABLE `Asset_Branding_Requests` ADD COLUMN `adminComment` TEXT NULL');
      } catch {}
      try {
        await pool.execute(
          "UPDATE `Asset_Branding_Requests` SET `assetType` = 'Chiller', `assetModel` = 'Single Door', `sizeModel` = 'Single Door' WHERE `assetModel` IS NULL OR `assetModel` = '' OR `assetModel` = '—'"
        );
      } catch {}
    }
    brandingTableChecked = true;
  } catch (err) {
    console.warn('Failed to ensure Asset_Branding_Requests table, using local file:', err);
  }
}

function mapRowToBrandingRequest(row: any): AssetBrandingRequest {
  if (!row) return row;
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    outletId: row.outletId || '',
    outletCode: row.outletCode,
    outletName: row.outletName,
    routeCode: row.routeCode,
    supervisorId: row.supervisorId,
    supervisorName: row.supervisorName,
    visitId: row.visitId || undefined,
    visitDate: row.visitDate || undefined,
    assetType: row.assetType || 'Chiller',
    assetModel: row.assetModel || row.sizeModel || 'Single Door',
    sizeModel: row.sizeModel || row.assetModel || 'Single Door',
    brandingRequired: Boolean(row.brandingRequired === 1 || row.brandingRequired === true || row.brandingRequired === '1'),
    brandingScope: row.brandingScope || 'Asset Branding Required',
    photoUrl: row.photoUrl || undefined,
    classification: row.classification || undefined,
    channel: row.channel || undefined,
    notes: row.notes || row.brandingScope || undefined,
    status: row.status as any,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt || new Date().toISOString()),
    acknowledgedBy: row.acknowledgedBy || undefined,
    acknowledgedByName: row.acknowledgedByName || undefined,
    acknowledgedAt: row.acknowledgedAt instanceof Date ? row.acknowledgedAt.toISOString() : (row.acknowledgedAt || undefined),
    decision: row.decision || (row.status === 'Approved' ? 'Approved' : row.status === 'Rejected' ? 'Rejected' : undefined),
    decisionBy: row.decisionBy || undefined,
    decisionByName: row.decisionByName || undefined,
    decisionAt: row.decisionAt instanceof Date ? row.decisionAt.toISOString() : (row.decisionAt || undefined),
    adminComment: row.adminComment || undefined,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt || new Date().toISOString()),
  };
}

export const assetBrandingRepository = {
  async getAll(filters?: {
    outletCode?: string;
    routeCode?: string;
    supervisorName?: string;
    status?: string;
    search?: string;
    classification?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<AssetBrandingRequest[]> {
    let items: AssetBrandingRequest[] = [];
    try {
      await ensureBrandingTable();
      const [rows]: any = await pool.execute('SELECT * FROM `Asset_Branding_Requests` ORDER BY `createdAt` DESC');
      if (Array.isArray(rows) && rows.length > 0) {
        items = rows.map(mapRowToBrandingRequest);
      } else {
        items = readLocalItems();
      }
    } catch {
      items = readLocalItems();
    }

    // Auto-enrich any items that might be missing classification or assetModel
    items = items.map((item) => {
      const meta = (!item.classification || !item.channel) ? lookupCustomerMeta(item.outletCode) : null;
      return {
        ...item,
        classification: item.classification || meta?.classification || 'C',
        channel: item.channel || meta?.channel || 'GT',
        assetType: item.assetType || 'Chiller',
        assetModel: item.assetModel || item.sizeModel || 'Single Door',
        sizeModel: item.sizeModel || item.assetModel || 'Single Door',
      };
    });

    if (filters) {
      if (filters.status && filters.status !== 'all') {
        const normStatus = filters.status.trim().toLowerCase();
        items = items.filter((i) => {
          const s = (i.status || '').toLowerCase();
          const d = (i.decision || '').toLowerCase();
          return s.includes(normStatus) || d.includes(normStatus);
        });
      }
      if (filters.outletCode && filters.outletCode !== 'all') {
        items = items.filter((i) => i.outletCode.toLowerCase() === filters.outletCode!.toLowerCase());
      }
      if (filters.routeCode && filters.routeCode !== 'all') {
        items = items.filter((i) => i.routeCode.toLowerCase() === filters.routeCode!.toLowerCase());
      }
      if (filters.supervisorName && filters.supervisorName !== 'all') {
        items = items.filter((i) => i.supervisorName.toLowerCase() === filters.supervisorName!.toLowerCase());
      }
      if (filters.classification && filters.classification !== 'all') {
        const targetCls = filters.classification.trim().toUpperCase();
        items = items.filter((i) => (i.classification || '').trim().toUpperCase() === targetCls);
      }
      if (filters.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        items = items.filter(
          (i) =>
            i.outletName.toLowerCase().includes(q) ||
            i.outletCode.toLowerCase().includes(q) ||
            i.requestNumber.toLowerCase().includes(q) ||
            i.routeCode.toLowerCase().includes(q) ||
            i.supervisorName.toLowerCase().includes(q) ||
            (i.assetType && i.assetType.toLowerCase().includes(q)) ||
            (i.assetModel && i.assetModel.toLowerCase().includes(q)) ||
            (i.sizeModel && i.sizeModel.toLowerCase().includes(q)) ||
            (i.notes && i.notes.toLowerCase().includes(q)) ||
            (i.adminComment && i.adminComment.toLowerCase().includes(q))
        );
      }
      if (filters.fromDate) {
        const from = new Date(filters.fromDate).getTime();
        items = items.filter((i) => new Date(i.createdAt).getTime() >= from);
      }
      if (filters.toDate) {
        const to = new Date(filters.toDate).getTime() + 24 * 60 * 60 * 1000;
        items = items.filter((i) => new Date(i.createdAt).getTime() <= to);
      }
    }

    return items;
  },

  async getPendingForOutlet(outletCode: string): Promise<AssetBrandingRequest | null> {
    const norm = (outletCode || '').trim().toLowerCase();
    if (!norm) return null;

    try {
      await ensureBrandingTable();
      const [rows]: any = await pool.execute(
        "SELECT * FROM `Asset_Branding_Requests` WHERE LOWER(`outletCode`) = ? AND `status` = 'Pending Acknowledgement' ORDER BY `createdAt` DESC LIMIT 1",
        [norm]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return mapRowToBrandingRequest(rows[0]);
      }
    } catch {
      // Fallback to local file
    }

    const local = readLocalItems();
    const found = local.find(
      (i) => i.outletCode.toLowerCase() === norm && i.status === 'Pending Acknowledgement'
    );
    return found || null;
  },

  async getLatestForOutlet(outletCode: string): Promise<AssetBrandingRequest | null> {
    const norm = (outletCode || '').trim().toLowerCase();
    if (!norm) return null;

    try {
      await ensureBrandingTable();
      const [rows]: any = await pool.execute(
        'SELECT * FROM `Asset_Branding_Requests` WHERE LOWER(`outletCode`) = ? ORDER BY `createdAt` DESC LIMIT 1',
        [norm]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return mapRowToBrandingRequest(rows[0]);
      }
    } catch {
      // Fallback to local file
    }

    const local = readLocalItems();
    const matches = local.filter((i) => i.outletCode.toLowerCase() === norm);
    if (matches.length === 0) return null;
    matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return matches[0];
  },

  async getHistoryForOutlet(outletCode: string): Promise<AssetBrandingRequest[]> {
    const norm = (outletCode || '').trim().toLowerCase();
    if (!norm) return [];

    try {
      await ensureBrandingTable();
      const [rows]: any = await pool.execute(
        'SELECT * FROM `Asset_Branding_Requests` WHERE LOWER(`outletCode`) = ? ORDER BY `createdAt` DESC',
        [norm]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map(mapRowToBrandingRequest);
      }
    } catch {
      // Fallback to local file
    }

    const local = readLocalItems();
    const list = local
      .filter((i) => i.outletCode.toLowerCase() === norm)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list.map((i) => ({
      ...i,
      assetType: i.assetType || 'Chiller',
      assetModel: i.assetModel || i.sizeModel || 'Single Door',
      sizeModel: i.sizeModel || i.assetModel || 'Single Door',
    }));
  },

  async getSummaryCounts(filters?: { supervisorName?: string; classification?: string }): Promise<{
    total: number;
    pending: number;
    acknowledged: number;
    approved: number;
    rejected: number;
  }> {
    const all = await this.getAll(filters);
    const pending = all.filter((i) => i.status === 'Pending Acknowledgement').length;
    const acknowledged = all.filter((i) => i.status === 'Acknowledged').length;
    const approved = all.filter((i) => i.status === 'Approved' || i.decision === 'Approved').length;
    const rejected = all.filter((i) => i.status === 'Rejected' || i.decision === 'Rejected').length;
    return {
      total: all.length,
      pending,
      acknowledged,
      approved,
      rejected,
    };
  },

  async create(data: CreateBrandingRequestInput): Promise<{ request: AssetBrandingRequest; isDuplicate: boolean }> {
    const outletCode = (data.outletCode || '').trim();
    if (!outletCode) {
      throw new Error('Outlet code is required');
    }

    // Atomic duplicate prevention check
    const existingPending = await this.getPendingForOutlet(outletCode);
    if (existingPending) {
      return { request: existingPending, isDuplicate: true };
    }

    // Determine next sequential request number (e.g. BR-001, BR-002, ...)
    const all = await this.getAll();
    const nextSeq = all.length + 1;
    const requestNumber = `BR-${String(nextSeq).padStart(3, '0')}`;
    const id = `br_req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();

    const meta = lookupCustomerMeta(outletCode);
    const classification = data.classification || meta.classification || 'C';
    const channel = data.channel || meta.channel || 'GT';
    const notes = (data.notes || data.brandingScope || '').trim() || undefined;
    const assetType = (data.assetType || '').trim() || undefined;
    const assetModel = (data.assetModel || data.sizeModel || '').trim() || undefined;

    const newRequest: AssetBrandingRequest = {
      id,
      requestNumber,
      outletId: data.outletId || outletCode,
      outletCode,
      outletName: data.outletName || outletCode,
      routeCode: data.routeCode || 'N/A',
      supervisorId: data.supervisorId,
      supervisorName: data.supervisorName,
      visitId: data.visitId || undefined,
      visitDate: data.visitDate || nowIso.split('T')[0],
      assetType,
      assetModel,
      sizeModel: assetModel,
      brandingRequired: true,
      brandingScope: notes || 'Asset Branding Required',
      photoUrl: data.photoUrl || undefined,
      classification,
      channel,
      notes,
      status: 'Pending Acknowledgement',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      await ensureBrandingTable();
      await pool.execute(
        `INSERT INTO \`Asset_Branding_Requests\` (
          \`id\`, \`requestNumber\`, \`outletId\`, \`outletCode\`, \`outletName\`, \`routeCode\`,
          \`supervisorId\`, \`supervisorName\`, \`visitId\`, \`visitDate\`, \`assetType\`, \`assetModel\`, \`sizeModel\`, \`brandingRequired\`,
          \`brandingScope\`, \`photoUrl\`, \`classification\`, \`channel\`, \`notes\`, \`status\`, \`createdAt\`, \`updatedAt\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newRequest.id,
          newRequest.requestNumber,
          newRequest.outletId,
          newRequest.outletCode,
          newRequest.outletName,
          newRequest.routeCode,
          newRequest.supervisorId,
          newRequest.supervisorName,
          newRequest.visitId || null,
          newRequest.visitDate || null,
          newRequest.assetType || null,
          newRequest.assetModel || null,
          newRequest.sizeModel || null,
          1,
          newRequest.brandingScope || null,
          newRequest.photoUrl || null,
          newRequest.classification || null,
          newRequest.channel || null,
          newRequest.notes || null,
          newRequest.status,
          new Date(newRequest.createdAt),
          new Date(newRequest.updatedAt),
        ]
      );
    } catch (err) {
      console.warn('Database insert into Asset_Branding_Requests failed, saving locally:', err);
    }

    const local = readLocalItems();
    local.unshift(newRequest);
    writeLocalItems(local);

    return { request: newRequest, isDuplicate: false };
  },

  async acknowledge(
    id: string,
    acknowledgedBy: string,
    acknowledgedByName: string
  ): Promise<AssetBrandingRequest | null> {
    const nowIso = new Date().toISOString();
    let updated: AssetBrandingRequest | null = null;

    try {
      await ensureBrandingTable();
      await pool.execute(
        `UPDATE \`Asset_Branding_Requests\`
         SET \`status\` = 'Acknowledged', \`acknowledgedBy\` = ?, \`acknowledgedByName\` = ?, \`acknowledgedAt\` = ?, \`updatedAt\` = ?
         WHERE \`id\` = ? OR \`requestNumber\` = ?`,
        [acknowledgedBy, acknowledgedByName, new Date(nowIso), new Date(nowIso), id, id]
      );

      const [rows]: any = await pool.execute(
        'SELECT * FROM `Asset_Branding_Requests` WHERE `id` = ? OR `requestNumber` = ? LIMIT 1',
        [id, id]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        updated = mapRowToBrandingRequest(rows[0]);
      }
    } catch (err) {
      console.warn('Database update for Asset_Branding_Requests failed, updating locally:', err);
    }

    const local = readLocalItems();
    const idx = local.findIndex((i) => i.id === id || i.requestNumber === id);
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        status: 'Acknowledged',
        acknowledgedBy,
        acknowledgedByName,
        acknowledgedAt: nowIso,
        updatedAt: nowIso,
      };
      writeLocalItems(local);
      if (!updated) updated = local[idx];
    }

    return updated;
  },

  async recordDecision(
    id: string,
    decision: 'Approved' | 'Rejected',
    adminComment: string,
    decisionBy: string,
    decisionByName: string
  ): Promise<AssetBrandingRequest | null> {
    const nowIso = new Date().toISOString();
    let updated: AssetBrandingRequest | null = null;

    try {
      await ensureBrandingTable();
      await pool.execute(
        `UPDATE \`Asset_Branding_Requests\`
         SET \`status\` = ?, \`decision\` = ?, \`decisionBy\` = ?, \`decisionByName\` = ?, \`decisionAt\` = ?, \`adminComment\` = ?, \`updatedAt\` = ?
         WHERE \`id\` = ? OR \`requestNumber\` = ?`,
        [decision, decision, decisionBy, decisionByName, new Date(nowIso), adminComment || null, new Date(nowIso), id, id]
      );

      const [rows]: any = await pool.execute(
        'SELECT * FROM `Asset_Branding_Requests` WHERE `id` = ? OR `requestNumber` = ? LIMIT 1',
        [id, id]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        updated = mapRowToBrandingRequest(rows[0]);
      }
    } catch (err) {
      console.warn('Database update for Asset_Branding_Requests decision failed, updating locally:', err);
    }

    const local = readLocalItems();
    const idx = local.findIndex((i) => i.id === id || i.requestNumber === id);
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        status: decision,
        decision,
        decisionBy,
        decisionByName,
        decisionAt: nowIso,
        adminComment: adminComment || undefined,
        updatedAt: nowIso,
      };
      writeLocalItems(local);
      if (!updated) updated = local[idx];
    }

    return updated;
  },

  async delete(id: string): Promise<boolean> {
    let deleted = false;
    try {
      await ensureBrandingTable();
      await pool.execute(
        'DELETE FROM `Asset_Branding_Requests` WHERE `id` = ? OR `requestNumber` = ?',
        [id, id]
      );
      deleted = true;
    } catch (err) {
      console.warn('Database delete failed, deleting locally:', err);
    }

    const local = readLocalItems();
    const initialLength = local.length;
    const filtered = local.filter((i) => i.id !== id && i.requestNumber !== id);
    if (filtered.length !== initialLength) {
      writeLocalItems(filtered);
      deleted = true;
    }
    return deleted;
  },
};
