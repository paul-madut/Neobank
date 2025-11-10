# Virtual Cards Setup Guide

This guide will help you set up Stripe Issuing for virtual card functionality.

## Prerequisites

1. A Stripe account (create at https://stripe.com)
2. KYC verification enabled (already set up)
3. Test mode enabled for development

## Step 1: Enable Stripe Issuing

1. Go to the Stripe Dashboard: https://dashboard.stripe.com
2. Navigate to **Issuing** in the left sidebar
3. Click **Get Started** and follow the onboarding process
4. Fill out the required business information
5. Accept the terms and conditions

**Note**: In test mode, you can issue cards immediately without waiting for approval.

## Step 2: Get Stripe API Keys

You should already have these from KYC setup, but verify:

1. Go to **Developers** → **API keys** in the Stripe Dashboard
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
4. Add them to your `.env` file:
   ```
   STRIPE_SECRET_KEY=sk_test_your_key_here
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
   ```

## Step 3: Configure Webhook Endpoint

You can use the same webhook endpoint and secret for both Identity and Issuing events.

**Option A: Add Issuing events to existing webhook**
1. Go to **Developers** → **Webhooks** in the Stripe Dashboard
2. Click on your existing webhook endpoint
3. Click **Add events**
4. Select **Issuing** events:
   - `issuing_card.created`
   - `issuing_card.updated`
   - `issuing_authorization.created`
   - `issuing_authorization.updated`
   - `issuing_transaction.created`
   - `issuing_transaction.updated`
5. Save changes

**Option B: Create separate webhook endpoint** (optional)
1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter: `https://yourdomain.com/api/webhooks/stripe-issuing`
4. Select the Issuing events listed above
5. Use the same `STRIPE_WEBHOOK_SECRET` from your existing webhook

**Note**: Both webhook handlers (`/api/webhooks/stripe` and `/api/webhooks/stripe-issuing`) use the same `STRIPE_WEBHOOK_SECRET` environment variable.

## Step 4: Set up Stripe CLI for Local Testing

For local development, use the Stripe CLI to forward webhooks:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe-issuing
   ```
4. Copy the webhook signing secret from the CLI output
5. Use it as your `STRIPE_WEBHOOK_SECRET` in `.env`

**Note**: If you're already using Stripe CLI for Identity webhooks, you can forward to both endpoints:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe,localhost:3000/api/webhooks/stripe-issuing
```

## Step 5: Add Test Funds (Issuing Balance)

Before you can create cards, you need to add test funds to your Issuing balance:

1. Go to **Issuing** → **Balance** in the Stripe Dashboard
2. Click **Add funds**
3. In test mode, you can add any amount (e.g., $10,000)
4. Confirm the top-up

## Step 6: Update Database Schema

Run the Prisma migration to add the virtual cards schema:

```bash
pnpm prisma db push
```

## Step 7: Test Card Creation

1. Navigate to `/cards` in your application
2. Click **Create Virtual Card**
3. Fill in the required information:
   - Date of birth
   - Billing address
   - Optional: Spending limits, card nickname
4. Submit the form

The card should be created instantly in test mode!

## Step 8: Simulate Card Transactions

To test card transactions in the Stripe Dashboard:

1. Go to **Issuing** → **Cards**
2. Find your test card
3. Click on the card
4. Click **Create test purchase**
5. Fill in transaction details (amount, merchant, etc.)
6. Submit

The transaction will appear in your app's transaction history and update your account balance.

## Common Issues

### "Failed to create cardholder"
- **Cause**: Missing or invalid cardholder information
- **Solution**: Ensure you provide valid first name, last name, date of birth, and address

### "Failed to create card"
- **Cause**: No funds in Issuing balance
- **Solution**: Add test funds to your Stripe Issuing balance (Step 5)

### "Webhook signature verification failed"
- **Cause**: Incorrect webhook secret
- **Solution**: Double-check that `STRIPE_WEBHOOK_SECRET` matches the webhook secret from Stripe CLI or Dashboard

### Cards not showing transactions
- **Cause**: Webhook endpoint not configured or not receiving events
- **Solution**: Verify webhook configuration and use Stripe CLI for local testing

## Testing Checklist

- [ ] Stripe Issuing enabled in Dashboard
- [ ] API keys configured in `.env` (same as Identity setup)
- [ ] Webhook endpoint configured for Issuing events
- [ ] `STRIPE_WEBHOOK_SECRET` added to `.env`
- [ ] Stripe CLI running for local webhook forwarding
- [ ] Test funds added to Issuing balance
- [ ] Database schema updated (`pnpm prisma db push`)
- [ ] Card creation successful
- [ ] Card details can be revealed (full number + CVC)
- [ ] Card can be frozen/unfrozen
- [ ] Spending limits can be updated
- [ ] Test transaction created in Stripe Dashboard
- [ ] Transaction appears in app and updates balance

## Production Considerations

When moving to production:

1. Apply for Stripe Issuing access (requires business verification)
2. Switch to production API keys (`sk_live_`, `pk_live_`)
3. Update webhook endpoint to production URL
4. Set up proper card program with a partner bank
5. Implement fraud monitoring and alerts
6. Add cardholder verification (beyond basic KYC)
7. Set up real-time authorization decisioning

## Additional Resources

- [Stripe Issuing Documentation](https://stripe.com/docs/issuing)
- [Stripe Issuing API Reference](https://stripe.com/docs/api/issuing)
- [Testing Stripe Issuing](https://stripe.com/docs/issuing/testing)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
