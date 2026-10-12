const { getCustMasterData } = require('../lib/custmaster-data');

const data = getCustMasterData();

console.log('--- CUSTMASTER VERIFICATION ---');
console.log('Managers:', data.managers);
console.log('Supervisors under ADNAN:', data.managerSupervisorMap['ADNAN']);
console.log('Supervisors under ASHFAQ:', data.managerSupervisorMap['ASHFAQ']);
console.log('Supervisors under KHALID:', data.managerSupervisorMap['KHALID']);

console.log('\n--- SAIFULLAH vs SAIF ---');
console.log('SAIFULLAH routes:', data.supervisorRoutesMap['SAIFULLAH']);
console.log('SAIF routes:', data.supervisorRoutesMap['SAIF']);

// Check for any overlap between SAIF and SAIFULLAH
const saifullahRoutes = new Set(data.supervisorRoutesMap['SAIFULLAH'] || []);
const saifRoutes = new Set(data.supervisorRoutesMap['SAIF'] || []);
const overlap = Array.from(saifullahRoutes).filter(r => saifRoutes.has(r));
console.log('Overlap between SAIFULLAH and SAIF routes:', overlap);

// Check ASAD
console.log('\n--- ASAD ---');
console.log('ASAD routes:', data.supervisorRoutesMap['ASAD']);
