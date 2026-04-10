import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expenseSetting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_expenses' },
    });

    const pettyCashSetting = await prisma.adminSetting.findUnique({
      where: { key: 'petty_cash_assignments' },
    });

    return NextResponse.json({
      employeeExpenses: expenseSetting?.value ? JSON.parse(expenseSetting.value) : [],
      pettyCashAssignments: pettyCashSetting?.value ? JSON.parse(pettyCashSetting.value) : [],
    });
  } catch (error) {
    console.error('Error fetching debug data:', error);
    return NextResponse.json({ error: 'Failed to fetch debug data' }, { status: 500 });
  }
}
