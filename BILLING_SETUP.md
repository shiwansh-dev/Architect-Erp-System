# Billing & Payment Integration Setup

This document explains how to set up the Razorpay Payment Gateway integration for the billing page.

## Prerequisites

1. Razorpay Merchant Account
2. API Key ID and API Key Secret from Razorpay Dashboard
3. Node.js v14 or higher

## Installation

Install the Razorpay Node.js SDK:

```bash
npm install razorpay
```

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Razorpay Payment Gateway Configuration
RAZORPAY_KEY_ID=YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
# Webhook secret is optional but recommended for production

# Base URL for redirects and callbacks
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# Update this to your production URL when deploying
```

## Getting Razorpay Credentials

1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Navigate to Settings > API Keys
3. Generate Test/Live API Keys
4. Copy your Key ID and Key Secret
5. For webhooks, go to Settings > Webhooks and configure your webhook URL
6. Copy the webhook secret for signature verification

## Features

### Billing Page (`/billing`)

- Customer information form
- Dynamic item list with quantity and pricing
- Automatic GST calculation (18%)
- Real-time total calculation
- Razorpay payment integration with checkout modal

### API Routes

1. **`/api/payment/initiate`** - Creates a Razorpay order and returns order details
2. **`/api/payment/callback`** - Handles payment callbacks and verifies signatures
3. **`/api/payment/status`** - Checks payment status by payment ID or order ID

## Usage

1. Navigate to `/billing` page
2. Fill in customer details (Name, Email, Phone are required)
3. Add items with description, quantity, and price
4. Review the payment summary
5. Click "Proceed to Payment"
6. Razorpay checkout modal will open
7. Complete payment using any supported payment method
8. After payment, you'll be redirected back with payment status

## Testing

### Test Mode

1. Use Test API Keys from Razorpay Dashboard
2. Use test payment methods provided by Razorpay

### Test Cards (Sandbox)

Razorpay provides test cards for different scenarios:

**Success Cards:**
- Card Number: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date
- Name: Any name

**Failure Cards:**
- Card Number: `4000 0000 0000 0002`
- This will simulate a payment failure

**3D Secure Cards:**
- Card Number: `4012 0010 3714 1112`
- This will trigger 3D Secure authentication

## Payment Flow

1. User fills billing form and clicks "Proceed to Payment"
2. Frontend calls `/api/payment/initiate` with payment details
3. Backend creates a Razorpay order using Razorpay SDK
4. Backend returns order details (order ID, amount, key ID)
5. Frontend initializes Razorpay Checkout with order details
6. Razorpay checkout modal opens
7. User completes payment on Razorpay
8. Razorpay redirects back to `/billing?status={status}&paymentId={id}&orderId={id}`
9. Frontend displays payment status
10. Razorpay also sends webhook to `/api/payment/callback` (if configured)

## Security Notes

- Never commit `.env.local` to version control
- Always verify webhook signatures in production using `RAZORPAY_WEBHOOK_SECRET`
- Store transaction details in database for audit
- Implement proper error handling and logging
- Use HTTPS in production
- Verify payment signatures on the server side before updating order status

## Signature Verification

Razorpay uses HMAC SHA256 for signature verification. The signature is generated using:
- Order ID + Payment ID (for payment verification)
- Webhook secret (for webhook verification)

Always verify signatures server-side before processing payments.

## References

- [Razorpay Node.js SDK Documentation](https://razorpay.com/docs/api/node/)
- [Razorpay Checkout Integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
- [Razorpay Webhooks](https://razorpay.com/docs/webhooks/)
- [Razorpay Test Cards](https://razorpay.com/docs/payments/payment-gateway/test-cards/)

## Troubleshooting

### Payment not initiating
- Check environment variables are set correctly
- Verify Key ID and Key Secret
- Check network connectivity
- Review server logs for errors
- Ensure Razorpay Checkout script is loaded

### Checkout modal not opening
- Check if Razorpay Checkout script is loaded
- Verify browser console for JavaScript errors
- Ensure order creation was successful
- Check if Key ID is correct

### Payment verification failed
- Verify webhook secret is correct
- Check signature generation logic
- Ensure you're using the correct order ID and payment ID
- Review Razorpay dashboard for payment status

### Redirect not working
- Ensure `NEXT_PUBLIC_BASE_URL` is set correctly
- Check redirect URLs in Razorpay dashboard
- Verify callback URLs are whitelisted
- Check browser console for errors

### SDK import errors
- Verify package is installed: `npm list razorpay`
- Check Node.js version (v14+ required)
- Try reinstalling: `npm install razorpay`
- Clear `.next` cache and rebuild
