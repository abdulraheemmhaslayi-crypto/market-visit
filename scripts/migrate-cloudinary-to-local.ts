import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pool from '../lib/db';
import { saveLocalImage, getUploadsBaseDir, resolveCategorySubfolder, validateImageMagicBytes } from '../lib/storage';

interface MigrationOptions {
  dryRun: boolean;
  limit: number | null;
  resume: boolean;
  targetTable: string | null;
}

interface DiscoveredTarget {
  tableName: string;
  columnName: string;
  primaryKeyColumn: string;
  extraColumns: string[];
}

interface MigrationRecordSummary {
  runId: string;
  startedAt: string;
  completedAt?: string;
  dryRun: boolean;
  totalCandidatesFound: number;
  totalProcessed: number;
  successCount: number;
  skippedCount: number;
  failureCount: number;
  failures: Array<{
    table: string;
    primaryKey: string;
    url: string;
    error: string;
  }>;
  migratedRecords: Array<{
    table: string;
    primaryKey: string;
    oldUrl: string;
    newUrl: string;
    fileSizeBytes: number;
  }>;
}

function parseCommandLineArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: false,
    limit: null,
    resume: false,
    targetTable: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--resume') {
      options.resume = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--table' && args[i + 1]) {
      options.targetTable = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Cloudinary to Local VPS Image Migration Tool
===========================================
Usage:
  npx tsx scripts/migrate-cloudinary-to-local.ts [options]

Options:
  --dry-run       Scan database and show what would be migrated without downloading or updating DB
  --limit <N>     Process only the first N candidate images (recommended: test with --limit 5 first)
  --resume        Skip records previously marked SUCCESS in audit log with existing files on disk
  --table <NAME>  Target a specific table (default: scans all tables dynamically)
  --help, -h      Show this help message
      `);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Ensures the audit and migration backup table exists in MySQL.
 */
async function ensureAuditTableExists(connection: any): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`_image_migration_log\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`migrationRunId\` VARCHAR(100) NOT NULL,
      \`sourceTable\` VARCHAR(100) NOT NULL,
      \`sourceColumn\` VARCHAR(100) NOT NULL,
      \`recordPrimaryKeyColumn\` VARCHAR(100) NOT NULL,
      \`recordPrimaryKeyValue\` VARCHAR(191) NOT NULL,
      \`originalImageValue\` TEXT NOT NULL,
      \`originalPublicIdValue\` VARCHAR(255) NULL,
      \`newLocalImageValue\` TEXT NULL,
      \`newLocalPublicIdValue\` VARCHAR(255) NULL,
      \`migrationStatus\` ENUM('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED') NOT NULL,
      \`errorMessage\` TEXT NULL,
      \`fileSizeBytes\` BIGINT NULL,
      \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX \`idx_run\` (\`migrationRunId\`),
      INDEX \`idx_src_record\` (\`sourceTable\`, \`sourceColumn\`, \`recordPrimaryKeyValue\`),
      INDEX \`idx_status\` (\`migrationStatus\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

/**
 * Dynamically discovers all candidate tables and columns that may store image URLs.
 */
async function discoverImageColumns(connection: any, targetTable: string | null): Promise<DiscoveredTarget[]> {
  const [columns]: any = await connection.query(`
    SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS c
    WHERE c.TABLE_SCHEMA = DATABASE()
      AND c.DATA_TYPE IN ('varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'json')
      AND c.TABLE_NAME NOT LIKE '\\_%'
      ${targetTable ? `AND c.TABLE_NAME = '${targetTable}'` : ''}
    ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
  `);

  // Group by table
  const tableMap = new Map<string, string[]>();
  for (const col of columns) {
    if (!tableMap.has(col.TABLE_NAME)) {
      tableMap.set(col.TABLE_NAME, []);
    }
    tableMap.get(col.TABLE_NAME)!.push(col.COLUMN_NAME);
  }

  const results: DiscoveredTarget[] = [];

  for (const [tbl, colList] of tableMap.entries()) {
    // Get Primary Key for this table
    const [pkResult]: any = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = 'PRIMARY'
      LIMIT 1
    `, [tbl]);

    const primaryKey = pkResult[0]?.COLUMN_NAME || colList[0];

    // Filter columns that likely store URLs/images or scan candidate columns
    for (const colName of colList) {
      const lowerCol = colName.toLowerCase();
      if (
        lowerCol.includes('url') ||
        lowerCol.includes('image') ||
        lowerCol.includes('photo') ||
        lowerCol.includes('pic') ||
        lowerCol.includes('path') ||
        lowerCol === 'cloudinaryurl'
      ) {
        results.push({
          tableName: tbl,
          columnName: colName,
          primaryKeyColumn: primaryKey,
          extraColumns: colList.filter((c) => c !== colName),
        });
      }
    }
  }

  return results;
}

/**
 * Downloads image over HTTP stream with timeout.
 */
async function downloadImageBuffer(url: string, timeoutMs = 15000): Promise<Buffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MarketVisit-ImageMigrator/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  const options = parseCommandLineArgs();
  const runId = `mig_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const startedAt = new Date().toISOString();

  console.log(`\n======================================================`);
  console.log(`🚀 Starting Image Migration (Run ID: ${runId})`);
  console.log(`   Mode: ${options.dryRun ? 'DRY-RUN (Simulated, No Changes)' : 'LIVE MIGRATION'}`);
  console.log(`   Limit: ${options.limit !== null ? options.limit : 'ALL'}`);
  console.log(`   Resume: ${options.resume ? 'YES (Skipping previously migrated)' : 'NO'}`);
  console.log(`   Target Table: ${options.targetTable || 'ALL TABLES'}`);
  console.log(`   Uploads Destination: ${getUploadsBaseDir()}`);
  console.log(`======================================================\n`);

  const connection = await pool.getConnection();

  const summary: MigrationRecordSummary = {
    runId,
    startedAt,
    dryRun: options.dryRun,
    totalCandidatesFound: 0,
    totalProcessed: 0,
    successCount: 0,
    skippedCount: 0,
    failureCount: 0,
    failures: [],
    migratedRecords: [],
  };

  try {
    // 1. Ensure audit log table exists
    if (!options.dryRun) {
      await ensureAuditTableExists(connection);
    }

    // 2. Discover target columns dynamically
    console.log('🔍 Discovering database tables and image columns...');
    const discoveredTargets = await discoverImageColumns(connection, options.targetTable);

    console.log(`Found ${discoveredTargets.length} potential image column(s) across tables:\n` +
      discoveredTargets.map((t) => `   - Table: \`${t.tableName}\` | Column: \`${t.columnName}\` (PK: \`${t.primaryKeyColumn}\`)`).join('\n')
    );

    // 3. Collect all candidate records
    interface CandidateItem {
      tableName: string;
      columnName: string;
      primaryKeyColumn: string;
      primaryKeyValue: string;
      currentValue: string;
      publicIdValue?: string;
      categoryValue?: string;
    }

    const candidateItems: CandidateItem[] = [];

    for (const target of discoveredTargets) {
      const hasPublicId = target.extraColumns.some((c) => c.toLowerCase() === 'publicid' || c.toLowerCase() === 'public_id');
      const hasCategory = target.extraColumns.some((c) => c.toLowerCase() === 'category');

      const selectCols = [
        `\`${target.primaryKeyColumn}\``,
        `\`${target.columnName}\``,
        hasPublicId ? '`publicId`' : 'NULL as publicId',
        hasCategory ? '`category`' : 'NULL as category',
      ].join(', ');

      const [rows]: any = await connection.query(`
        SELECT ${selectCols}
        FROM \`${target.tableName}\`
        WHERE \`${target.columnName}\` IS NOT NULL
          AND \`${target.columnName}\` != ''
          AND (
            \`${target.columnName}\` LIKE '%cloudinary%'
            OR \`${target.columnName}\` LIKE '%res.cloudinary.com%'
            OR \`${target.columnName}\` LIKE 'http://%'
            OR \`${target.columnName}\` LIKE 'https://%'
          )
      `);

      for (const row of rows) {
        const urlVal = String(row[target.columnName]).trim();
        // Ignore already local /uploads/ paths
        if (urlVal.startsWith('/uploads/')) continue;

        candidateItems.push({
          tableName: target.tableName,
          columnName: target.columnName,
          primaryKeyColumn: target.primaryKeyColumn,
          primaryKeyValue: String(row[target.primaryKeyColumn]),
          currentValue: urlVal,
          publicIdValue: row.publicId ? String(row.publicId) : undefined,
          categoryValue: row.category ? String(row.category) : undefined,
        });
      }
    }

    summary.totalCandidatesFound = candidateItems.length;
    console.log(`\n📋 Found ${candidateItems.length} candidate image record(s) to process.`);

    const itemsToProcess = options.limit !== null ? candidateItems.slice(0, options.limit) : candidateItems;

    console.log(`⚡ Processing batch of ${itemsToProcess.length} record(s)...\n`);

    // 4. Process each item with Strict 4-Step Verification
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const indexNum = i + 1;
      const totalNum = itemsToProcess.length;
      summary.totalProcessed++;

      console.log(`[${indexNum}/${totalNum}] Table: \`${item.tableName}\` | PK: ${item.primaryKeyValue}`);
      console.log(`   Source URL: ${item.currentValue}`);

      // Check Resume condition
      if (options.resume && !options.dryRun) {
        const [prevSuccess]: any = await connection.query(`
          SELECT newLocalImageValue FROM \`_image_migration_log\`
          WHERE sourceTable = ? AND sourceColumn = ? AND recordPrimaryKeyValue = ? AND migrationStatus = 'SUCCESS'
          ORDER BY id DESC LIMIT 1
        `, [item.tableName, item.columnName, item.primaryKeyValue]);

        if (prevSuccess.length > 0) {
          const localPath = prevSuccess[0].newLocalImageValue;
          const fullDiskPath = path.join(getUploadsBaseDir(), localPath.replace(/^\/uploads\//, ''));
          if (fs.existsSync(fullDiskPath) && fs.statSync(fullDiskPath).size > 0) {
            console.log(`   ⏭️ Skipped: Already migrated to ${localPath} and file exists on disk.`);
            summary.skippedCount++;
            continue;
          }
        }
      }

      if (options.dryRun) {
        console.log(`   🔎 [DRY-RUN] Would download from Cloudinary and save to local uploads.`);
        summary.successCount++;
        summary.migratedRecords.push({
          table: item.tableName,
          primaryKey: item.primaryKeyValue,
          oldUrl: item.currentValue,
          newUrl: `/uploads/${resolveCategorySubfolder(item.categoryValue)}/simulated_${item.primaryKeyValue}.jpg`,
          fileSizeBytes: 0,
        });
        continue;
      }

      // Step 1: Download Image Buffer
      let imageBuffer: Buffer;
      try {
        imageBuffer = await downloadImageBuffer(item.currentValue);
      } catch (dlErr: any) {
        const errMsg = `Download failed: ${dlErr.message}`;
        console.error(`   ❌ ${errMsg}`);
        summary.failureCount++;
        summary.failures.push({
          table: item.tableName,
          primaryKey: item.primaryKeyValue,
          url: item.currentValue,
          error: errMsg,
        });

        await connection.query(`
          INSERT INTO \`_image_migration_log\`
          (migrationRunId, sourceTable, sourceColumn, recordPrimaryKeyColumn, recordPrimaryKeyValue, originalImageValue, originalPublicIdValue, migrationStatus, errorMessage)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'FAILED', ?)
        `, [runId, item.tableName, item.columnName, item.primaryKeyColumn, item.primaryKeyValue, item.currentValue, item.publicIdValue || null, errMsg]);

        // STRICT RULE: Do NOT touch source database record
        continue;
      }

      // Step 2 & 3 & 4: Validate Magic Bytes, Write Locally, Verify File Exists
      let savedResult;
      try {
        const category = item.categoryValue || 'visit-photos';
        savedResult = await saveLocalImage(imageBuffer, category);
      } catch (saveErr: any) {
        const errMsg = `Storage verification failed: ${saveErr.message}`;
        console.error(`   ❌ ${errMsg}`);
        summary.failureCount++;
        summary.failures.push({
          table: item.tableName,
          primaryKey: item.primaryKeyValue,
          url: item.currentValue,
          error: errMsg,
        });

        await connection.query(`
          INSERT INTO \`_image_migration_log\`
          (migrationRunId, sourceTable, sourceColumn, recordPrimaryKeyColumn, recordPrimaryKeyValue, originalImageValue, originalPublicIdValue, migrationStatus, errorMessage)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'FAILED', ?)
        `, [runId, item.tableName, item.columnName, item.primaryKeyColumn, item.primaryKeyValue, item.currentValue, item.publicIdValue || null, errMsg]);

        // STRICT RULE: Do NOT touch source database record
        continue;
      }

      // 5. UPDATE Database Record ONLY after verified write
      try {
        const hasPublicId = item.publicIdValue !== undefined;
        if (hasPublicId && item.tableName.toLowerCase() === 'visitphoto') {
          await connection.query(`
            UPDATE \`${item.tableName}\`
            SET \`${item.columnName}\` = ?, \`publicId\` = ?
            WHERE \`${item.primaryKeyColumn}\` = ?
          `, [savedResult.url, savedResult.public_id, item.primaryKeyValue]);
        } else {
          await connection.query(`
            UPDATE \`${item.tableName}\`
            SET \`${item.columnName}\` = ?
            WHERE \`${item.primaryKeyColumn}\` = ?
          `, [savedResult.url, item.primaryKeyValue]);
        }

        // Record SUCCESS in Audit Table
        await connection.query(`
          INSERT INTO \`_image_migration_log\`
          (migrationRunId, sourceTable, sourceColumn, recordPrimaryKeyColumn, recordPrimaryKeyValue, originalImageValue, originalPublicIdValue, newLocalImageValue, newLocalPublicIdValue, migrationStatus, fileSizeBytes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?)
        `, [
          runId,
          item.tableName,
          item.columnName,
          item.primaryKeyColumn,
          item.primaryKeyValue,
          item.currentValue,
          item.publicIdValue || null,
          savedResult.url,
          savedResult.public_id,
          savedResult.size,
        ]);

        console.log(`   ✅ Saved to: ${savedResult.url} (${(savedResult.size / 1024).toFixed(1)} KB) -> DB Updated`);
        summary.successCount++;
        summary.migratedRecords.push({
          table: item.tableName,
          primaryKey: item.primaryKeyValue,
          oldUrl: item.currentValue,
          newUrl: savedResult.url,
          fileSizeBytes: savedResult.size,
        });
      } catch (dbErr: any) {
        const errMsg = `Database update error: ${dbErr.message}`;
        console.error(`   ❌ ${errMsg}`);
        summary.failureCount++;
        summary.failures.push({
          table: item.tableName,
          primaryKey: item.primaryKeyValue,
          url: item.currentValue,
          error: errMsg,
        });
      }
    }

    summary.completedAt = new Date().toISOString();

    // 6. Write detailed reports
    const reportFilename = `migration-report-${runId}.json`;
    const failureFilename = `migration-failures-${runId}.json`;

    fs.writeFileSync(reportFilename, JSON.stringify(summary, null, 2));
    if (summary.failures.length > 0) {
      fs.writeFileSync(failureFilename, JSON.stringify(summary.failures, null, 2));
    }

    console.log(`\n======================================================`);
    console.log(`🏁 MIGRATION RUN COMPLETE (${runId})`);
    console.log(`   Total Candidates: ${summary.totalCandidatesFound}`);
    console.log(`   Processed:        ${summary.totalProcessed}`);
    console.log(`   ✅ Successful:    ${summary.successCount}`);
    console.log(`   ⏭️ Skipped:       ${summary.skippedCount}`);
    console.log(`   ❌ Failed:        ${summary.failureCount}`);
    console.log(`   Detailed Report:  ${reportFilename}`);
    if (summary.failures.length > 0) {
      console.log(`   Failure Log:      ${failureFilename}`);
    }
    console.log(`======================================================\n`);

  } catch (err: any) {
    console.error('Fatal Migration Error:', err);
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
