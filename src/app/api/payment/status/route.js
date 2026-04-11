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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const orderId = searchParams.get('orderId');

    if (!paymentId && !orderId) {
      return NextResponse.json(
        { error: 'Payment ID or Order ID is required' },
        { status: 400 }
      );
    }

    if (!razorpay) {
      return NextResponse.json(
        { error: 'Razorpay SDK not properly initialized' },
        { status: 500 }
      );
    }

    let paymentData;
    let orderData;

    // Fetch payment details if paymentId is provided
    if (paymentId) {
      try {
        paymentData = await razorpay.payments.fetch(paymentId);
      } catch (error) {
        console.error('Error fetching payment:', error);
      }
    }

    // Fetch order details if orderId is provided
    if (orderId) {
      try {
        orderData = await razorpay.orders.fetch(orderId);
      } catch (error) {
        console.error('Error fetching order:', error);
      }
    }

    if (!paymentData && !orderData) {
      return NextResponse.json(
        { error: 'Payment or order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      payment: paymentData || null,
      order: orderData || null,
      status: paymentData?.status || orderData?.status || 'unknown',
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check payment status' },
      { status: 500 }
    );
  }
}
