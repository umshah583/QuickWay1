'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type ManualTransaction = {
  id: string;
  type: 'credit' | 'debit';
  amountCents: number;
  description: string;
  channel: string;
  userId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userEmail?: string;
  creatorName?: string;
  creatorEmail?: string;
};

export async function createManualTransaction(data: {
  type: 'credit' | 'debit';
  amountCents: number;
  description: string;
  userId?: string;
}) {
  try {
    const transaction = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: data.type,
      amountCents: data.amountCents,
      description: data.description,
      channel: 'Manual',
      userId: data.userId || null,
      createdBy: 'admin', // Will be updated with actual user ID
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Get existing manual transactions from AdminSetting
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'manual_transactions' },
    });

    let transactions: ManualTransaction[] = [];
    if (setting?.value) {
      try {
        transactions = JSON.parse(setting.value);
      } catch (e) {
        console.error('Error parsing manual transactions:', e);
      }
    }

    // Add new transaction
    transactions.unshift(transaction);

    // Save back to AdminSetting
    await prisma.adminSetting.upsert({
      where: { key: 'manual_transactions' },
      update: {
        value: JSON.stringify(transactions),
        updatedAt: new Date(),
      },
      create: {
        id: `manual-transactions-${Date.now()}`,
        key: 'manual_transactions',
        value: JSON.stringify(transactions),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/transactions');
    return { success: true, transaction };
  } catch (error) {
    console.error('Error creating manual transaction:', error);
    return { success: false, error: 'Failed to create manual transaction' };
  }
}

export async function getManualTransactions(): Promise<ManualTransaction[]> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'manual_transactions' },
    });

    if (!setting?.value) {
      return [];
    }

    const transactions: ManualTransaction[] = JSON.parse(setting.value);
    
    // Enrich with user information if userId is present
    const userIds = transactions
      .map(t => t.userId)
      .filter((id): id is string => id !== null);
    
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    
    const userMap = new Map(users.map(u => [u.id, u]));
    
    return transactions.map(t => ({
      ...t,
      userName: t.userId ? (userMap.get(t.userId)?.name ?? undefined) : undefined,
      userEmail: t.userId ? (userMap.get(t.userId)?.email ?? undefined) : undefined,
    }));
  } catch (error) {
    console.error('Error fetching manual transactions:', error);
    return [];
  }
}

export async function deleteManualTransaction(id: string) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'manual_transactions' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No manual transactions found' };
    }

    const transactions: ManualTransaction[] = JSON.parse(setting.value);
    const filteredTransactions = transactions.filter(t => t.id !== id);

    await prisma.adminSetting.update({
      where: { key: 'manual_transactions' },
      data: {
        value: JSON.stringify(filteredTransactions),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/transactions');
    return { success: true };
  } catch (error) {
    console.error('Error deleting manual transaction:', error);
    return { success: false, error: 'Failed to delete manual transaction' };
  }
}
