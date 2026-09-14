import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { userRepository } from '@/repositories/user-repository';
import { supervisorSchema } from '@/schemas/supervisor';
import { auditService } from '@/services/audit-service';
import bcrypt from 'bcryptjs';

const checkAdmin = async () => {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user as any;
  if (user.role !== 'Admin' || user.status !== 'Active') return null;
  return session;
};

export async function GET() {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await userRepository.getAllUsers();
    // Return only supervisors or users excluding passwords
    const supervisors = users.map((u) => ({
      id: u.id,
      name: u.name,
      employeeCode: u.employeeCode,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    }));
    return NextResponse.json(supervisors);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = supervisorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { name, employeeCode, email, password, mobile, role, status } = parsed.data;

    // Check if updating or creating
    const isEdit = body.id !== undefined;

    if (isEdit) {
      const existing = await userRepository.getUserById(body.id);
      if (!existing) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Check unique
      if (email !== existing.email) {
        const dup = await userRepository.getUserByEmail(email);
        if (dup) return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
      if (employeeCode !== existing.employeeCode) {
        const dup = await userRepository.getUserByEmployeeCode(employeeCode);
        if (dup) return NextResponse.json({ error: 'Employee Code already exists' }, { status: 400 });
      }

      const updates: any = { name, employeeCode, email, mobile, role, status };
      if (password && password.trim() !== '') {
        updates.passwordHash = await bcrypt.hash(password, 10);
      }

      const updated = await userRepository.updateUser(body.id, updates);
      await auditService.logAction(
        session.user?.email || 'Admin',
        'Update User via API',
        `Updated: ${name} (${employeeCode})`
      );
      return NextResponse.json(updated);
    } else {
      // Create new
      const dupEmail = await userRepository.getUserByEmail(email);
      if (dupEmail) return NextResponse.json({ error: 'Email already exists' }, { status: 400 });

      const dupCode = await userRepository.getUserByEmployeeCode(employeeCode);
      if (dupCode) return NextResponse.json({ error: 'Employee Code already exists' }, { status: 400 });

      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password is required and must be min 6 chars' }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const created = await userRepository.createUser({
        name,
        employeeCode,
        email,
        passwordHash,
        mobile,
        role,
        status,
      });

      await auditService.logAction(
        session.user?.email || 'Admin',
        'Create User via API',
        `Created: ${name} (${employeeCode})`
      );
      return NextResponse.json(created, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
