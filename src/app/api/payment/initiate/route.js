import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

// Initialize Razorpay
let razorpay;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  try {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  } catch (error) {
    console.error('Razorpay initialization error:', error);
  }
} else {
  console.warn('Razorpay credentials not found. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      amount,
      customerName,
      customerEmail,
      customerPhone,
      billingAddress,
      items,
    } = body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (!customerName || !customerEmail || !customerPhone) {
      return NextResponse.json(
        { error: 'Customer details are required' },
        { status: 400 }
      );
    }

    if (!razorpay) {
      const missingVars = [];
      if (!RAZORPAY_KEY_ID) missingVars.push('RAZORPAY_KEY_ID');
      if (!RAZORPAY_KEY_SECRET) missingVars.push('RAZORPAY_KEY_SECRET');
      
      return NextResponse.json(
        { 
          error: 'Razorpay SDK not properly initialized. Please check your configuration.',
          details: missingVars.length > 0 
            ? `Missing environment variables: ${missingVars.join(', ')}. Please add them to .env.local`
            : 'Razorpay credentials are missing or invalid'
        },
        { status: 500 }
      );
    }

    // Generate unique receipt ID
    const receiptId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create order options
    const orderOptions = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: receiptId,
      notes: {
        customerName,
        customerEmail,
        customerPhone,
        billingAddress: billingAddress || '',
        items: JSON.stringify(items || []),
      },
    };

    // Create Razorpay order
    const order = await razorpay.orders.create(orderOptions);

    // Return order details for client-side checkout
    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      keyId: process.env.RAZORPAY_KEY_ID,
      customerName,
      customerEmail,
      customerPhone,
      message: 'Order created successfully',
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
