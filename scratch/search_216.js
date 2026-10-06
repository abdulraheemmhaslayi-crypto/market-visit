const xlsx = require('xlsx');
const path = require('path');
const custMasterFile = path.join(__dirname, '..', 'data', 'CUSTMASTER.xlsx');
const wb = xlsx.readFile(custMasterFile);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

const found = rows.filter(r => JSON.stringify(r).includes('216'));
console.log('Matches for 216 in CUSTMASTER:', found.length);
found.forEach(r => {
  console.log('Row:', r['Route Code'], r['Customer Code'], r['Customer Name'], r['Supervisor'], r['MANAGER']);
});
