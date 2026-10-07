const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 50182,
    user: 'root',
    password: 'QiJokQggRqsLDHctRTUBkMAwQemyQsYV',
    database: 'railway',
  });

  const [visits] = await conn.execute(`
    SELECT v.visitId, v.createdAt, v.cust_rt_id
    FROM Visit v
    WHERE v.supervisorId = 'usr_pil4rn7' AND v.status = 'Submitted'
    ORDER BY v.createdAt DESC
  `);

  const [assets] = await conn.execute(`SELECT * FROM VisitAsset`);

  const assetMap = new Map();
  assets.forEach(a => {
    if (!assetMap.has(a.visitId)) assetMap.set(a.visitId, []);
    assetMap.get(a.visitId).push(a);
  });

  console.log('Total visits for ASAD:', visits.length);
  let noChillerCount = 0;
  visits.forEach(v => {
    const vAssets = assetMap.get(v.visitId) || [];
    const hasChiller = vAssets.some(a => (a.assetType || '').toLowerCase().includes('chiller'));
    if (!hasChiller) {
      noChillerCount++;
      console.log('NO CHILLER VISIT:', v.visitId, v.createdAt, v.cust_rt_id, 'assets:', vAssets.map(a => a.assetType));
    }
  });
  console.log('Total visits without Chiller for ASAD:', noChillerCount);
  await conn.end();
}

run();
