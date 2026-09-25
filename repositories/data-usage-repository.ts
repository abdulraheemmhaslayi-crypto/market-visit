import pool from '@/lib/db';

export interface UserDailyUsageRecord {
  id?: number;
  userId: string;
  userName: string;
  userRole: string;
  managerId?: string | null;
  date: string; // YYYY-MM-DD
  totalRequests: number;
  bytesDownloaded: number;
  bytesUploaded: number;
  totalBytes: number;
  breakdownJson?: Record<string, { requests: number; bytes: number }> | null;
  deviceInfo?: string | null;
  lastActiveAt?: string;
}

export interface DataUsageSettings {
  id: string;
  dailyPerUserLimitMb: number;
  warningThresholdPercent: number;
  highUsageAlertThresholdMb: number;
  updatedAt?: string;
  updatedBy?: string | null;
}

export interface UsageMetricSummary {
  totalBytesToday: number;
  totalRequestsToday: number;
  bytesDownloadedToday: number;
  bytesUploadedToday: number;
  activeUsersToday: number;
  avgBytesPerUserToday: number;
  highestConsumingUser?: {
    userId: string;
    userName: string;
    userRole: string;
    totalBytes: number;
    totalRequests: number;
  } | null;
  alertCount: number;
}

let schemaInitialized = false;

export async function ensureDataUsageSchema() {
  if (schemaInitialized) return;
  try {
    const connection = await pool.getConnection();
    try {
      // 1. User Daily Data Usage Table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`UserDailyDataUsage\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`userId\` VARCHAR(191) NOT NULL,
          \`userName\` VARCHAR(191) NOT NULL,
          \`userRole\` VARCHAR(50) NOT NULL,
          \`managerId\` VARCHAR(191) NULL,
          \`date\` DATE NOT NULL,
          \`totalRequests\` INT NOT NULL DEFAULT 0,
          \`bytesDownloaded\` BIGINT NOT NULL DEFAULT 0,
          \`bytesUploaded\` BIGINT NOT NULL DEFAULT 0,
          \`totalBytes\` BIGINT NOT NULL DEFAULT 0,
          \`breakdownJson\` JSON NULL,
          \`deviceInfo\` VARCHAR(255) NULL,
          \`lastActiveAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_usage_user\` (\`userId\`),
          INDEX \`idx_usage_date\` (\`date\`),
          INDEX \`idx_usage_manager\` (\`managerId\`),
          UNIQUE KEY \`uk_user_date\` (\`userId\`, \`date\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Data Usage Settings Table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`DataUsageSettings\` (
          \`id\` VARCHAR(50) PRIMARY KEY,
          \`dailyPerUserLimitMb\` INT NOT NULL DEFAULT 50,
          \`warningThresholdPercent\` INT NOT NULL DEFAULT 80,
          \`highUsageAlertThresholdMb\` INT NOT NULL DEFAULT 100,
          \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          \`updatedBy\` VARCHAR(191) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Seed default settings if not exists
      await connection.execute(`
        INSERT IGNORE INTO \`DataUsageSettings\` (\`id\`, \`dailyPerUserLimitMb\`, \`warningThresholdPercent\`, \`highUsageAlertThresholdMb\`)
        VALUES ('global_settings', 50, 80, 100);
      `);

      schemaInitialized = true;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error ensuring DataUsage schema:', err);
  }
}

export const dataUsageRepository = {
  /**
   * Records or increments data usage for a user on a given date.
   */
  async recordUsage(payload: {
    userId: string;
    userName: string;
    userRole: string;
    managerId?: string | null;
    date: string; // YYYY-MM-DD
    requests: number;
    bytesDownloaded: number;
    bytesUploaded: number;
    breakdown?: Record<string, { requests: number; bytes: number }>;
    deviceInfo?: string;
  }): Promise<void> {
    await ensureDataUsageSchema();

    const {
      userId,
      userName,
      userRole,
      managerId = null,
      date,
      requests,
      bytesDownloaded,
      bytesUploaded,
      breakdown = {},
      deviceInfo = null,
    } = payload;

    const totalBytes = bytesDownloaded + bytesUploaded;
    const breakdownStr = JSON.stringify(breakdown);

    await pool.execute(
      `INSERT INTO \`UserDailyDataUsage\` 
        (\`userId\`, \`userName\`, \`userRole\`, \`managerId\`, \`date\`, \`totalRequests\`, \`bytesDownloaded\`, \`bytesUploaded\`, \`totalBytes\`, \`breakdownJson\`, \`deviceInfo\`, \`lastActiveAt\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        \`userName\` = VALUES(\`userName\`),
        \`userRole\` = VALUES(\`userRole\`),
        \`managerId\` = COALESCE(VALUES(\`managerId\`), \`managerId\`),
        \`totalRequests\` = \`totalRequests\` + VALUES(\`totalRequests\`),
        \`bytesDownloaded\` = \`bytesDownloaded\` + VALUES(\`bytesDownloaded\`),
        \`bytesUploaded\` = \`bytesUploaded\` + VALUES(\`bytesUploaded\`),
        \`totalBytes\` = \`totalBytes\` + VALUES(\`totalBytes\`),
        \`breakdownJson\` = JSON_MERGE_PATCH(COALESCE(\`breakdownJson\`, '{}'), VALUES(\`breakdownJson\`)),
        \`deviceInfo\` = COALESCE(VALUES(\`deviceInfo\`), \`deviceInfo\`),
        \`lastActiveAt\` = NOW()`,
      [
        userId,
        userName,
        userRole,
        managerId,
        date,
        requests,
        bytesDownloaded,
        bytesUploaded,
        totalBytes,
        breakdownStr,
        deviceInfo,
      ]
    );
  },

  /**
   * Retrieves current configurable settings.
   */
  async getSettings(): Promise<DataUsageSettings> {
    await ensureDataUsageSchema();
    const [rows]: any = await pool.execute(
      'SELECT * FROM `DataUsageSettings` WHERE `id` = ? LIMIT 1',
      ['global_settings']
    );

    if (rows && rows.length > 0) {
      return {
        id: rows[0].id,
        dailyPerUserLimitMb: Number(rows[0].dailyPerUserLimitMb || 50),
        warningThresholdPercent: Number(rows[0].warningThresholdPercent || 80),
        highUsageAlertThresholdMb: Number(rows[0].highUsageAlertThresholdMb || 100),
        updatedAt: rows[0].updatedAt,
        updatedBy: rows[0].updatedBy,
      };
    }

    return {
      id: 'global_settings',
      dailyPerUserLimitMb: 50,
      warningThresholdPercent: 80,
      highUsageAlertThresholdMb: 100,
    };
  },

  /**
   * Updates configurable settings.
   */
  async updateSettings(settings: Partial<DataUsageSettings>, updatedBy?: string): Promise<DataUsageSettings> {
    await ensureDataUsageSchema();
    const limitMb = settings.dailyPerUserLimitMb ?? 50;
    const warningPercent = settings.warningThresholdPercent ?? 80;
    const alertThresholdMb = settings.highUsageAlertThresholdMb ?? 100;

    await pool.execute(
      `INSERT INTO \`DataUsageSettings\` (\`id\`, \`dailyPerUserLimitMb\`, \`warningThresholdPercent\`, \`highUsageAlertThresholdMb\`, \`updatedBy\`, \`updatedAt\`)
       VALUES ('global_settings', ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        \`dailyPerUserLimitMb\` = VALUES(\`dailyPerUserLimitMb\`),
        \`warningThresholdPercent\` = VALUES(\`warningThresholdPercent\`),
        \`highUsageAlertThresholdMb\` = VALUES(\`highUsageAlertThresholdMb\`),
        \`updatedBy\` = VALUES(\`updatedBy\`),
        \`updatedAt\` = NOW()`,
      [limitMb, warningPercent, alertThresholdMb, updatedBy || null]
    );

    return this.getSettings();
  },

  /**
   * Queries aggregated stats and breakdown for dashboard monitoring.
   */
  async getUsageStats(options: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    managerId?: string;
    scope?: 'full' | 'supervisor' | 'fleet';
    scopeUserId?: string;
  }) {
    await ensureDataUsageSchema();
    const settings = await this.getSettings();

    const todayStr = new Date().toISOString().split('T')[0];
    const startDate = options.startDate || todayStr;
    const endDate = options.endDate || todayStr;

    let queryConditions = ['`date` >= ? AND `date` <= ?'];
    const queryParams: any[] = [startDate, endDate];

    if (options.scope === 'supervisor' && options.scopeUserId) {
      queryConditions.push('(`userId` = ? OR `managerId` = ?)');
      queryParams.push(options.scopeUserId, options.scopeUserId);
    } else if (options.userId) {
      queryConditions.push('`userId` = ?');
      queryParams.push(options.userId);
    } else if (options.managerId) {
      queryConditions.push('`managerId` = ?');
      queryParams.push(options.managerId);
    }

    const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';

    // 1. Fetch raw usage rows in range
    const [rows]: any = await pool.execute(
      `SELECT * FROM \`UserDailyDataUsage\` ${whereClause} ORDER BY \`date\` DESC, \`totalBytes\` DESC`,
      queryParams
    );

    // 2. Fetch today's summary metrics
    let todayConditions = ['`date` = ?'];
    const todayParams: any[] = [todayStr];
    if (options.scope === 'supervisor' && options.scopeUserId) {
      todayConditions.push('(`userId` = ? OR `managerId` = ?)');
      todayParams.push(options.scopeUserId, options.scopeUserId);
    }

    const [todayRows]: any = await pool.execute(
      `SELECT 
        COUNT(DISTINCT \`userId\`) as activeUsers,
        COALESCE(SUM(\`totalBytes\`), 0) as totalBytes,
        COALESCE(SUM(\`bytesDownloaded\`), 0) as bytesDownloaded,
        COALESCE(SUM(\`bytesUploaded\`), 0) as bytesUploaded,
        COALESCE(SUM(\`totalRequests\`), 0) as totalRequests
       FROM \`UserDailyDataUsage\` WHERE ${todayConditions.join(' AND ')}`,
      todayParams
    );

    const todayStats = todayRows[0] || {
      activeUsers: 0,
      totalBytes: 0,
      bytesDownloaded: 0,
      bytesUploaded: 0,
      totalRequests: 0,
    };

    const activeUsersToday = Number(todayStats.activeUsers || 0);
    const totalBytesToday = Number(todayStats.totalBytes || 0);
    const avgBytesPerUserToday = activeUsersToday > 0 ? Math.round(totalBytesToday / activeUsersToday) : 0;

    // 3. User Aggregations in the selected date range
    const userMap = new Map<string, {
      userId: string;
      userName: string;
      userRole: string;
      totalRequests: number;
      bytesDownloaded: number;
      bytesUploaded: number;
      totalBytes: number;
      deviceInfo?: string | null;
      lastActiveAt: string;
      daysActive: number;
      status: 'Normal' | 'Warning' | 'Exceeded';
      percentOfLimit: number;
    }>();

    // 4. Daily Trends Aggregation
    const dailyTrendMap = new Map<string, {
      date: string;
      totalBytes: number;
      bytesDownloaded: number;
      bytesUploaded: number;
      totalRequests: number;
      activeUsers: Set<string>;
    }>();

    // 5. API / Service Breakdown Aggregation
    const apiBreakdownMap = new Map<string, { requests: number; bytes: number }>();

    let alertCount = 0;
    const dailyLimitBytes = settings.dailyPerUserLimitMb * 1024 * 1024;
    const warningLimitBytes = dailyLimitBytes * (settings.warningThresholdPercent / 100);

    for (const row of rows) {
      const uId = row.userId;
      const rowDate = typeof row.date === 'string' ? row.date.split('T')[0] : new Date(row.date).toISOString().split('T')[0];
      const rBytes = Number(row.totalBytes || 0);
      const rDown = Number(row.bytesDownloaded || 0);
      const rUp = Number(row.bytesUploaded || 0);
      const rReqs = Number(row.totalRequests || 0);

      // Check daily alerts for this single day
      if (rBytes >= warningLimitBytes) {
        alertCount++;
      }

      // Aggregate User
      const existingUser = userMap.get(uId);
      if (!existingUser) {
        userMap.set(uId, {
          userId: uId,
          userName: row.userName,
          userRole: row.userRole,
          totalRequests: rReqs,
          bytesDownloaded: rDown,
          bytesUploaded: rUp,
          totalBytes: rBytes,
          deviceInfo: row.deviceInfo,
          lastActiveAt: row.lastActiveAt,
          daysActive: 1,
          status: rBytes >= dailyLimitBytes ? 'Exceeded' : rBytes >= warningLimitBytes ? 'Warning' : 'Normal',
          percentOfLimit: Math.round((rBytes / dailyLimitBytes) * 100),
        });
      } else {
        existingUser.totalRequests += rReqs;
        existingUser.bytesDownloaded += rDown;
        existingUser.bytesUploaded += rUp;
        existingUser.totalBytes += rBytes;
        existingUser.daysActive += 1;
        if (new Date(row.lastActiveAt) > new Date(existingUser.lastActiveAt)) {
          existingUser.lastActiveAt = row.lastActiveAt;
          existingUser.deviceInfo = row.deviceInfo;
        }
        // Highest status in period
        const highestDailyBytes = rBytes;
        if (highestDailyBytes >= dailyLimitBytes) existingUser.status = 'Exceeded';
        else if (highestDailyBytes >= warningLimitBytes && existingUser.status !== 'Exceeded') existingUser.status = 'Warning';
        existingUser.percentOfLimit = Math.max(existingUser.percentOfLimit, Math.round((rBytes / dailyLimitBytes) * 100));
      }

      // Aggregate Daily Trend
      const trend = dailyTrendMap.get(rowDate) || {
        date: rowDate,
        totalBytes: 0,
        bytesDownloaded: 0,
        bytesUploaded: 0,
        totalRequests: 0,
        activeUsers: new Set<string>(),
      };
      trend.totalBytes += rBytes;
      trend.bytesDownloaded += rDown;
      trend.bytesUploaded += rUp;
      trend.totalRequests += rReqs;
      trend.activeUsers.add(uId);
      dailyTrendMap.set(rowDate, trend);

      // Aggregate API Breakdown
      if (row.breakdownJson) {
        try {
          const breakdown = typeof row.breakdownJson === 'string' ? JSON.parse(row.breakdownJson) : row.breakdownJson;
          for (const [endpoint, stats] of Object.entries(breakdown as Record<string, { requests: number; bytes: number }>)) {
            const apiStats = apiBreakdownMap.get(endpoint) || { requests: 0, bytes: 0 };
            apiStats.requests += Number(stats.requests || 0);
            apiStats.bytes += Number(stats.bytes || 0);
            apiBreakdownMap.set(endpoint, apiStats);
          }
        } catch {}
      }
    }

    const userList = Array.from(userMap.values()).sort((a, b) => b.totalBytes - a.totalBytes);
    const highestConsumingUser = userList.length > 0 ? userList[0] : null;

    const dailyTrends = Array.from(dailyTrendMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => ({
        date: t.date,
        totalBytes: t.totalBytes,
        bytesDownloaded: t.bytesDownloaded,
        bytesUploaded: t.bytesUploaded,
        totalRequests: t.totalRequests,
        activeUsersCount: t.activeUsers.size,
      }));

    const apiBreakdown = Array.from(apiBreakdownMap.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        requests: stats.requests,
        bytes: stats.bytes,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    return {
      summary: {
        totalBytesToday,
        totalRequestsToday: Number(todayStats.totalRequests || 0),
        bytesDownloadedToday: Number(todayStats.bytesDownloaded || 0),
        bytesUploadedToday: Number(todayStats.bytesUploaded || 0),
        activeUsersToday,
        avgBytesPerUserToday,
        highestConsumingUser,
        alertCount,
      } as UsageMetricSummary,
      settings,
      users: userList,
      dailyTrends,
      apiBreakdown,
      dateRange: { startDate, endDate },
    };
  },
};
