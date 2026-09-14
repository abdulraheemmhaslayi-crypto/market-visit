/**
 * Migration script to populate dairyClassification and iceCreamClassification
 * from the Master_Classification data if they're currently NULL.
 *
 * This should be run if classifications are missing after the schema change.
 * Usage: npx ts-node scripts/migrate-classifications.ts
 */

import fs from 'fs';
import path from 'path';
import pool from '@/lib/db';
import * as xlsx from 'xlsx';

interface ClassificationRow {
  CustomerCode: string;
  Classification: string;
  Channel: string;
  BusinessVertical: string;
}

function cleanString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeBusinessVertical(raw: string): 'dairy' | 'icecream' | '' {
  const clean = cleanString(raw);
  if (clean === 'dairy') return 'dairy';
  if (clean === 'icecream' || clean === 'icecreams') return 'icecream';
  return '';
}

async function migrateClassifications() {
  try {
    console.log('🔍 Checking for Master_Classification file...');

    // Look for the classification file
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    let classificationFile: string | null = null;

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      classificationFile = files.find(f =>
        f.toLowerCase().includes('classification') ||
        f.toLowerCase().includes('master')
      ) || null;
    }

    if (!classificationFile) {
      console.log('⚠️  No classification file found in uploads/');
      console.log('   Please provide the Master_Classification file to continue.');
      return;
    }

    console.log(`✅ Found file: ${classificationFile}`);
    console.log('📂 Reading classification data...');

    const filePath = path.join(uploadsDir, classificationFile);
    const buffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });

    if (!workbook.SheetNames.length) {
      console.error('❌ No sheets found in file');
      return;
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { raw: false });

    if (rawRows.length === 0) {
      console.error('❌ No data rows found in sheet');
      return;
    }

    // Find header columns with fuzzy matching
    const firstRow = rawRows[0] as any;
    const headers = Object.keys(firstRow);

    let customerCodeCol = '';
    let classificationCol = '';
    let businessVerticalCol = '';

    for (const header of headers) {
      const clean = cleanString(header);
      if (clean.includes('customer') && clean.includes('code')) customerCodeCol = header;
      if (clean.includes('class')) classificationCol = header;
      if (clean.includes('vertical') || clean.includes('business')) businessVerticalCol = header;
    }

    if (!customerCodeCol || !classificationCol || !businessVerticalCol) {
      console.error('❌ Could not find required columns:');
      console.error(`   CustomerCode: ${customerCodeCol || 'NOT FOUND'}`);
      console.error(`   Classification: ${classificationCol || 'NOT FOUND'}`);
      console.error(`   BusinessVertical: ${businessVerticalCol || 'NOT FOUND'}`);
      console.log('   Available columns:', headers);
      return;
    }

    console.log(`✅ Found columns:`);
    console.log(`   CustomerCode: ${customerCodeCol}`);
    console.log(`   Classification: ${classificationCol}`);
    console.log(`   BusinessVertical: ${businessVerticalCol}`);

    // Build classification map
    const classificationMap = new Map<string, Map<string, string>>();

    for (const row of rawRows) {
      const customerCodeRaw = String(row[customerCodeCol] || '').trim();
      const classification = String(row[classificationCol] || '').trim();
      const businessVerticalRaw = String(row[businessVerticalCol] || '').trim();
      const businessVertical = normalizeBusinessVertical(businessVerticalRaw);

      if (customerCodeRaw && classification && businessVertical) {
        const clean = customerCodeRaw.toUpperCase();
        const alt = clean.startsWith('C') ? clean.substring(1) : `C${clean}`;
        for (const code of [clean, alt]) {
          if (!classificationMap.has(code)) {
            classificationMap.set(code, new Map());
          }
          classificationMap.get(code)!.set(businessVertical, classification);
        }
      }
    }

    console.log(`\n📊 Loaded ${classificationMap.size} customer variants with classifications`);
    console.log('🔄 Updating database...\n');

    let updatedDairy = 0;
    let updatedIce = 0;

    // Update database using flexible customerCode match
    for (const [customerCode, verticals] of classificationMap) {
      const dairyClass = verticals.get('dairy');
      const iceClass = verticals.get('icecream');

      if (dairyClass) {
        const [result]: any = await pool.execute(
          'UPDATE Customer SET dairyClassification = ? WHERE UPPER(TRIM(customerCode)) = ? OR UPPER(TRIM(customerCode)) = ?',
          [dairyClass, customerCode, customerCode.startsWith('C') ? customerCode.substring(1) : `C${customerCode}`]
        );
        if (result.affectedRows > 0) {
          console.log(`✅ ${customerCode}: Dairy = ${dairyClass}`);
          updatedDairy += result.affectedRows;
        }
      }

      if (iceClass) {
        const [result]: any = await pool.execute(
          'UPDATE Customer SET iceCreamClassification = ? WHERE UPPER(TRIM(customerCode)) = ? OR UPPER(TRIM(customerCode)) = ?',
          [iceClass, customerCode, customerCode.startsWith('C') ? customerCode.substring(1) : `C${customerCode}`]
        );
        if (result.affectedRows > 0) {
          console.log(`✅ ${customerCode}: Ice Cream = ${iceClass}`);
          updatedIce += result.affectedRows;
        }
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Updated ${updatedDairy} Dairy classifications`);
    console.log(`   Updated ${updatedIce} Ice Cream classifications`);

    // Verify specific customer
    console.log('\n🔍 Verification - checking C00240:');
    const [verify]: any = await pool.execute(
      'SELECT customerCode, customerName, dairyClassification, iceCreamClassification FROM Customer WHERE customerCode = ?',
      ['00240']
    );

    if (verify.length > 0) {
      const cust = verify[0];
      console.log(`   Code: ${cust.customerCode}`);
      console.log(`   Name: ${cust.customerName}`);
      console.log(`   Dairy: ${cust.dairyClassification || '(NULL)'}`);
      console.log(`   Ice Cream: ${cust.iceCreamClassification || '(NULL)'}`);
    } else {
      console.log('   ⚠️  Customer C00240 not found in database');
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateClassifications().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
});
