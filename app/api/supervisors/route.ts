import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { userRepository } from '@/repositories/user-repository';
import { routeRepository } from '@/repositories/route-repository';
import { supervisorSchema } from '@/schemas/supervisor';
import { auditService } from '@/services/audit-service';
import { canAccessAdminRoute, canModifyMasterData } from '@/lib/roles';
import bcrypt from 'bcryptjs';

const checkAdminSession = async () => {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user as any;
  if (!canAccessAdminRoute(user.role) || user.status !== 'Active') return null;
  return session;
};

export async function GET() {
  const session = await checkAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await userRepository.getAllUsers();
    
    // Import master data supervisors
    let masterSupervisors: string[] = [];
    try {
      const { getCustMasterData } = await import('@/lib/custmaster-data');
      masterSupervisors = getCustMasterData().supervisors || [];
    } catch {}

    // If there are master supervisors not yet in User table, create real DB records so they can log in
    const existingNames = new Set(users.map((u) => (u.name || '').toUpperCase().trim()));
    for (const sName of masterSupervisors) {
      const upper = sName.toUpperCase().trim();
      if (upper && !existingNames.has(upper) && upper !== 'INTERNAL' && upper !== 'SAMRA') {
        const nextNum = users.length + 1;
        const code = `SUP0${nextNum < 10 ? '0' + nextNum : nextNum}`;
        const email = `${upper.toLowerCase()}@marketvisit.com`;
        const pass = `${upper.toLowerCase()}@12345`;
        const passwordHash = await bcrypt.hash(pass, 10);
        const newUser = await userRepository.createUser({
          name: sName,
          employeeCode: code,
          email,
          mobile: '—',
          role: 'Supervisor',
          status: 'Active',
          passwordHash,
        });
        users.push(newUser);
        existingNames.add(upper);
      }
    }

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

    return NextResponse.json(userList);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await checkAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentUser = session.user as any;
  if (!canModifyMasterData(currentUser?.role)) {
    return NextResponse.json({ error: '403 Forbidden: You do not have permission to modify supervisors.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = supervisorSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json({
        error: parsed.error.issues.map((e) => e.message).join(', '),
        field: firstIssue?.path[0]?.toString(),
      }, { status: 400 });
    }

    const { name, employeeCode, email, password, mobile, role, status } = parsed.data;

    let targetId = body.id;
    let isMasterPlaceholder = targetId && String(targetId).startsWith('master_');

    let existing: any = null;
    if (targetId && !isMasterPlaceholder) {
      existing = await userRepository.getUserById(targetId);
    }

    // If placeholder from master data or not found by ID, check if user with matching email or employeeCode exists
    if (!existing) {
      existing = (await userRepository.getUserByEmail(email)) || (await userRepository.getUserByEmployeeCode(employeeCode));
      if (existing) {
        targetId = existing.id;
        isMasterPlaceholder = false;
      }
    }

    if (existing) {
      // Validate unique email
      if (email !== existing.email) {
        const dupEmail = await userRepository.getUserByEmail(email);
        if (dupEmail && dupEmail.id !== existing.id) {
          return NextResponse.json({ error: 'A user with this Email/Login ID already exists.', field: 'email' }, { status: 400 });
        }
      }

      // Validate unique employeeCode
      if (employeeCode !== existing.employeeCode) {
        const dupCode = await userRepository.getUserByEmployeeCode(employeeCode);
        if (dupCode && dupCode.id !== existing.id) {
          return NextResponse.json({ error: 'A user with this Employee Code already exists.', field: 'employeeCode' }, { status: 400 });
        }
      }

      const updates: any = { name, employeeCode, email, mobile, role, status };
      if (password && password.trim() !== '') {
        updates.passwordHash = await bcrypt.hash(password, 10);
      }

      const updated = await userRepository.updateUser(existing.id, updates);
      await auditService.logAction(
        currentUser.email || 'Admin',
        'Update User via API',
        `Updated supervisor: ${name} (${employeeCode})`
      );

      return NextResponse.json({ success: true, data: updated });
    } else {
      // Create new user (either new or converting master_ placeholder into actual DB user)
      const dupEmail = await userRepository.getUserByEmail(email);
      if (dupEmail) {
        return NextResponse.json({ error: 'A user with this Email/Login ID already exists.', field: 'email' }, { status: 400 });
      }

      const dupCode = await userRepository.getUserByEmployeeCode(employeeCode);
      if (dupCode) {
        return NextResponse.json({ error: 'A user with this Employee Code already exists.', field: 'employeeCode' }, { status: 400 });
      }

      const plainPassword = password && password.trim() !== '' ? password : `${employeeCode.toLowerCase()}123`;
      if (plainPassword.length < 6) {
        return NextResponse.json({ error: 'Password is required and must be at least 6 characters.', field: 'password' }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(plainPassword, 10);
      const created = await userRepository.createUser({
        name,
        employeeCode,
        email,
        passwordHash,
        mobile,
        role,
        status,
      });

      // Backfill any unmapped routes matching this supervisor's name
      let backfilledRoutes = 0;
      try {
        backfilledRoutes = await routeRepository.backfillSupervisorByName(created.id, name);
      } catch (e) {
        console.warn('Could not backfill routes for new supervisor:', e);
      }

      await auditService.logAction(
        currentUser.email || 'Admin',
        'Create User via API',
        `Created supervisor: ${name} (${employeeCode})`
      );

      return NextResponse.json({ success: true, data: created, backfilledRoutes }, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await checkAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentUser = session.user as any;
  if (!canModifyMasterData(currentUser?.role)) {
    return NextResponse.json({ error: '403 Forbidden: You do not have permission to disable supervisors.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing supervisor ID' }, { status: 400 });
    }

    if (id.startsWith('master_')) {
      return NextResponse.json({ success: true, message: 'Placeholder supervisor disabled' });
    }

    const existing = await userRepository.getUserById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Supervisor account not found.' }, { status: 404 });
    }

    await userRepository.updateUser(id, { status: 'Inactive' });
    await auditService.logAction(
      currentUser.email || 'Admin',
      'Disable Supervisor via API',
      `Disabled supervisor: ${existing.name} (${existing.employeeCode})`
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to disable supervisor.' }, { status: 500 });
  }
}
