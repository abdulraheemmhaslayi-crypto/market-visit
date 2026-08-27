import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { authConfig } from '@/auth.config';
import { userRepository } from '@/repositories/user-repository';

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'antigravity_secret_key_123_abc_xyz_secret_999',
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter both email and password.');
        }

        const loginInput = (credentials.email as string).trim();
        const user = (await userRepository.getUserByEmail(loginInput)) || (await userRepository.getUserByEmployeeCode(loginInput));
        if (!user) {
          throw new Error('No user found with this email/Login ID.');
        }

        // Verify status is active
        if (user.status !== 'Active') {
          throw new Error('Your account is inactive. Please contact the administrator.');
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!isValid) {
          throw new Error('Incorrect password. Please try again.');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          employeeCode: user.employeeCode,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
});
export type Auth = typeof auth;
export type Handlers = typeof handlers;
export type SignIn = typeof signIn;
export type SignOut = typeof signOut;
export type Session = Awaited<ReturnType<Auth>>;
