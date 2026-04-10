'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { sendExpenseNotificationEmail, sendPayoutPaidEmail } from '@/lib/email';

export type EmployeeSalary = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  monthlySalaryCents: number;
  visaCostCents?: number;
  visaMultiplier?: number;
  leaveSalaryCents?: number;
  leaveSalaryMultiplier?: number;
  ticketCostCents?: number;
  ticketMultiplier?: number;
  medicalInsuranceCents?: number;
  medicalInsuranceMultiplier?: number;
  accommodationCostCents?: number;
  accommodationMultiplier?: number;
  startDate: string;
  isActive: boolean;
  createdAt: string;
};

export type EmployeeExpense = {
  id: string;
  employeeId: string;
  type: 'petty_cash' | 'deduction' | 'advance' | 'other';
  amountCents: number;
  description: string;
  category: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  pettyCashAssignmentId?: string;
};

export type EmployeePayout = {
  id: string;
  employeeId: string;
  month: string;
  year: number;
  grossSalaryCents: number;
  totalDeductionsCents: number;
  netSalaryCents: number;
  daysWorked: number;
  totalDays: number;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt?: string;
  paidBy?: string;
  createdAt: string;
};

export type EmployeeSummary = {
  employeeId: string;
  userName: string;
  userEmail: string;
  monthlySalaryCents: number;
  totalCostCents: number;
  totalExpenses: number;
  pendingExpenses: number;
  netPayable: number;
  lastPayoutMonth?: string;
};

export async function getEmployeeSalaries(): Promise<EmployeeSalary[]> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_salaries' },
    });

    if (!setting?.value) {
      return [];
    }

    const salaries: EmployeeSalary[] = JSON.parse(setting.value);
    return salaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Error fetching employee salaries:', error);
    return [];
  }
}

export async function getEmployeeExpenses(): Promise<EmployeeExpense[]> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_expenses' },
    });

    if (!setting?.value) {
      console.log('[EmployeeExpenses] No employee_expenses setting found');
      return [];
    }

    const expenses: EmployeeExpense[] = JSON.parse(setting.value);
    console.log(`[EmployeeExpenses] Found ${expenses.length} expenses`);
    expenses.forEach(e => {
      console.log(`[EmployeeExpenses] - ${e.employeeId}: ${e.type} ${e.amountCents} (${e.status})`);
    });
    return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('[EmployeeExpenses] Error fetching employee expenses:', error);
    return [];
  }
}

export async function getEmployeePayouts(): Promise<EmployeePayout[]> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_payouts' },
    });

    if (!setting?.value) {
      return [];
    }

    const payouts: EmployeePayout[] = JSON.parse(setting.value);
    return payouts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Error fetching employee payouts:', error);
    return [];
  }
}

export async function getEmployeeSummaries(): Promise<EmployeeSummary[]> {
  try {
    const [salaries, expenses, payouts, staff] = await Promise.all([
      getEmployeeSalaries(),
      getEmployeeExpenses(),
      getEmployeePayouts(),
      getStaffMembers(),
    ]);

    console.log(`[EmployeeSummaries] Processing ${salaries.length} salaries, ${expenses.length} expenses, and ${staff.length} staff`);
    console.log('[EmployeeSummaries] Staff members:', staff.map(s => ({ id: s.id, name: s.name, email: s.email })));
    console.log('[EmployeeSummaries] Expense employeeIds:', expenses.map(e => ({ id: e.id, employeeId: e.employeeId, type: e.type, status: e.status })));
    
    // Create a map of salaries by userId for quick lookup
    const salaryMap = new Map(salaries.map(s => [s.userId, s]));
    
    // Get all unique employee IDs from both salaries and expenses
    const allEmployeeIds = new Set([
      ...salaries.map(s => s.userId),
      ...expenses.map(e => e.employeeId),
    ]);

    console.log('[EmployeeSummaries] All unique employee IDs:', Array.from(allEmployeeIds));

    const summaries: EmployeeSummary[] = Array.from(allEmployeeIds).map(employeeId => {
      const salary = salaryMap.get(employeeId);
      const employeeExpenses = expenses.filter(e => e.employeeId === employeeId);
      const staffInfo = staff.find(s => s.id === employeeId);
      
      console.log(`[EmployeeSummaries] Processing ${staffInfo?.name || 'Unknown'} (${employeeId}): ${employeeExpenses.length} expenses`);
      console.log(`[EmployeeSummaries] - Staff found: ${!!staffInfo}, Salary found: ${!!salary}`);
      
      const totalExpenses = employeeExpenses
        .filter(e => e.status === 'approved')
        .reduce((sum, e) => sum + e.amountCents, 0);
      const pendingExpenses = employeeExpenses
        .filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + e.amountCents, 0);
      
      console.log(`[EmployeeSummaries] - Total Expenses: ${totalExpenses}, Pending: ${pendingExpenses}`);
      
      const employeePayouts = payouts.filter(p => p.employeeId === employeeId);
      const lastPayout = employeePayouts
        .filter(p => p.status === 'paid')
        .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())[0];
      
      const totalCostCents = (salary?.monthlySalaryCents || 0) +
        ((salary?.visaCostCents || 0) / (salary?.visaMultiplier || 1)) +
        ((salary?.leaveSalaryCents || 0) / (salary?.leaveSalaryMultiplier || 1)) +
        ((salary?.ticketCostCents || 0) / (salary?.ticketMultiplier || 1)) +
        ((salary?.medicalInsuranceCents || 0) / (salary?.medicalInsuranceMultiplier || 1)) +
        ((salary?.accommodationCostCents || 0) / (salary?.accommodationMultiplier || 1));
      
      return {
        employeeId,
        userName: salary?.userName || staffInfo?.name || 'Unknown',
        userEmail: salary?.userEmail || staffInfo?.email || 'Unknown',
        monthlySalaryCents: salary?.monthlySalaryCents || 0,
        totalCostCents,
        totalExpenses,
        pendingExpenses,
        netPayable: (salary?.monthlySalaryCents || 0) - totalExpenses,
        lastPayoutMonth: lastPayout ? `${lastPayout.month}/${lastPayout.year}` : undefined,
      };
    });

    return summaries.sort((a, b) => a.userName.localeCompare(b.userName));
  } catch (error) {
    console.error('Error calculating employee summaries:', error);
    return [];
  }
}

export async function createEmployeeSalary(data: {
  userId: string;
  userName: string;
  userEmail: string;
  monthlySalaryCents: number;
  visaCostCents?: number;
  visaMultiplier?: number;
  leaveSalaryCents?: number;
  leaveSalaryMultiplier?: number;
  ticketCostCents?: number;
  ticketMultiplier?: number;
  medicalInsuranceCents?: number;
  medicalInsuranceMultiplier?: number;
  accommodationCostCents?: number;
  accommodationMultiplier?: number;
  startDate: string;
}) {
  try {
    const salary: EmployeeSalary = {
      id: `salary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      monthlySalaryCents: data.monthlySalaryCents,
      visaCostCents: data.visaCostCents,
      visaMultiplier: data.visaMultiplier,
      leaveSalaryCents: data.leaveSalaryCents,
      leaveSalaryMultiplier: data.leaveSalaryMultiplier,
      ticketCostCents: data.ticketCostCents,
      ticketMultiplier: data.ticketMultiplier,
      medicalInsuranceCents: data.medicalInsuranceCents,
      medicalInsuranceMultiplier: data.medicalInsuranceMultiplier,
      accommodationCostCents: data.accommodationCostCents,
      accommodationMultiplier: data.accommodationMultiplier,
      startDate: data.startDate,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_salaries' },
    });

    let salaries: EmployeeSalary[] = [];
    if (setting?.value) {
      try {
        salaries = JSON.parse(setting.value);
      } catch (e) {
        console.error('Error parsing employee salaries:', e);
      }
    }

    // Update existing or add new
    const existingIndex = salaries.findIndex(s => s.userId === data.userId);
    if (existingIndex !== -1) {
      salaries[existingIndex] = salary;
    } else {
      salaries.unshift(salary);
    }

    await prisma.adminSetting.upsert({
      where: { key: 'employee_salaries' },
      update: {
        value: JSON.stringify(salaries),
        updatedAt: new Date(),
      },
      create: {
        id: `employee-salaries-${Date.now()}`,
        key: 'employee_salaries',
        value: JSON.stringify(salaries),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/employees');
    return { success: true, salary };
  } catch (error) {
    console.error('Error creating employee salary:', error);
    return { success: false, error: 'Failed to create employee salary' };
  }
}

export async function createEmployeeExpense(data: {
  employeeId: string;
  type: 'petty_cash' | 'deduction' | 'advance' | 'other';
  amountCents: number;
  description: string;
  category: string;
  date: string;
}) {
  try {
    const expense: EmployeeExpense = {
      id: `expense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      employeeId: data.employeeId,
      type: data.type,
      amountCents: data.amountCents,
      description: data.description,
      category: data.category,
      date: data.date,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_expenses' },
    });

    let expenses: EmployeeExpense[] = [];
    if (setting?.value) {
      try {
        expenses = JSON.parse(setting.value);
      } catch (e) {
        console.error('Error parsing employee expenses:', e);
      }
    }

    expenses.unshift(expense);

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

    // Get user information for email notification
    const user = await prisma.user.findUnique({
      where: { id: data.employeeId },
      select: { name: true, email: true },
    });

    if (user?.email) {
      await sendExpenseNotificationEmail({
        to: user.email,
        employeeName: user.name || 'Employee',
        expenseType: data.type,
        amountCents: data.amountCents,
        description: data.description,
        date: data.date,
      });
    }

    revalidatePath('/admin/employees');
    return { success: true, expense };
  } catch (error) {
    console.error('Error creating employee expense:', error);
    return { success: false, error: 'Failed to create employee expense' };
  }
}

export async function approveExpense(expenseId: string, approvedBy: string) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_expenses' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No expenses found' };
    }

    const expenses: EmployeeExpense[] = JSON.parse(setting.value);
    const expenseIndex = expenses.findIndex(e => e.id === expenseId);
    
    if (expenseIndex === -1) {
      return { success: false, error: 'Expense not found' };
    }

    expenses[expenseIndex].status = 'approved';
    expenses[expenseIndex].approvedAt = new Date().toISOString();
    expenses[expenseIndex].approvedBy = approvedBy;

    await prisma.adminSetting.update({
      where: { key: 'employee_expenses' },
      data: {
        value: JSON.stringify(expenses),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error) {
    console.error('Error approving expense:', error);
    return { success: false, error: 'Failed to approve expense' };
  }
}

export async function rejectExpense(expenseId: string) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_expenses' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No expenses found' };
    }

    const expenses: EmployeeExpense[] = JSON.parse(setting.value);
    const expenseIndex = expenses.findIndex(e => e.id === expenseId);
    
    if (expenseIndex === -1) {
      return { success: false, error: 'Expense not found' };
    }

    expenses[expenseIndex].status = 'rejected';

    await prisma.adminSetting.update({
      where: { key: 'employee_expenses' },
      data: {
        value: JSON.stringify(expenses),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error) {
    console.error('Error rejecting expense:', error);
    return { success: false, error: 'Failed to reject expense' };
  }
}

export async function deleteEmployeeExpense(expenseId: string) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_expenses' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No expenses found' };
    }

    const expenses: EmployeeExpense[] = JSON.parse(setting.value);
    const filteredExpenses = expenses.filter(e => e.id !== expenseId);

    await prisma.adminSetting.update({
      where: { key: 'employee_expenses' },
      data: {
        value: JSON.stringify(filteredExpenses),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error) {
    console.error('Error deleting employee expense:', error);
    return { success: false, error: 'Failed to delete employee expense' };
  }
}

export async function updateEmployeeExpense(expenseId: string, data: {
  amountCents?: number;
  description?: string;
  category?: string;
  date?: string;
}) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_expenses' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No expenses found' };
    }

    const expenses: EmployeeExpense[] = JSON.parse(setting.value);
    const expenseIndex = expenses.findIndex(e => e.id === expenseId);
    
    if (expenseIndex === -1) {
      return { success: false, error: 'Expense not found' };
    }

    if (data.amountCents !== undefined) {
      expenses[expenseIndex].amountCents = data.amountCents;
    }

    if (data.description !== undefined) {
      expenses[expenseIndex].description = data.description;
    }

    if (data.category !== undefined) {
      expenses[expenseIndex].category = data.category;
    }

    if (data.date !== undefined) {
      expenses[expenseIndex].date = data.date;
    }

    await prisma.adminSetting.update({
      where: { key: 'employee_expenses' },
      data: {
        value: JSON.stringify(expenses),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/employees');
    return { success: true, expense: expenses[expenseIndex] };
  } catch (error) {
    console.error('Error updating employee expense:', error);
    return { success: false, error: 'Failed to update employee expense' };
  }
}

export async function calculateMonthlyPayouts(month: string, year: number, workingDays?: number) {
  try {
    const [salaries, expenses, existingPayouts] = await Promise.all([
      getEmployeeSalaries(),
      getEmployeeExpenses(),
      getEmployeePayouts(),
    ]);

    // Use provided working days or default to 26
    const totalWorkingDays = workingDays || 26;

    // Fetch DriverDay records for all employees for this month (only CLOSED status)
    const driverDays = await prisma.driverDay.findMany({
      where: {
        date: {
          gte: new Date(year, parseInt(month) - 1, 1),
          lt: new Date(year, parseInt(month), 1),
        },
        status: 'CLOSED', // Only count completed days
      },
    });

    console.log(`[PayoutCalculation] Month: ${month}, Year: ${year}, Working Days: ${totalWorkingDays}`);
    console.log(`[PayoutCalculation] Date range: ${new Date(year, parseInt(month) - 1, 1).toISOString()} to ${new Date(year, parseInt(month), 1).toISOString()}`);
    console.log(`[PayoutCalculation] Found ${driverDays.length} DriverDay records`);
    driverDays.forEach(day => {
      console.log(`[PayoutCalculation] - Driver: ${day.driverId}, Date: ${day.date.toISOString()}, Status: ${day.status}`);
    });

    // Group driver days by employee and count unique dates (not total records)
    const daysWorkedByEmployee = new Map<string, Set<string>>();
    driverDays.forEach(day => {
      if (!daysWorkedByEmployee.has(day.driverId)) {
        daysWorkedByEmployee.set(day.driverId, new Set());
      }
      const dateStr = day.date.toISOString().split('T')[0]; // Use date string (YYYY-MM-DD) to count unique dates
      daysWorkedByEmployee.get(day.driverId)!.add(dateStr);
    });

    salaries.forEach(salary => {
      if (!salary.isActive) return;

      const employeeExpenses = expenses.filter(
        e => e.employeeId === salary.userId && 
             e.status === 'approved' &&
             new Date(e.date).getMonth() === new Date(`${year}-${month}-01`).getMonth() &&
             new Date(e.date).getFullYear() === year
      );

      const totalDeductions = employeeExpenses.reduce((sum, e) => sum + e.amountCents, 0);
      const daysWorked = daysWorkedByEmployee.get(salary.userId)?.size || 0;
      
      // Calculate pro-rated salary based on days worked
      const proRatedSalary = daysWorked > 0 
        ? (salary.monthlySalaryCents / totalWorkingDays) * daysWorked 
        : 0;
      
      const netSalary = proRatedSalary - totalDeductions;

      // Check if there's already a pending payout for this employee/month/year
      const existingPendingPayoutIndex = existingPayouts.findIndex(
        p => p.employeeId === salary.userId && 
             p.month === month && 
             p.year === year && 
             p.status === 'pending'
      );

      if (existingPendingPayoutIndex !== -1) {
        // Update existing pending payout
        existingPayouts[existingPendingPayoutIndex] = {
          ...existingPayouts[existingPendingPayoutIndex],
          grossSalaryCents: proRatedSalary,
          totalDeductionsCents: totalDeductions,
          netSalaryCents: netSalary,
          daysWorked,
          totalDays: totalWorkingDays,
        };
        console.log(`[PayoutCalculation] Updated existing pending payout for ${salary.userName}`);
      } else {
        // Create new pending payout
        const newPayout: EmployeePayout = {
          id: `payout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          employeeId: salary.userId,
          month,
          year,
          grossSalaryCents: proRatedSalary,
          totalDeductionsCents: totalDeductions,
          netSalaryCents: netSalary,
          daysWorked,
          totalDays: totalWorkingDays,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        existingPayouts.push(newPayout);
        console.log(`[PayoutCalculation] Created new pending payout for ${salary.userName}`);
      }
    });

    // Save updated payouts
    await prisma.adminSetting.upsert({
      where: { key: 'employee_payouts' },
      update: {
        value: JSON.stringify(existingPayouts),
        updatedAt: new Date(),
      },
      create: {
        id: `employee-payouts-${Date.now()}`,
        key: 'employee_payouts',
        value: JSON.stringify(existingPayouts),
        updatedAt: new Date(),
      },
    });

    revalidatePath('/admin/employees');
    return { success: true, payouts: existingPayouts };
  } catch (error) {
    console.error('Error calculating monthly payouts:', error);
    return { success: false, error: 'Failed to calculate monthly payouts' };
  }
}

export async function markPayoutAsPaid(payoutId: string, paidBy: string) {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'employee_payouts' },
    });

    if (!setting?.value) {
      return { success: false, error: 'No payouts found' };
    }

    const payouts: EmployeePayout[] = JSON.parse(setting.value);
    const payoutIndex = payouts.findIndex(p => p.id === payoutId);
    
    if (payoutIndex === -1) {
      return { success: false, error: 'Payout not found' };
    }

    payouts[payoutIndex].status = 'paid';
    payouts[payoutIndex].paidAt = new Date().toISOString();
    payouts[payoutIndex].paidBy = paidBy;

    await prisma.adminSetting.update({
      where: { key: 'employee_payouts' },
      data: {
        value: JSON.stringify(payouts),
        updatedAt: new Date(),
      },
    });

    // Get user information for email notification
    const user = await prisma.user.findUnique({
      where: { id: payouts[payoutIndex].employeeId },
      select: { name: true, email: true },
    });

    if (user?.email) {
      await sendPayoutPaidEmail({
        to: user.email,
        employeeName: user.name || 'Employee',
        month: payouts[payoutIndex].month,
        year: payouts[payoutIndex].year,
        netSalaryCents: payouts[payoutIndex].netSalaryCents,
        daysWorked: payouts[payoutIndex].daysWorked,
        totalDays: payouts[payoutIndex].totalDays,
      });
    }

    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error) {
    console.error('Error marking payout as paid:', error);
    return { success: false, error: 'Failed to mark payout as paid' };
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
