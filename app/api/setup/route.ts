import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

export async function GET() {
  try {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const userId = 'user_admin_123';
    
    // Check if user exists
    const [rows]: any = await db.execute('SELECT * FROM `User` WHERE email = ?', ['admin@example.com']);
    if (rows && rows.length > 0) {
      return NextResponse.json({ success: true, message: 'Admin user already exists.' });
    }
    
    // Insert admin user
    await db.execute(`
      INSERT INTO \`User\` (id, name, employeeCode, email, passwordHash, mobile, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, 'Admin User', 'ADMIN001', 'admin@example.com', passwordHash, '1234567890', 'Admin', 'Active']);
    
    return NextResponse.json({ success: true, message: 'Admin user created successfully! You can now log in.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
