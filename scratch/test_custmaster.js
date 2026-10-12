const path = require('path');
const { getCustMasterData } = require('../lib/custmaster-data');
const data = getCustMasterData();
console.log('Managers:', data.managers);
console.log('Supervisors count:', data.supervisors.length);
console.log('Routes count:', data.routes.length);
console.log('Customers count:', data.customers.length);
if (data.customers.length > 0) {
  console.log('Sample cust 0:', data.customers[0]);
  console.log('Sample cust 1:', data.customers[1]);
  console.log('Sample channels:', Array.from(new Set(data.customers.slice(0, 100).map(c => c.channel))));
}
