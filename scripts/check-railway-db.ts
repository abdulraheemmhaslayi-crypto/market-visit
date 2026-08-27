import pool from '../lib/db';

async function checkProductionDb() {
  try {
    console.log('Connecting to Railway DB...');
    const [c41538]: any = await pool.execute(
      'SELECT customerCode, customerName, classification, dairyClassification, iceCreamClassification FROM Customer WHERE customerCode LIKE "%41538%"'
    );
    console.log('Customer C41538 in Railway DB:', c41538);

    const [c00005]: any = await pool.execute(
      'SELECT customerCode, customerName, classification, dairyClassification, iceCreamClassification FROM Customer WHERE customerCode LIKE "%00005%"'
    );
    console.log('Customer C00005 in Railway DB:', c00005);

    const [stats]: any = await pool.execute(
      `SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN dairyClassification IS NOT NULL THEN 1 ELSE 0 END) as dairyNotNull,
        SUM(CASE WHEN iceCreamClassification IS NOT NULL THEN 1 ELSE 0 END) as iceNotNull
       FROM Customer`
    );
    console.log('Overall Customer Classification Stats in Railway DB:', stats);
  } catch (e) {
    console.error('DB Check error:', e);
  } finally {
    process.exit(0);
  }
}

checkProductionDb();
