import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    console.log('[Stripe Proxy] Creating payment intent');
    
    const { amount, currency = 'usd', metadata = {} } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid amount',
        message: 'Amount must be greater than 0'
      });
    }

    // Convert amount to cents (Stripe expects amount in smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    console.log('[Stripe Proxy] Creating payment intent:', {
      amount: amountInCents,
      currency,
      metadata
    });

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      metadata: metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('[Stripe Proxy] Payment intent created successfully:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    });

    res.status(200).json({ 
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status
    });

  } catch (error) {
    console.error('[Stripe Proxy] Payment intent creation failed:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ 
        error: 'Card error',
        message: error.message,
        code: error.code
      });
    }

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: error.message,
        code: error.code
      });
    }

    if (error.type === 'StripeAPIError') {
      return res.status(500).json({ 
        error: 'Stripe API error',
        message: 'Payment processing service temporarily unavailable'
      });
    }

    if (error.type === 'StripeConnectionError') {
      return res.status(500).json({ 
        error: 'Connection error',
        message: 'Unable to connect to payment service'
      });
    }

    if (error.type === 'StripeAuthenticationError') {
      return res.status(500).json({ 
        error: 'Authentication error',
        message: 'Payment service authentication failed'
      });
    }

    // Generic error
    res.status(500).json({ 
      error: 'Payment intent creation failed',
      message: 'An unexpected error occurred while creating payment intent'
    });
  }
}
