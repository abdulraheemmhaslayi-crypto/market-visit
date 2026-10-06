const { getCustMasterData } = require('../lib/custmaster-data');

const data = getCustMasterData();
console.log('supervisorRoutesMap SAIFULLAH:', data.supervisorRoutesMap['SAIFULLAH']);
console.log('supervisorRoutesMap SAIF:', data.supervisorRoutesMap['SAIF']);
console.log('managerSupervisorMap ADNAN:', data.managerSupervisorMap['ADNAN']);
console.log('managerSupervisorMap ASHFAQ:', data.managerSupervisorMap['ASHFAQ']);
console.log('Routes for SAIFULLAH in routes list:', data.routes.filter(r => r.superName === 'SAIFULLAH').map(r => r.routeCode));
console.log('Routes for SAIF in routes list:', data.routes.filter(r => r.superName === 'SAIF').map(r => r.routeCode));
