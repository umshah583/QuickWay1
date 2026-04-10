'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type PettyCashAssignment = {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  amountCents: number;
  assignedAt: string;
  status: 'active' | 'settled';
  receipts: PettyCashReceipt[];
};

export type PettyCashReceipt = {
  id: string;
  description: string;
  amountCents: number;
  category: string;
  submittedAt: string;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  imageUrl?: string;
};

export type StaffPettyCashSummary = {
  staffId: string;
  staffName: string;
  staffEmail: string;
  totalAssigned: number;
  totalVerified: number;
  outstandingBalance: number;
  assignmentCount: number;
  pendingReceipts: number;
};

export async function getPettyCashAssignments(): Promise<PettyCashAssignment[]> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'petty_cash_assignments' },
    });

    if (!setting?.value) {
      return [];
    }

    const assignments: PettyCashAssignment[] = JSON.parse(setting.value);
    return assignments.sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
  } catch (error) {
    console.error('Error fetching petty cash assignments:', error);
    return [];
  }
}

export async function getStaffPettyCashSummaries(): Promise<StaffPettyCashSummary[]> {
  try {
    const assignments = await getPettyCashAssignments();
    
    const staffMap = new Map<string, StaffPettyCashSummary>();
    
    assignments.forEach(assignment => {
      const existing = staffMap.get(assignment.staffId);
      const totalAssigned = (existing?.totalAssigned || 0) + assignment.amountCents;
      const totalVerified = (existing?.totalVerified || 0) + assignment.receipts
        .filter(r => r.verified)
        .reduce((sum, r) => sum + r.amountCents, 0);
      const pendingReceipts = (existing?.pendingReceipts || 0) + assignment.receipts
        .filter(r => !r.verified).length;
      const assignmentCount = (existing?.assignmentCount || 0) + 1;
      
      staffMap.set(assignment.staffId, {
        staffId: assignment.staffId,
        staffName: assignment.staffName,
        staffEmail: assignment.staffEmail,
        totalAssigned,
        totalVerified,
        outstandingBalance: totalAssigned - totalVerified,
        assignmentCount,
        pendingReceipts,
      });
    });
    
    return Array.from(staffMap.values());
  } catch (error) {
    console.error('Error calculating staff petty cash summaries:', error);
    return [];
  }
}

export async function assignPettyCashToStaff(data: {
  staffId: string;
  staffName: string;
  staffEmail: string;
  amountCents: number;
}) {
  try {
    const assignment: PettyCashAssignment = {
      id: `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      staffId: data.staffId,
      staffName: data.staffName,
      staffEmail: data.staffEmail,
      amountCents: data.amountCents,
      assignedAt: new Date().toISOString(),
      status: 'active',
      receipts: [],
    };

    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'petty_cash_assignments' },
    });

    let assignments: PettyCashAssignment[] = [];
    if (setting?.value) {
      try {
        assignments = JSON.parse(setting.value);
      } catch (e) {
        console.error('Error parsing petty cash assignments:', e);
      }
    }

    assignments.unshift(assignment);

    await prisma.adminSetting.upsert({
      where: { key: 'petty_cash_assignments' },
      update: {
        value: JSON.stringify(assignments),
        updatedAt: new Date(),
      },
      create: {
        id: `petty-assignments-${Date.now()}`,
        key: 'petty_cash_assignments',
        value: JSON.stringify(assignments),
        updatedAt: new Date(),
      },
    });

    // Automatically create employee expense record for petty cash advance
    console.log('[PettyCash] Creating employee expense for staff:', data.staffId, data.staffName);
    
    try {
      const expenseSetting = await prisma.adminSetting.findUnique({
        where: { key: 'employee_expenses' },
      });

      let expenses: any[] = [];
      if (expenseSetting?.value) {
        try {
          expenses = JSON.parse(expenseSetting.value);
          console.log('[PettyCash] Existing expenses count:', expenses.length);
          console.log('[PettyCash] Existing expense employeeIds:', expenses.map((e: any) => e.employeeId));
        } catch (e) {
          console.error('[PettyCash] Error parsing employee expenses:', e);
        }
      } else {
        console.log('[PettyCash] No existing employee_expenses setting found, creating new');
      }

      const expense = {
        id: `expense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        employeeId: data.staffId,
        type: 'advance',
        amountCents: data.amountCents,
        description: `Petty cash advance - Assignment ID: ${assignment.id}`,
        category: 'Petty Cash',
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        pettyCashAssignmentId: assignment.id,
        createdAt: new Date().toISOString(),
      };

      console.log('[PettyCash] Created expense:', expense);
      console.log('[PettyCash] Expense employeeId:', expense.employeeId, 'StaffId from form:', data.staffId);
      expenses.unshift(expense);

      console.log('[PettyCash] Total expenses after adding:', expenses.length);

      await prisma.adminSetting.upsert({
        where: { key: 'employee_expenses' },
        update: {
          value: JSON.stringify(expenses),
          updatedAt: new Date(),
        },
        create: {
          id: `employee-expenses-${Date.now()}`,
          key: 'employee_expenses',
          value: JSON.stringify(expenses),
          updatedAt: new Date(),
        },
      });

      console.log('[PettyCash] Saved expense to employee_expenses setting');
      
      // Verify the expense was saved
      const verifySetting = await prisma.adminSetting.findUnique({
        where: { key: 'employee_expenses' },
      });
      if (verifySetting?.value) {
        const verifyExpenses = JSON.parse(verifySetting.value);
        console.log('[PettyCash] Verification - Total expenses after save:', verifyExpenses.length);
        const savedExpense = verifyExpenses.find((e: any) => e.id === expense.id);
        if (savedExpense) {
          console.log('[PettyCash] Verification - Expense found:', savedExpense);
        } else {
          console.error('[PettyCash] Verification - Expense NOT found after save!');
        }
      }
    } catch (expenseError) {
      console.error('[PettyCash] Error creating employee expense:', expenseError);
      // Continue anyway - petty cash assignment succeeded
    }

    revalidatePath('/admin/petty-cash');
    revalidatePath('/admin/employees');
    return { success: true, assignment };
  } catch (error) {
    console.error('Error assigning petty cash:', error);
    return { success: false, error: 'Failed to assign petty cash' };
  }
}

export async function submitReceipt(data: {
  assignmentId: string;
  description: string;
  amountCents: number;
  category: string;
  imageUrl?: string;
}) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'petty_cash_assignments' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No assignments found' };
    }

    const assignments: PettyCashAssignment[] = JSON.parse(setting.value);
    const assignmentIndex = assignments.findIndex(a => a.id === data.assignmentId);
    
    if (assignmentIndex === -1) {
      return { success: false, error: 'Assignment not found' };
    }

    const receipt: PettyCashReceipt = {
      id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: data.description,
      amountCents: data.amountCents,
      category: data.category,
      submittedAt: new Date().toISOString(),
      verified: false,
      imageUrl: data.imageUrl,
    };

    assignments[assignmentIndex].receipts.push(receipt);

    await prisma.adminSetting.update({
      where: { key: 'petty_cash_assignments' },
      data: {
        value: JSON.stringify(assignments),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/petty-cash');
    return { success: true, receipt };
  } catch (error) {
    console.error('Error submitting receipt:', error);
    return { success: false, error: 'Failed to submit receipt' };
  }
}

export async function verifyReceipt(data: {
  assignmentId: string;
  receiptId: string;
  verified: boolean;
  verifiedBy: string;
}) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'petty_cash_assignments' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No assignments found' };
    }

    const assignments: PettyCashAssignment[] = JSON.parse(setting.value);
    const assignmentIndex = assignments.findIndex(a => a.id === data.assignmentId);
    
    if (assignmentIndex === -1) {
      return { success: false, error: 'Assignment not found' };
    }

    const receiptIndex = assignments[assignmentIndex].receipts.findIndex(r => r.id === data.receiptId);
    
    if (receiptIndex === -1) {
      return { success: false, error: 'Receipt not found' };
    }

    assignments[assignmentIndex].receipts[receiptIndex].verified = data.verified;
    assignments[assignmentIndex].receipts[receiptIndex].verifiedAt = new Date().toISOString();
    assignments[assignmentIndex].receipts[receiptIndex].verifiedBy = data.verifiedBy;

    // Check if all receipts are verified and total matches assignment
    const allVerified = assignments[assignmentIndex].receipts.every(r => r.verified);
    const totalVerified = assignments[assignmentIndex].receipts
      .filter(r => r.verified)
      .reduce((sum, r) => sum + r.amountCents, 0);
    
    let assignmentSettled = false;
    if (allVerified && totalVerified >= assignments[assignmentIndex].amountCents) {
      assignments[assignmentIndex].status = 'settled';
      assignmentSettled = true;
    }

    await prisma.adminSetting.update({
      where: { key: 'petty_cash_assignments' },
      data: {
        value: JSON.stringify(assignments),
        updatedAt: new Date(),
      },
    });

    // Update corresponding employee expense when assignment is settled
    if (assignmentSettled) {
      const expenseSetting = await prisma.adminSetting.findUnique({
        where: { key: 'employee_expenses' },
      });

      if (expenseSetting?.value) {
        const expenses: any[] = JSON.parse(expenseSetting.value);
        const expenseIndex = expenses.findIndex(
          e => e.pettyCashAssignmentId === data.assignmentId
        );

        if (expenseIndex !== -1) {
          expenses[expenseIndex].status = 'approved';
          expenses[expenseIndex].approvedAt = new Date().toISOString();
          expenses[expenseIndex].approvedBy = data.verifiedBy;

          await prisma.adminSetting.update({
            where: { key: 'employee_expenses' },
            data: {
              value: JSON.stringify(expenses),
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    revalidatePath('/admin/petty-cash');
    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error) {
    console.error('Error verifying receipt:', error);
    return { success: false, error: 'Failed to verify receipt' };
  }
}

export async function deleteReceipt(assignmentId: string, receiptId: string) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'petty_cash_assignments' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No assignments found' };
    }

    const assignments: PettyCashAssignment[] = JSON.parse(setting.value);
    const assignmentIndex = assignments.findIndex(a => a.id === assignmentId);
    
    if (assignmentIndex === -1) {
      return { success: false, error: 'Assignment not found' };
    }

    assignments[assignmentIndex].receipts = assignments[assignmentIndex].receipts.filter(r => r.id !== receiptId);

    await prisma.adminSetting.update({
      where: { key: 'petty_cash_assignments' },
      data: {
        value: JSON.stringify(assignments),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/petty-cash');
    return { success: true };
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return { success: false, error: 'Failed to delete receipt' };
  }
}

export async function deletePettyCashAssignment(assignmentId: string) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'petty_cash_assignments' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No assignments found' };
    }

    const assignments: PettyCashAssignment[] = JSON.parse(setting.value);
    const filteredAssignments = assignments.filter(a => a.id !== assignmentId);

    await prisma.adminSetting.update({
      where: { key: 'petty_cash_assignments' },
      data: {
        value: JSON.stringify(filteredAssignments),
        updatedAt: new Date(),
      },
    });

    // Also delete corresponding employee expense
    const expenseSetting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_expenses' },
    });

    if (expenseSetting?.value) {
      const expenses: any[] = JSON.parse(expenseSetting.value);
      const filteredExpenses = expenses.filter(e => e.pettyCashAssignmentId !== assignmentId);

      await prisma.adminSetting.update({
        where: { key: 'employee_expenses' },
        data: {
          value: JSON.stringify(filteredExpenses),
          updatedAt: new Date(),
        },
      });
    }

    revalidatePath('/admin/petty-cash');
    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error) {
    console.error('Error deleting petty cash assignment:', error);
    return { success: false, error: 'Failed to delete petty cash assignment' };
  }
}

export async function updatePettyCashAssignment(assignmentId: string, data: {
  amountCents?: number;
  status?: 'active' | 'settled';
}) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'petty_cash_assignments' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No assignments found' };
    }

    const assignments: PettyCashAssignment[] = JSON.parse(setting.value);
    const assignmentIndex = assignments.findIndex(a => a.id === assignmentId);
    
    if (assignmentIndex === -1) {
      return { success: false, error: 'Assignment not found' };
    }

    if (data.amountCents !== undefined) {
      assignments[assignmentIndex].amountCents = data.amountCents;
    }

    if (data.status !== undefined) {
      assignments[assignmentIndex].status = data.status;
    }

    await prisma.adminSetting.update({
      where: { key: 'petty_cash_assignments' },
      data: {
        value: JSON.stringify(assignments),
        updatedAt: new Date(),
      },
    });

    // Update corresponding employee expense if amount changed
    if (data.amountCents !== undefined) {
      const expenseSetting = await prisma.adminSetting.findUnique({
        where: { key: 'employee_expenses' },
      });

      if (expenseSetting?.value) {
        const expenses: any[] = JSON.parse(expenseSetting.value);
        const expenseIndex = expenses.findIndex(e => e.pettyCashAssignmentId === assignmentId);

        if (expenseIndex !== -1) {
          expenses[expenseIndex].amountCents = data.amountCents;

          await prisma.adminSetting.update({
            where: { key: 'employee_expenses' },
            data: {
              value: JSON.stringify(expenses),
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    revalidatePath('/admin/petty-cash');
    revalidatePath('/admin/employees');
    return { success: true, assignment: assignments[assignmentIndex] };
  } catch (error) {
    console.error('Error updating petty cash assignment:', error);
    return { success: false, error: 'Failed to update petty cash assignment' };
  }
}

export async function getStaffMembers() {
  try {
    const staff = await prisma.user.findMany({
      where: {
        role: {
          in: ['DRIVER', 'ADMIN'],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return staff;
  } catch (error) {
    console.error('Error fetching staff members:', error);
    return [];
  }
}
