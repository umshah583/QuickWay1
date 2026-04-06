import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    console.log('[Stripe Proxy] Payment confirmation request received');
    
    const { paymentIntentId, paymentMethodId } = req.body;

    // Validate required fields
    if (!paymentIntentId) {
      return res.status(400).json({ 
        error: 'Missing paymentIntentId',
        message: 'Payment Intent ID is required'
      });
    }

    if (!paymentMethodId) {
      return res.status(400).json({ 
        error: 'Missing paymentMethodId', 
        message: 'Payment Method ID is required'
      });
    }

    console.log('[Stripe Proxy] Confirming payment:', {
      paymentIntentId: paymentIntentId.substring(0, 20) + '...',
      paymentMethodId: paymentMethodId.substring(0, 20) + '...'
    });

    // Confirm the payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    console.log('[Stripe Proxy] Payment confirmed successfully:', {
      status: paymentIntent.status,
      id: paymentIntent.id
    });

    // Return success response
    res.status(200).json({ 
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        created: paymentIntent.created
      }
    });

  } catch (error) {
    console.error('[Stripe Proxy] Payment confirmation failed:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ 
        error: 'Card declined',
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
      error: 'Payment confirmation failed',
      message: 'An unexpected error occurred while processing your payment'
    });
  }
}
