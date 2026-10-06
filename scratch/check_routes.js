const xlsx = require('xlsx');
const path = require('path');
const custMasterFile = path.join(__dirname, '..', 'data', 'CUSTMASTER.xlsx');
const wb = xlsx.readFile(custMasterFile);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

const mtd216 = rows.filter(r => String(r['Route Code'] || '').trim().toUpperCase() === 'MTD216');
console.log('MTD216 in CUSTMASTER:');
mtd216.slice(0, 5).forEach(r => {
  console.log('Route:', r['Route Code'], 'Sup:', r['Supervisor'] || r['SV'], 'Mgr:', r['MANAGER']);
});

// Also check all routes in CUSTMASTER and their supervisors
const routeSups = {};
rows.forEach(r => {
  const rt = String(r['Route Code'] || '').trim().toUpperCase();
  const sup = String(r['Supervisor'] || r['SV'] || '').trim().toUpperCase();
  if (rt && sup) {
    if (!routeSups[rt]) routeSups[rt] = new Set();
    routeSups[rt].add(sup);
  }
});
for (const [rt, supset] of Object.entries(routeSups)) {
  if (rt.startsWith('MT')) {
    console.log(`Route ${rt} => Supervisors: ${Array.from(supset).join(', ')}`);
  }
}
