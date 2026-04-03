import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import stripe from '@/lib/stripe';
import { z } from 'zod';

const createPaymentMethodSchema = z.object({
  type: z.enum(['CARD', 'APPLE_PAY', 'GOOGLE_PAY']),
  last4: z.string().trim().min(4).max(4),
  brand: z.string().trim().min(1).max(50),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 20),
  stripePaymentMethodId: z.string().trim().min(1),
  // Optional card details for creating Stripe payment method
  cardNumber: z.string().optional(),
  cvc: z.string().optional(),
  postalCode: z.string().optional(),
});

// GET - Fetch user's saved payment methods
export async function GET(request: NextRequest) {
  try {
    // Try mobile auth first, then web auth
    const mobileUser = await getMobileUserFromRequest(request);
    const session = await getServerSession(authOptions);
    
    // Extract user ID from mobile user (sub) or web session (id)
    const userId = mobileUser?.sub || session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paymentMethods = await prisma.savedPaymentMethod.findMany({
      where: {
        userId: userId,
        isActive: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error('[PAYMENT_METHODS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 });
  }
}

// POST - Add a new saved payment method
export async function POST(request: NextRequest) {
  try {
    // Try mobile auth first, then web auth
    const mobileUser = await getMobileUserFromRequest(request);
    const session = await getServerSession(authOptions);
    
    // Extract user ID from mobile user (sub) or web session (id)
    const userId = mobileUser?.sub || session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createPaymentMethodSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error }, { status: 400 });
    }

    const { cardNumber, cvc, postalCode, ...paymentMethodData } = parsed.data;

    // For PCI compliance, we expect the payment method to already be tokenized by Stripe
    // The frontend should create the payment method using Stripe's CardField
    if (cardNumber || cvc || postalCode) {
      console.log('[PAYMENT_METHODS_POST] Warning: Received raw card data - this should be tokenized on frontend');
      return NextResponse.json({
        error: 'Raw card data not accepted. Use Stripe tokenization on frontend.'
      }, { status: 400 });
    }

    console.log('[PAYMENT_METHODS_POST] Attaching payment method:', paymentMethodData.stripePaymentMethodId);

    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find existing customer or create new one
    const customers = await stripe.customers.list({
      email: user.email || undefined,
      limit: 1
    });
    let customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.name || undefined,
      });
    }

    // Attach the pre-tokenized payment method to the customer
    try {
      await stripe.paymentMethods.attach(paymentMethodData.stripePaymentMethodId, {
        customer: customer.id,
      });
      console.log('[PAYMENT_METHODS_POST] Payment method attached to customer');
    } catch (attachError) {
      console.error('[PAYMENT_METHODS_POST] Failed to attach payment method:', attachError);
      return NextResponse.json({
        error: 'Failed to attach payment method to customer'
      }, { status: 500 });
    }

    // Create database record
    const paymentMethod = await prisma.savedPaymentMethod.create({
      data: {
        id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
        type: paymentMethodData.type,
        last4: paymentMethodData.last4,
        brand: paymentMethodData.brand,
        expiryMonth: paymentMethodData.expiryMonth,
        expiryYear: paymentMethodData.expiryYear,
        stripePaymentMethodId: paymentMethodData.stripePaymentMethodId,
        userId: userId,
        isDefault: false, // New payment methods start as non-default
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('[PAYMENT_METHODS_POST] Database record created:', paymentMethod.id);

    return NextResponse.json({ paymentMethod }, { status: 201 });
  } catch (error) {
    console.error('[PAYMENT_METHODS_POST]', error);
    return NextResponse.json({ error: 'Failed to add payment method' }, { status: 500 });
  }
}
