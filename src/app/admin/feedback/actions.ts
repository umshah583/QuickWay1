'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

export async function deleteFeedback(formData: FormData) {
  await requireAdminSession();

  const id = formData.get('id');
  if (typeof id !== 'string' || !id.trim()) {
    return;
  }

  await prisma.feedback.delete({ where: { id } });

  revalidatePath('/admin/feedback');
}
