const xlsx = require('xlsx');
const path = require('path');
const custMasterFile = path.join(__dirname, '..', 'data', 'CUSTMASTER.xlsx');
const wb = xlsx.readFile(custMasterFile);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

const c48 = rows.filter(r => String(r['Customer Code'] || '').trim().toUpperCase() === 'C00048');
console.log('Customer C00048 in CUSTMASTER:', c48.length, 'entries');
c48.forEach(r => {
  console.log('Code:', r['Customer Code'], 'Name:', r['Customer Name'], 'Route:', r['Route Code'], 'Sup:', r['Supervisor'], 'Mgr:', r['MANAGER']);
});
