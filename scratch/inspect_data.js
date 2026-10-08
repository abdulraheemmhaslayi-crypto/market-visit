const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const custMasterFile = path.join(__dirname, '..', 'data', 'CUSTMASTER.xlsx');
console.log('Exists:', fs.existsSync(custMasterFile));

const wb = xlsx.readFile(custMasterFile);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);
console.log('Total rows in CUSTMASTER:', rows.length);

// Find all unique supervisors, managers, and routes
const sups = new Set();
const mgrs = new Set();
const routes = new Set();
const supRoutes = {};
const supMgrs = {};
const routeDetails = {};

rows.forEach(r => {
  const sup = String(r['Supervisor'] || r['SV'] || '').trim().toUpperCase();
  const mgr = String(r['MANAGER'] || r['NEW MANAGER'] || '').trim().toUpperCase();
  const rt = String(r['Route Code'] || '').trim().toUpperCase();
  if (sup) sups.add(sup);
  if (mgr) mgrs.add(mgr);
  if (rt) {
    routes.add(rt);
    if (!routeDetails[rt]) {
      routeDetails[rt] = { rt, sup, mgr, count: 0 };
    }
    routeDetails[rt].count++;
  }
  if (sup && rt) {
    if (!supRoutes[sup]) supRoutes[sup] = new Set();
    supRoutes[sup].add(rt);
  }
  if (sup && mgr) {
    if (!supMgrs[sup]) supMgrs[sup] = new Set();
    supMgrs[sup].add(mgr);
  }
});

console.log('\nSupervisors in CUSTMASTER:');
Array.from(sups).sort().forEach(s => {
  const rts = Array.from(supRoutes[s] || []).sort();
  const ms = Array.from(supMgrs[s] || []).sort();
  console.log(`Supervisor: ${s} | Manager: ${ms.join(', ')} | Routes (${rts.length}): ${rts.join(', ')}`);
});

console.log('\nSpecifically checking SAIF and SAIFULLAH:');
['SAIF', 'SAIFULLAH'].forEach(s => {
  const rts = Array.from(supRoutes[s] || []).sort();
  const ms = Array.from(supMgrs[s] || []).sort();
  console.log(`Supervisor: ${s} | Manager: ${ms.join(', ')} | Routes (${rts.length}): ${rts.join(', ')}`);
});

// Also check ASAD:
console.log('\nSpecifically checking ASAD:');
['ASAD'].forEach(s => {
  const rts = Array.from(supRoutes[s] || []).sort();
  const ms = Array.from(supMgrs[s] || []).sort();
  console.log(`Supervisor: ${s} | Manager: ${ms.join(', ')} | Routes (${rts.length}): ${rts.join(', ')}`);
});
