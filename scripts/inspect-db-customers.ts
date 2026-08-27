import pool from '../lib/db';

async function run() {
  try {
    const [rows]: any = await pool.execute(
      'SELECT customerCode, customerName, classification, dairyClassification, iceCreamClassification FROM Customer LIMIT 20'
    );
    console.log('Sample Customer Rows:', JSON.stringify(rows, null, 2));

    const [c41538]: any = await pool.execute(
      'SELECT customerCode, customerName, classification, dairyClassification, iceCreamClassification FROM Customer WHERE customerCode LIKE "%41538%"'
    );
    console.log('C41538 Row:', JSON.stringify(c41538, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
