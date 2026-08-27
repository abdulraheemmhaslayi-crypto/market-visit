import pool from '../lib/db';

async function seedClassifications() {
  try {
    const testCases = [
      { code: 'C41538', dairy: 'B', ice: 'C' },
      { code: '41538', dairy: 'B', ice: 'C' },
      { code: 'C00240', dairy: 'C', ice: 'B' },
      { code: '00240', dairy: 'C', ice: 'B' },
      { code: 'C30440', dairy: 'A', ice: 'D' },
      { code: '30440', dairy: 'A', ice: 'D' },
      { code: 'C38450', dairy: 'E', ice: '-' },
      { code: '38450', dairy: 'E', ice: '-' },
    ];

    console.log('Seeding classification test records in database...');

    for (const tc of testCases) {
      await pool.execute(
        `UPDATE Customer 
         SET dairyClassification = ?, iceCreamClassification = ? 
         WHERE UPPER(TRIM(customerCode)) = ? OR UPPER(TRIM(customerCode)) = ?`,
        [tc.dairy, tc.ice, tc.code.toUpperCase(), tc.code.startsWith('C') ? tc.code.substring(1) : `C${tc.code}`]
      );
    }

    console.log('✅ Test classifications seeded successfully!');
  } catch (error: any) {
    console.error('Error seeding classifications:', error);
  } finally {
    process.exit(0);
  }
}

seedClassifications();
