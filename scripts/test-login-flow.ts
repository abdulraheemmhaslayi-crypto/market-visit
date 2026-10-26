import bcrypt from 'bcryptjs';
import { userRepository, CANONICAL_USERS } from '../repositories/user-repository';

// Test that all 20 canonical users can be found and authenticated
async function testLoginFlow() {
  console.log('Testing getAllUsers()...');
  const allUsers = await userRepository.getAllUsers();
  console.log(`getAllUsers() returned ${allUsers.length} users.`);
  if (allUsers.length !== 20) {
    throw new Error(`Expected 20 users, but got ${allUsers.length}`);
  }

  console.log('\nTesting findUserForLogin and password verification for each canonical user...');
  for (const cu of CANONICAL_USERS) {
    // 1. By email
    const byEmail = await userRepository.findUserForLogin(cu.email);
    if (!byEmail) throw new Error(`Failed to find user by email: ${cu.email}`);

    // 2. By employeeCode
    const byCode = await userRepository.findUserForLogin(cu.employeeCode);
    if (!byCode) throw new Error(`Failed to find user by employeeCode: ${cu.employeeCode}`);

    // 3. By lowercase code
    const byLowerCode = await userRepository.findUserForLogin(cu.employeeCode.toLowerCase());
    if (!byLowerCode) throw new Error(`Failed to find user by lowercase code: ${cu.employeeCode.toLowerCase()}`);

    // 4. By name
    const byName = await userRepository.findUserForLogin(cu.name);
    if (!byName) throw new Error(`Failed to find user by name: ${cu.name}`);

    // 5. By legacy SV- prefix if applicable
    const byLegacy = await userRepository.findUserForLogin(`SV-${cu.name}`);
    if (!byLegacy) throw new Error(`Failed to find user by legacy code: SV-${cu.name}`);

    // 6. Test password check
    const isPassValid = await bcrypt.compare(cu.defaultPassword, byEmail.passwordHash);
    if (!isPassValid) {
      throw new Error(`Password check failed for ${cu.name} with password ${cu.defaultPassword}`);
    }

    console.log(`✓ ${cu.name} (${cu.employeeCode}) [${cu.role}] -> Verified successfully with password: ${cu.defaultPassword}`);
  }

  console.log('\nAll 20 users verified successfully across email, employeeCode, name, legacy SV-, and password authentication!');
  process.exit(0);
}

testLoginFlow().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
