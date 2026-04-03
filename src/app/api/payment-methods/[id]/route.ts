import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updatePaymentMethodSchema = z.object({
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// PUT - Update a payment method (set as default, deactivate, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Try mobile auth first, then web auth
    const mobileUser = await getMobileUserFromRequest(request);
    const session = await getServerSession(authOptions);
    
    // Extract user ID from mobile user (sub) or web session (id)
    const userId = mobileUser?.sub || session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updatePaymentMethodSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error }, { status: 400 });
    }

    const { isDefault, isActive } = parsed.data;

    // Check if payment method belongs to user
    const existingMethod = await prisma.savedPaymentMethod.findFirst({
      where: {
        id,
        userId: userId,
      },
    });

    if (!existingMethod) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // If setting as default, unset other default methods
    if (isDefault) {
      await prisma.savedPaymentMethod.updateMany({
        where: {
          userId: userId,
          id: { not: id },
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Update the payment method
    const updatedMethod = await prisma.savedPaymentMethod.update({
      where: { id },
      data: {
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ paymentMethod: updatedMethod });
  } catch (error) {
    console.error('[PAYMENT_METHOD_PUT]', error);
    return NextResponse.json({ error: 'Failed to update payment method' }, { status: 500 });
  }
}

// DELETE - Remove a payment method
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Try mobile auth first, then web auth
    const mobileUser = await getMobileUserFromRequest(request);
    const session = await getServerSession(authOptions);
    
    // Extract user ID from mobile user (sub) or web session (id)
    const userId = mobileUser?.sub || session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if payment method belongs to user
    const existingMethod = await prisma.savedPaymentMethod.findFirst({
      where: {
        id,
        userId: userId,
      },
    });

    if (!existingMethod) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // Don't allow deletion if it's the only active payment method
    const activeMethodsCount = await prisma.savedPaymentMethod.count({
      where: {
        userId: userId,
        isActive: true,
      },
    });

    if (activeMethodsCount <= 1) {
      return NextResponse.json({ 
        error: 'Cannot remove the only payment method. Add another one first.' 
      }, { status: 400 });
    }

    // Soft delete by setting isActive to false
    await prisma.savedPaymentMethod.update({
      where: { id },
      data: { isActive: false },
    });

    // If this was the default, set another one as default
    if (existingMethod.isDefault) {
      const newDefault = await prisma.savedPaymentMethod.findFirst({
        where: {
          userId: userId,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (newDefault) {
        await prisma.savedPaymentMethod.update({
          where: { id: newDefault.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PAYMENT_METHOD_DELETE]', error);
    return NextResponse.json({ error: 'Failed to remove payment method' }, { status: 500 });
  }
}
