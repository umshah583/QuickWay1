'use server';

import { revalidatePath } from 'next/cache';
import { NotificationCategory } from '@prisma/client';
import prisma from '@/lib/prisma';

function toNotificationCategory(value: FormDataEntryValue | null): NotificationCategory | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const upper = value.trim().toUpperCase();
  return (Object.values(NotificationCategory) as string[]).includes(upper)
    ? (upper as NotificationCategory)
    : undefined;
}

export async function toggleNotificationRead(formData: FormData) {
  const id = formData.get('id');
  const readValue = formData.get('read');

  if (typeof id !== 'string' || typeof readValue !== 'string') return;

  await prisma.notification.update({
    where: { id },
    data: { read: readValue === 'true' },
  });

  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
}

export async function markAllNotificationsRead(formData: FormData) {
  const category = toNotificationCategory(formData.get('category'));

  await prisma.notification.updateMany({
    where: {
      read: false,
      category,
    },
    data: { read: true },
  });

  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
}
