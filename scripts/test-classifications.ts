/**
 * Test script to verify classifications are working correctly.
 * Checks specific outlets (C00240 and others) and displays results.
 *
 * Usage: npx ts-node scripts/test-classifications.ts
 */

import pool from '@/lib/db';

const TEST_CUSTOMERS = [
  { code: '00240', name: 'C00240 (Qmc-Sana)', expectedDairy: 'C', expectedIce: 'B' },
  // Add more test customers as needed
];

async function testClassifications() {
  console.log('🧪 Testing Classification Display Fix\n');
  console.log('=' .repeat(70));

  try {
    for (const test of TEST_CUSTOMERS) {
      console.log(`\n📍 Customer: ${test.name}`);
      console.log('-'.repeat(70));

      const [rows]: any = await pool.execute(
        `SELECT
          cust_rt_id,
          customerCode,
          customerName,
          classification,
          dairyClassification,
          iceCreamClassification,
          channel,
          routeCode
        FROM Customer
        WHERE customerCode = ?`,
        [test.code]
      );

      if (rows.length === 0) {
        console.log(`❌ NOT FOUND in database`);
        continue;
      }

      const customer = rows[0];
      console.log(`   Code: ${customer.customerCode}`);
      console.log(`   Name: ${customer.customerName}`);
      console.log(`   Channel: ${customer.channel || '(not set)'}`);
      console.log(`   Route: ${customer.routeCode || '(not set)'}`);

      // Check Dairy Classification
      const dairyClass = customer.dairyClassification;
      const dairyStatus = dairyClass
        ? dairyClass === '-'
          ? '✅ Not classified'
          : `✅ Class ${dairyClass}`
        : '❌ NULL/EMPTY';

      console.log(`   Dairy: ${dairyStatus}`);

      if (dairyClass && test.expectedDairy && dairyClass !== test.expectedDairy) {
        console.log(
          `      ⚠️  Expected: ${test.expectedDairy}, Got: ${dairyClass}`
        );
      }

      // Check Ice Cream Classification
      const iceClass = customer.iceCreamClassification;
      const iceStatus = iceClass
        ? iceClass === '-'
          ? '✅ Not classified'
          : `✅ Class ${iceClass}`
        : '❌ NULL/EMPTY';

      console.log(`   Ice Cream: ${iceStatus}`);

      if (iceClass && test.expectedIce && iceClass !== test.expectedIce) {
        console.log(
          `      ⚠️  Expected: ${test.expectedIce}, Got: ${iceClass}`
        );
      }

      // UI Display Simulation
      console.log(`\n   📱 UI Display Preview:`);
      const badges = [];

      if (dairyClass === '-') {
        badges.push(`"Not classified · Dairy"`);
      } else if (dairyClass) {
        badges.push(`"Class ${dairyClass} · Dairy"`);
      }

      if (iceClass === '-') {
        badges.push(`"Not classified · Ice Cream"`);
      } else if (iceClass) {
        badges.push(`"Class ${iceClass} · Ice Cream"`);
      }

      if (badges.length > 0) {
        console.log(`      ✅ Badges would show: ${badges.join(' + ')}`);
      } else {
        console.log(`      ❌ No badges shown (both classifications missing)`);
      }
    }

    // Summary
    console.log(`\n` + '='.repeat(70));
    console.log('\n📋 Summary:');
    console.log(
      '   If all tests show ✅ badges, the fix is working correctly.'
    );
    console.log(
      '   If any show ❌, run migration script or re-import classifications.'
    );

    console.log('\n💡 Next Steps:');
    console.log('   1. Go to Supervisor > New Audit');
    console.log('   2. Select a route');
    console.log('   3. Check outlet picker - should show both class badges');
    console.log('   4. Verify C00240 shows Class C (Dairy) + Class B (Ice Cream)');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }

  console.log('\n✨ Test complete!\n');
  process.exit(0);
}

testClassifications();
