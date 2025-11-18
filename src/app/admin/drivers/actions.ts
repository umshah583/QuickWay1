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

export async function saveDriverDutySettings(driverId: string, formData: FormData) {
  const dayConfigs = [
    { key: 'mon', code: 'MON' },
    { key: 'tue', code: 'TUE' },
    { key: 'wed', code: 'WED' },
    { key: 'thu', code: 'THU' },
    { key: 'fri', code: 'FRI' },
    { key: 'sat', code: 'SAT' },
    { key: 'sun', code: 'SUN' },
  ];

  const schedule: Record<string, { startTime: string; endTime: string }[]> = {};

  for (const day of dayConfigs) {
    const shifts: { startTime: string; endTime: string }[] = [];

    const s1 = formData.get(`${day.key}Shift1Start`)?.toString().trim() ?? '';
    const e1 = formData.get(`${day.key}Shift1End`)?.toString().trim() ?? '';
    if (s1 && e1) {
      shifts.push({ startTime: s1, endTime: e1 });
    }

    const s2 = formData.get(`${day.key}Shift2Start`)?.toString().trim() ?? '';
    const e2 = formData.get(`${day.key}Shift2End`)?.toString().trim() ?? '';
    if (s2 && e2) {
      shifts.push({ startTime: s2, endTime: e2 });
    }

    if (shifts.length) {
      schedule[day.code] = shifts;
    }
  }

  const value = Object.keys(schedule).length ? JSON.stringify(schedule) : '';

  await prisma.adminSetting.upsert({
    where: { key: `driverDutyWeeklySchedule:${driverId}` },
    create: { key: `driverDutyWeeklySchedule:${driverId}`, value },
    update: { value },
  });

  revalidatePath(`/admin/drivers/${driverId}`);
  revalidatePath('/admin/drivers');
}
