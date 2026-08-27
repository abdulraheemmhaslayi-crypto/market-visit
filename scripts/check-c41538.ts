import pool from '../lib/db';

async function run() {
  try {
    const [rows]: any = await pool.execute(
      'SELECT cust_rt_id, customerCode, customerName, classification, dairyClassification, iceCreamClassification FROM Customer WHERE customerCode = ?',
      ['C41538']
    );
    console.log('Customer C41538 in DB:', rows);

    const [count]: any = await pool.execute(
      'SELECT COUNT(*) as total, SUM(CASE WHEN dairyClassification IS NOT NULL THEN 1 ELSE 0 END) as dairyCount, SUM(CASE WHEN iceCreamClassification IS NOT NULL THEN 1 ELSE 0 END) as iceCount FROM Customer'
    );
    console.log('Customer counts in DB:', count);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
