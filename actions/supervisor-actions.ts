'use server';

import { auth } from '@/lib/auth';
import { userRepository } from '@/repositories/user-repository';
import { routeRepository } from '@/repositories/route-repository';
import { supervisorSchema, SupervisorInput } from '@/schemas/supervisor';
import { auditService } from '@/services/audit-service';
import { canAccessAdminRoute, canModifyMasterData } from '@/lib/roles';
import bcrypt from 'bcryptjs';

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  field?: string;
  userId?: string;
  backfilledRoutes?: number;
};

const verifyAdminSession = async () => {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Authentication required');
  }
  const user = session.user as any;
  if (!canAccessAdminRoute(user.role)) {
    throw new Error('Access denied. Administrative privileges required.');
  }
  if (user.status !== 'Active') {
    throw new Error('Your account is inactive.');
  }
  return session;
};

export async function getSupervisorsAction(): Promise<any[]> {
  try {
    await verifyAdminSession();
    const users = await userRepository.getAllUsers();
    
    // Import master data supervisors
    let masterSupervisors: string[] = [];
    try {
      const { getCustMasterData } = await import('@/lib/custmaster-data');
      masterSupervisors = getCustMasterData().supervisors || [];
    } catch {}

    const userList = users.map((u) => ({
      id: u.id,
      name: u.name,
      employeeCode: u.employeeCode,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    }));

    // If there are master supervisors not yet in User table, merge them so admin can see all 15 supervisors
    const existingNames = new Set(userList.map((u) => (u.name || '').toUpperCase().trim()));
    for (const sName of masterSupervisors) {
      const upper = sName.toUpperCase().trim();
      if (upper && !existingNames.has(upper) && upper !== 'INTERNAL' && upper !== 'SAMRA') {
        userList.push({
          id: `master_${upper.toLowerCase()}`,
          name: sName,
          employeeCode: `SV-${upper}`,
          email: `${upper.toLowerCase()}@marketvisit.com`,
          mobile: '—',
          role: 'Supervisor' as any,
          status: 'Active' as any,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return userList;
  } catch (error: any) {
    console.error('Failed to get supervisors:', error);
    return [];
  }
}

export async function createSupervisorAction(data: SupervisorInput): Promise<ActionResponse> {
  try {
    const session = await verifyAdminSession();
    const currentUser = session.user as any;
    if (!canModifyMasterData(currentUser?.role)) {
      return {
        success: false,
        error: '403 Forbidden: You do not have write permissions to create supervisor accounts.',
      };
    }
    const parsed = supervisorSchema.safeParse(data);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        success: false,
        error: `Invalid inputs: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
        field: firstIssue?.path[0]?.toString(),
      };
    }

    const { name, employeeCode, email, password, mobile, role, status } = parsed.data;

    // Verify unique email/code
    const existingEmail = await userRepository.getUserByEmail(email);
    if (existingEmail) {
      return {
        success: false,
        error: 'A user with this Email/Login ID already exists.',
        field: 'email',
      };
    }

    const existingCode = await userRepository.getUserByEmployeeCode(employeeCode);
    if (existingCode) {
      return {
        success: false,
        error: 'A user with this Employee Code already exists.',
        field: 'employeeCode',
      };
    }

    if (!password || password.length < 6) {
      return {
        success: false,
        error: 'Password must be at least 6 characters for a new account.',
        field: 'password',
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await userRepository.createUser({
      name,
      employeeCode,
      email,
      passwordHash,
      mobile,
      role,
      status,
    });

    const backfilledRoutes = await routeRepository.backfillSupervisorByName(newUser.id, name);

    const adminUser = session.user?.email || 'Admin';
    await auditService.logAction(
      adminUser,
      'Create User',
      `Created supervisor user: ${name} (${employeeCode})` +
        (backfilledRoutes > 0 ? `. Backfilled ${backfilledRoutes} previously-unmapped route(s) from Route Master import.` : '')
    );

    return { success: true, userId: newUser.id, backfilledRoutes };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'An unexpected error occurred while creating supervisor account.',
    };
  }
}

export async function updateSupervisorAction(id: string, data: SupervisorInput): Promise<ActionResponse> {
  try {
    const session = await verifyAdminSession();
    const adminUserRole = (session.user as any)?.role;
    if (!canModifyMasterData(adminUserRole)) {
      return {
        success: false,
        error: '403 Forbidden: You do not have write permissions to update supervisor accounts.',
      };
    }
    const parsed = supervisorSchema.safeParse(data);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        success: false,
        error: `Invalid inputs: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
        field: firstIssue?.path[0]?.toString(),
      };
    }

    const existingUser = await userRepository.getUserById(id);
    if (!existingUser) {
      return { success: false, error: 'Supervisor account not found.' };
    }

    const { name, employeeCode, email, password, mobile, role, status } = parsed.data;

    // Validate email/code changes against other accounts
    if (email !== existingUser.email) {
      const duplicate = await userRepository.getUserByEmail(email);
      if (duplicate) {
        return {
          success: false,
          error: 'A user with this Email/Login ID already exists.',
          field: 'email',
        };
      }
    }

    if (employeeCode !== existingUser.employeeCode) {
      const duplicate = await userRepository.getUserByEmployeeCode(employeeCode);
      if (duplicate) {
        return {
          success: false,
          error: 'A user with this Employee Code already exists.',
          field: 'employeeCode',
        };
      }
    }

    const updates: any = {
      name,
      employeeCode,
      email,
      mobile,
      role,
      status,
    };

    if (password && password.trim() !== '') {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    await userRepository.updateUser(id, updates);

    const adminUser = session.user?.email || 'Admin';
    await auditService.logAction(
      adminUser,
      'Update User',
      `Updated supervisor user: ${name} (${employeeCode}). Status changed to: ${status}`
    );

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'An unexpected error occurred while updating supervisor details.',
    };
  }
}

export async function disableSupervisorAction(id: string): Promise<ActionResponse> {
  try {
    const session = await verifyAdminSession();
    const adminUserRole = (session.user as any)?.role;
    if (!canModifyMasterData(adminUserRole)) {
      return {
        success: false,
        error: '403 Forbidden: You do not have write permissions to disable supervisor accounts.',
      };
    }
    const existingUser = await userRepository.getUserById(id);
    if (!existingUser) {
      return { success: false, error: 'Supervisor account not found.' };
    }

    await userRepository.updateUser(id, { status: 'Inactive' });

    const adminUser = session.user?.email || 'Admin';
    await auditService.logAction(
      adminUser,
      'Disable User',
      `Disabled supervisor user: ${existingUser.name} (${existingUser.employeeCode})`
    );

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to disable supervisor account.',
    };
  }
}
