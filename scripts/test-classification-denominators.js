const path = require('path');
const fs = require('fs');

async function testClassification() {
  console.log('Testing Dairy Classification Master Outlets & Denominators...');

  // Read data/Customer_Classification.xlsx
  const xlsx = require('xlsx');
  const classFilePath = path.join(process.cwd(), 'data', 'Customer_Classification.xlsx');
  if (!fs.existsSync(classFilePath)) {
    console.error('FAIL: data/Customer_Classification.xlsx not found!');
    process.exit(1);
  }

  const wb = xlsx.readFile(classFilePath);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log('Total rows in data/Customer_Classification.xlsx:', rows.length);

  const dairyRows = rows.filter((r) => {
    const vert = String(r['Business vertical'] || r['Business Vertical'] || 'Dairy').toLowerCase();
    return !vert || vert.includes('dairy') || (!vert.includes('ice') && !vert.includes('food'));
  });
  console.log('Dairy rows count:', dairyRows.length);

  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  dairyRows.forEach((r) => {
    const cls = String(r['Classification'] || r['Class'] || 'E').trim().toUpperCase();
    const norm = ['A', 'B', 'C', 'D'].includes(cls) ? cls : 'E';
    counts[norm]++;
  });

  console.log('Calculated Grade Denominators:');
  console.log('  Class A:', counts.A, '(Expected: 341)');
  console.log('  Class B:', counts.B, '(Expected: 551)');
  console.log('  Class C:', counts.C, '(Expected: 648)');
  console.log('  Class D:', counts.D, '(Expected: 434)');
  console.log('  Class E:', counts.E, '(Expected: 561)');
  console.log('  Total:', Object.values(counts).reduce((a, b) => a + b, 0), '(Expected: 2535)');

  let failed = false;
  if (counts.A !== 341) { console.error('FAIL: Class A != 341'); failed = true; }
  if (counts.B !== 551) { console.error('FAIL: Class B != 551'); failed = true; }
  if (counts.C !== 648) { console.error('FAIL: Class C != 648'); failed = true; }
  if (counts.D !== 434) { console.error('FAIL: Class D != 434'); failed = true; }
  if (counts.E !== 561) { console.error('FAIL: Class E != 561'); failed = true; }

  if (failed) {
    console.error('TEST FAILED!');
    process.exit(1);
  } else {
    console.log('\nALL DENOMINATOR CHECKS PASSED PERFECTLY!');
  }
}

testClassification().catch((err) => {
  console.error(err);
  process.exit(1);
});
