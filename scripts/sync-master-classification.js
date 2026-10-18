const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

function getVal(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return String(obj[k]).trim();
    }
  }
  const objKeys = Object.keys(obj);
  for (const k of keys) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = objKeys.find((ok) => ok.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
    if (match && obj[match] !== undefined && obj[match] !== null && String(obj[match]).trim() !== '') {
      return String(obj[match]).trim();
    }
  }
  return '';
}

async function main() {
  const classFilePath = path.join(process.cwd(), 'data', 'Customer_Classification.xlsx');
  if (!fs.existsSync(classFilePath)) {
    console.error('Customer_Classification.xlsx not found at:', classFilePath);
    process.exit(1);
  }

  const wb = xlsx.readFile(classFilePath);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`Read ${rows.length} rows from ${classFilePath}`);

  const classMap = new Map();
  rows.forEach((r) => {
    const code = getVal(r, 'Customer Code', 'CustomerCode', 'Code').toUpperCase();
    const name = getVal(r, 'Customer Name', 'CustomerName', 'Name');
    const cls = getVal(r, 'Classification', 'Class', 'Grade').toUpperCase();
    const vert = getVal(r, 'Business vertical', 'Business Vertical', 'Vertical').toLowerCase();
    const ch = getVal(r, 'Channel').toUpperCase();

    if (code && cls) {
      let entry = classMap.get(code);
      if (!entry) {
        entry = { code, name, classification: cls, channel: ch, dairyClassification: undefined, iceCreamClassification: undefined };
        classMap.set(code, entry);
      }
      if (vert.includes('dairy')) {
        entry.dairyClassification = cls;
      }
      if (vert.includes('ice')) {
        entry.iceCreamClassification = cls;
      }
      if (!vert.includes('dairy') && !vert.includes('ice')) {
        entry.dairyClassification = cls;
        entry.iceCreamClassification = cls;
      }
      if (ch) entry.channel = ch;
    }
  });

  console.log(`Parsed ${classMap.size} distinct customer classification entries.`);

  // 1. Sync data/customers.json
  const custJsonPath = path.join(process.cwd(), 'data', 'customers.json');
  if (fs.existsSync(custJsonPath)) {
    const custs = JSON.parse(fs.readFileSync(custJsonPath, 'utf8'));
    let matchedInJson = 0;

    custs.forEach((c) => {
      const code = (c.customerCode || '').toUpperCase().trim();
      const rawNum = code.replace(/^C/i, '');
      const unpadded = rawNum.replace(/^0+/, '');
      const padded5 = rawNum.padStart(5, '0');
      const variants = [code, rawNum, unpadded, `C${rawNum}`, `C${unpadded}`, padded5, `C${padded5}`];

      let match = null;
      for (const v of variants) {
        if (classMap.has(v)) {
          match = classMap.get(v);
          break;
        }
      }

      if (match) {
        matchedInJson++;
        c.classification = match.classification;
        if (match.dairyClassification) c.dairyClassification = match.dairyClassification;
        if (match.iceCreamClassification) c.iceCreamClassification = match.iceCreamClassification;
        if (match.channel && match.channel !== 'GT' && match.channel !== 'GENERAL TRADE') {
          c.channel = match.channel;
        }
      }
    });

    fs.writeFileSync(custJsonPath, JSON.stringify(custs, null, 2), 'utf8');
    console.log(`Updated data/customers.json (${matchedInJson} records updated).`);
  }

  // 2. Sync to MySQL database
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'altaria.proxy.rlwy.net',
      port: Number(process.env.DB_PORT) || 50182,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'railway',
    });

    console.log('Connected to MySQL database. Syncing Customer_Classification table in batches...');
    
    // Prepare items
    const ccItems = [];
    const dairyUpdates = [];
    const iceUpdates = [];

    for (const r of rows) {
      const code = getVal(r, 'Customer Code', 'CustomerCode', 'Code').toUpperCase();
      const cls = getVal(r, 'Classification', 'Class', 'Grade').toUpperCase();
      const vert = getVal(r, 'Business vertical', 'Business Vertical', 'Vertical');
      const ch = getVal(r, 'Channel').toUpperCase();

      if (code && cls) {
        const bVert = vert.toLowerCase().includes('ice') ? 'Ice Cream' : 'Dairy';
        ccItems.push({ code, bVert, cls, ch });
        if (bVert === 'Dairy') {
          dairyUpdates.push({ code, cls, ch });
        } else {
          iceUpdates.push({ code, cls, ch });
        }
      }
    }

    // Chunked batch insert into Customer_Classification
    const CHUNK_SIZE = 150;
    for (let i = 0; i < ccItems.length; i += CHUNK_SIZE) {
      const chunk = ccItems.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
      const values = [];
      chunk.forEach((item) => {
        values.push(item.code, item.bVert, item.cls, item.ch || null);
      });
      await conn.execute(
        `INSERT INTO \`Customer_Classification\` (\`customerCode\`, \`businessVertical\`, \`classification\`, \`channel\`)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE \`classification\` = VALUES(\`classification\`), \`channel\` = VALUES(\`channel\`)`,
        values
      );
    }
    console.log(`Synced ${ccItems.length} records into Customer_Classification.`);

    // Batch update Customer table for Dairy
    for (let i = 0; i < dairyUpdates.length; i += CHUNK_SIZE) {
      const chunk = dairyUpdates.slice(i, i + CHUNK_SIZE);
      const codes = chunk.map((c) => c.code);
      const inClause = codes.map(() => '?').join(', ');
      
      const caseDairy = chunk.map(() => 'WHEN ? THEN ?').join(' ');
      const caseCls = chunk.map(() => 'WHEN ? THEN ?').join(' ');
      const caseCh = chunk.map(() => 'WHEN ? THEN ?').join(' ');

      const params = [];
      chunk.forEach((c) => params.push(c.code, c.cls));
      chunk.forEach((c) => params.push(c.code, c.cls));
      chunk.forEach((c) => params.push(c.code, c.ch));
      params.push(...codes);

      await conn.execute(
        `UPDATE \`Customer\`
         SET \`dairyClassification\` = CASE \`customerCode\` ${caseDairy} ELSE \`dairyClassification\` END,
             \`classification\` = CASE \`customerCode\` ${caseCls} ELSE \`classification\` END,
             \`channel\` = CASE \`customerCode\` ${caseCh} ELSE \`channel\` END
         WHERE \`customerCode\` IN (${inClause})`,
        params
      );
    }
    console.log(`Synced ${dairyUpdates.length} Dairy records into Customer table.`);

    // Batch update Customer table for Ice Cream
    for (let i = 0; i < iceUpdates.length; i += CHUNK_SIZE) {
      const chunk = iceUpdates.slice(i, i + CHUNK_SIZE);
      const codes = chunk.map((c) => c.code);
      const inClause = codes.map(() => '?').join(', ');
      
      const caseIce = chunk.map(() => 'WHEN ? THEN ?').join(' ');
      const caseCh = chunk.map(() => 'WHEN ? THEN ?').join(' ');

      const params = [];
      chunk.forEach((c) => params.push(c.code, c.cls));
      chunk.forEach((c) => params.push(c.code, c.ch));
      params.push(...codes);

      await conn.execute(
        `UPDATE \`Customer\`
         SET \`iceCreamClassification\` = CASE \`customerCode\` ${caseIce} ELSE \`iceCreamClassification\` END,
             \`channel\` = CASE \`customerCode\` ${caseCh} ELSE \`channel\` END
         WHERE \`customerCode\` IN (${inClause})`,
        params
      );
    }
    console.log(`Synced ${iceUpdates.length} Ice Cream records into Customer table.`);

    await conn.end();
  } catch (dbErr) {
    console.warn('MySQL DB sync warning (non-fatal):', dbErr.message);
  }
}

main().catch(console.error);
