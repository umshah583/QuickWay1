import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[Stripe Test] Testing Stripe connectivity...');

    // Test basic Stripe API connectivity
    const account = await stripe.accounts.retrieve();
    
    console.log('[Stripe Test] Stripe connectivity successful:', {
      accountId: account.id,
      country: account.country
    });

    res.status(200).json({ 
      success: true,
      message: 'Stripe API is working',
      stripeInfo: {
        accountId: account.id,
        country: account.country,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled
      }
    });

  } catch (error) {
    console.error('[Stripe Test] Stripe connectivity failed:', error);
    
    res.status(500).json({ 
      success: false,
      error: error.message,
      type: error.type
    });
  }
}
