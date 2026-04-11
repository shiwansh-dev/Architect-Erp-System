import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing required payment parameters' },
        { status: 400 }
      );
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(text)
      .digest('hex');

    const isSignatureValid = generatedSignature === razorpay_signature;

    if (!isSignatureValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Payment verified successfully
    // You should update your database with the payment status here
    console.log('Payment verified:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error('Payment callback error:', error);
    return NextResponse.json(
      { error: 'Callback processing failed' },
      { status: 500 }
    );
  }
}

// Handle GET requests for redirect-based callbacks
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('razorpay_payment_id');
    const orderId = searchParams.get('razorpay_order_id');
    const signature = searchParams.get('razorpay_signature');

    if (paymentId && orderId && signature) {
      // Verify signature
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
      const text = `${orderId}|${paymentId}`;
      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(text)
        .digest('hex');

      const isSignatureValid = generatedSignature === signature;
      
      if (isSignatureValid) {
        // Redirect to payment success page
        const redirectUrl = `/billing/payment-success?paymentId=${paymentId}&orderId=${orderId}`;
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      } else {
        // Invalid signature - redirect back to billing with error
        const redirectUrl = `/billing?status=failure`;
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }

    return NextResponse.json({
      message: 'Payment callback received',
    });
  } catch (error) {
    console.error('Payment callback error:', error);
    return NextResponse.json(
      { error: 'Callback processing failed' },
      { status: 500 }
    );
  }
}
