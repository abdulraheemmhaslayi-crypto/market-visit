'use server';

import { userRepository } from '@/repositories/user-repository';
import { auditService } from '@/services/audit-service';
import bcrypt from 'bcryptjs';

export async function checkResetPasswordEmailAction(email: string) {
  try {
    const user = await userRepository.getUserByEmail(email);
    if (!user) {
      return { success: false, error: 'No account found matching this email.' };
    }
    
    if (user.role !== 'Admin') {
      return { 
        success: true, 
        allowed: false, 
        message: 'Supervisors cannot reset their own password. Please contact your Administrator to reset your password.' 
      };
    }
    
    return { success: true, allowed: true, userId: user.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'An error occurred while checking email.' };
  }
}

export async function resetAdminPasswordAction(email: string, employeeCode: string, newPassword: string) {
  try {
    const user = await userRepository.getUserByEmail(email);
    if (!user) {
      return { success: false, error: 'User account not found.' };
    }
    
    if (user.role !== 'Admin') {
      return { success: false, error: 'Only administrators are allowed to reset passwords through this option.' };
    }
    
    if (user.employeeCode !== employeeCode) {
      return { success: false, error: 'Verification failed. Employee Code does not match our records.' };
    }
    
    if (newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepository.updateUser(user.id, { passwordHash });
    
    await auditService.logAction(
      email,
      'Reset Password',
      `Administrator reset their own password via Forgot Password wizard.`
    );
    
    return { success: true, message: 'Password has been reset successfully. You can now sign in with your new password.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reset password.' };
  }
}
