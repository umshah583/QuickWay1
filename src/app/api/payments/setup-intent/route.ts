import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import stripe from '@/lib/stripe';

// POST - Create a setup intent for saving a payment method
export async function POST(request: NextRequest) {
  try {
    console.log('[SETUP_INTENT] Starting setup intent creation...');

    // Try mobile auth first, then web auth
    const mobileUser = await getMobileUserFromRequest(request);
    const session = await getServerSession(authOptions);

    console.log('[SETUP_INTENT] Mobile user:', mobileUser ? 'present' : 'null');
    console.log('[SETUP_INTENT] Web session:', session ? 'present' : 'null');

    // Extract user ID from mobile user (sub) or web session (id)
    const userId = mobileUser?.sub || session?.user?.id;
    if (!userId) {
      console.error('[SETUP_INTENT] No user ID found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[SETUP_INTENT] User ID:', userId);

    // Get user details from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    });

    if (!user) {
      console.error('[SETUP_INTENT] User not found in database:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[SETUP_INTENT] User found:', user.email);

    // Check if Stripe is configured
    if (!stripe) {
      console.error('[SETUP_INTENT] Stripe not configured');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    // Create or retrieve Stripe customer
    let customerId;

    try {
      console.log('[SETUP_INTENT] Checking for existing Stripe customer...');
      // Try to find existing customer by email
      const customers = await stripe.customers.list({ email: user.email || undefined, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log('[SETUP_INTENT] Found existing customer:', customerId);
      } else {
        console.log('[SETUP_INTENT] Creating new customer...');
        // Create new customer
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.name || undefined,
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;
        console.log('[SETUP_INTENT] Created new customer:', customerId);
      }
    } catch (stripeError) {
      console.error('[SETUP_INTENT] Stripe customer error:', stripeError);
      return NextResponse.json({
        error: 'Failed to create customer',
        details: stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error'
      }, { status: 500 });
    }

    console.log('[SETUP_INTENT] Creating setup intent...');
    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // For future payments
    });

    console.log('[SETUP_INTENT] Setup intent created:', setupIntent.id);

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customerId,
    });
  } catch (error) {
    console.error('[SETUP_INTENT] Unexpected error:', error);
    return NextResponse.json({
      error: 'Failed to create setup intent',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
