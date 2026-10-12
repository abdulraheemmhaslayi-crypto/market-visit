const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const custMasterFile = path.join(__dirname, '..', 'data', 'CUSTMASTER.xlsx');
const wb = xlsx.readFile(custMasterFile);
const sheet = wb.Sheets[wb.SheetNames[0]];
const cmRows = xlsx.utils.sheet_to_json(sheet);
const cmRoutes = new Set(cmRows.map(r => String(r['Route Code'] || '').trim().toUpperCase()).filter(Boolean));

const custJsonPath = path.join(__dirname, '..', 'data', 'customers.json');
let jsonRoutes = new Set();
if (fs.existsSync(custJsonPath)) {
  const jsonList = JSON.parse(fs.readFileSync(custJsonPath, 'utf8'));
  jsonRoutes = new Set(jsonList.map(c => String(c.routeCode || '').trim().toUpperCase()).filter(Boolean));
}

console.log('Routes in CUSTMASTER:', cmRoutes.size);
console.log('Routes in customers.json:', jsonRoutes.size);

// Check if any route in customers.json is NOT in CUSTMASTER
const extraInJson = Array.from(jsonRoutes).filter(r => !cmRoutes.has(r));
console.log('Routes in customers.json but NOT in CUSTMASTER:', extraInJson);

// Check supervisor of extra routes in customers.json
if (fs.existsSync(custJsonPath)) {
  const jsonList = JSON.parse(fs.readFileSync(custJsonPath, 'utf8'));
  extraInJson.forEach(er => {
    const samples = jsonList.filter(c => c.routeCode === er).slice(0, 3);
    console.log(`Route ${er}:`, samples.map(s => ({ code: s.customerCode, name: s.customerName })));
  });
}
