const xlsx = require('xlsx');
const path = require('path');

const wb = xlsx.readFile(path.join(__dirname, '..', 'data', 'CUSTMASTER.xlsx'));
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet);

console.log('Total rows:', data.length);
const asadRows = data.filter(r => {
  const s = String(r['Super Name'] || r['SUPER NAME'] || '').toUpperCase();
  return s.includes('ASAD');
});
console.log('ASAD rows:', asadRows.length);
const routes = new Set();
const managers = new Set();
asadRows.forEach(r => {
  routes.add(r['Route Code'] || r['ROUTE CODE']);
  managers.add(r['Manager Name'] || r['MANAGER NAME']);
});
console.log('ASAD Routes in CUSTMASTER:', Array.from(routes));
console.log('ASAD Managers in CUSTMASTER:', Array.from(managers));
