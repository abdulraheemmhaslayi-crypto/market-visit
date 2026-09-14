import { z } from 'zod';

export const supervisorSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  employeeCode: z.string().min(2, { message: 'Employee Code is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).optional().or(z.literal('')),
  mobile: z.string().regex(/^\+?[1-9]\d{1,14}$|^[0-9]{10}$/, {
    message: 'Mobile number must be a valid 10-digit number or international format',
  }),
  status: z.enum(['Active', 'Inactive'] as const),
  role: z.enum(['GM', 'BDM', 'Sales Manager', 'Admin', 'Sub-Admin', 'Supervisor', 'Fleet', 'Maintenance'] as const),
});

export type SupervisorInput = z.infer<typeof supervisorSchema>;
