export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    console.log('🚨 Emergency Order Creation - Bypassing Stripe');
    
    const { orderId, amount, paymentMethod, paymentStatus, notes } = req.body;

    // Validate required fields
    if (!orderId) {
      return res.status(400).json({ 
        error: 'Missing orderId',
        message: 'Order ID is required'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid amount',
        message: 'Amount must be greater than 0'
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({ 
        error: 'Missing paymentMethod',
        message: 'Payment method is required'
      });
    }

    console.log('🚨 Emergency Order Data:', {
      orderId: orderId.substring(0, 20) + '...',
      amount: amount,
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus || 'pending'
    });

    // Since we're bypassing the database for now, create a mock order response
    // In a real implementation, you would save to your database
    const mockOrder = {
      id: orderId,
      amount: amount,
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus || 'pending',
      status: 'confirmed',
      notes: notes || 'Emergency payment bypass - Stripe API unavailable',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Log the order for manual processing if needed
    console.log('🚨 Emergency Order Created:', mockOrder);

    // Return success response
    res.status(200).json({ 
      success: true,
      orderId: mockOrder.id,
      order: mockOrder,
      message: 'Emergency order created successfully'
    });

  } catch (error) {
    console.error('🚨 Emergency Order Creation Failed:', error);
    
    res.status(500).json({ 
      error: 'Emergency order creation failed',
      message: 'An unexpected error occurred while creating your order'
    });
  }
}
