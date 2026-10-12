// Test script to verify customer lookup and route assignment for SAIF and SAIFULLAH
const path = require('path');

async function test() {
  const { routeRepository } = require('../repositories/route-repository');
  const { customerRepository } = require('../repositories/customer-repository');

  console.log('Testing TRD129 assignment for SAIF (usr_tgb2s6h):');
  const saifAssigned = await routeRepository.isRouteAssignedToSupervisor('TRD129', 'usr_tgb2s6h');
  console.log('Is TRD129 assigned to SAIF?', saifAssigned);

  console.log('Testing TRD129 assignment for SAIFULLAH (usr_rqwxav8):');
  const saifullahAssigned = await routeRepository.isRouteAssignedToSupervisor('TRD129', 'usr_rqwxav8');
  console.log('Is TRD129 assigned to SAIFULLAH?', saifullahAssigned);

  console.log('Testing MTD207 assignment for SAIFULLAH:');
  const saifullahMt = await routeRepository.isRouteAssignedToSupervisor('MTD207', 'usr_rqwxav8');
  console.log('Is MTD207 assigned to SAIFULLAH?', saifullahMt);

  console.log('Testing MTD207 assignment for SAIF:');
  const saifMt = await routeRepository.isRouteAssignedToSupervisor('MTD207', 'usr_tgb2s6h');
  console.log('Is MTD207 assigned to SAIF?', saifMt);

  console.log('\nFetching customers for TRD129:');
  const custs = await customerRepository.getCustomersByRoute('TRD129');
  console.log('Total customers found for TRD129:', custs.length);
  if (custs.length > 0) {
    console.log('Sample customer:', custs[0]);
  }
}

// Note: Requires ts-node or run build check
