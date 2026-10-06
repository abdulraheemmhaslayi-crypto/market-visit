const { getCustMasterData } = require('../lib/custmaster-data');

const data = getCustMasterData(true);

console.log('=== TEST API ROUTES & DASHBOARD LOGIC ===');
console.log('Total routes in CUSTMASTER:', data.routes.length);
console.log('Total supervisors:', data.supervisors);
console.log('Total managers:', data.managers);

// Test SAIFULLAH routes
const saifullahRoutes = data.routes.filter(r => r.superName === 'SAIFULLAH').map(r => r.routeCode);
console.log('\nSAIFULLAH Routes (count ' + saifullahRoutes.length + '):', saifullahRoutes);

// Test SAIF routes
const saifRoutes = data.routes.filter(r => r.superName === 'SAIF').map(r => r.routeCode);
console.log('\nSAIF Routes (count ' + saifRoutes.length + '):', saifRoutes);

// Verify no TR route in SAIFULLAH and no MT route in SAIF
const saifullahHasTR = saifullahRoutes.some(r => r.startsWith('TR'));
const saifHasMT = saifRoutes.some(r => r.startsWith('MT'));
console.log('Does SAIFULLAH have any TR routes?', saifullahHasTR);
console.log('Does SAIF have any MT routes?', saifHasMT);

// Test ASAD routes
const asadRoutes = data.routes.filter(r => r.superName === 'ASAD').map(r => r.routeCode);
console.log('\nASAD Routes (count ' + asadRoutes.length + '):', asadRoutes);
console.log('Does ASAD have MTD216?', asadRoutes.includes('MTD216'));

// Test Manager mappings
console.log('\nManager of SAIFULLAH:', Object.keys(data.managerSupervisorMap).find(m => data.managerSupervisorMap[m].includes('SAIFULLAH')));
console.log('Manager of SAIF:', Object.keys(data.managerSupervisorMap).find(m => data.managerSupervisorMap[m].includes('SAIF')));
console.log('Manager of ASAD:', Object.keys(data.managerSupervisorMap).find(m => data.managerSupervisorMap[m].includes('ASAD')));
