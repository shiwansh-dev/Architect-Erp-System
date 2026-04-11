# Razorpay Environment Variables Setup

Add the following environment variables to your `.env.local` file:

```env
# Razorpay Payment Gateway Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

## How to Get Razorpay Credentials

1. **Sign up/Login** to [Razorpay Dashboard](https://dashboard.razorpay.com/)

2. **Get Test Keys** (for development):
   - Go to Settings → API Keys
   - Click on "Generate Test Key" if you don't have one
   - Copy the **Key ID** and **Key Secret**

3. **Get Live Keys** (for production):
   - Complete KYC verification
   - Go to Settings → API Keys
   - Generate Live Keys
   - Copy the **Key ID** and **Key Secret**

4. **Webhook Secret** (optional but recommended):
   - Go to Settings → Webhooks
   - Add your webhook URL: `https://yourdomain.com/api/payment/callback`
   - Copy the **Webhook Secret**

## Example `.env.local` file:

```env
# Database
MONGODB_URI=your_mongodb_uri

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Important Notes:

- **Never commit** `.env.local` to version control
- Use **Test Keys** for development
- Use **Live Keys** only in production
- Restart your development server after adding environment variables
- The webhook secret is optional but recommended for production

## Test Credentials:

For testing, you can use Razorpay's test mode. The test keys will start with `rzp_test_`.

Test Card Details:
- Card Number: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date
- Name: Any name




