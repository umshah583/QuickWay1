'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const driverSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type CreateDriverState = {
  error?: string;
};

export async function createDriver(prevState: CreateDriverState, formData: FormData): Promise<CreateDriverState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = driverSchema.safeParse(raw);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input';
    return { error: firstError };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'A user with this email already exists.' };
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'DRIVER',
    },
  });

  revalidatePath('/admin/drivers');

  redirect('/admin/drivers?created=1');

  return {};
}
