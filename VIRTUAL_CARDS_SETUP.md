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

You should already have this from KYC setup, but verify:

1. Go to **Developers** → **API keys** in the Stripe Dashboard
2. Copy your **Secret key** (starts with `sk_test_`)
3. Add it to your `.env` file:
   ```
   STRIPE_SECRET_KEY=sk_test_your_key_here
   ```

**Note**: You do not need the publishable key.
Every Stripe call in this app happens server side, so nothing in the code reads a `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and it is not listed in `.env.example`.

## Step 3: Configure Webhook Endpoint

Issuing events need their own endpoint.
This app has two separate Stripe webhook routes, and each one only handles its own family of events:

| Route | Handles |
| --- | --- |
| `/api/webhooks/stripe-identity` | `identity.verification_session.*` |
| `/api/webhooks/stripe-issuing` | `issuing_card.*`, `issuing_authorization.*`, `issuing_transaction.*` |

Pointing Issuing events at the Identity route does nothing - that handler logs them as unhandled and returns.

1. Go to **Developers** → **Webhooks** in the Stripe Dashboard
2. Click **Add endpoint**
3. Enter: `https://yourdomain.com/api/webhooks/stripe-issuing`
4. Select the **Issuing** events:
   - `issuing_card.created`
   - `issuing_card.updated`
   - `issuing_authorization.created`
   - `issuing_authorization.updated`
   - `issuing_transaction.created`
   - `issuing_transaction.updated`
5. Save changes

**Note**: Both handlers read the same `STRIPE_WEBHOOK_SECRET` environment variable.
The Stripe Dashboard issues a *different* signing secret per endpoint, so if you register both endpoints in the Dashboard, only the one whose secret matches `STRIPE_WEBHOOK_SECRET` will pass signature verification.
Supporting both deployed endpoints would need a second variable, for example `STRIPE_ISSUING_WEBHOOK_SECRET`.
This is not a problem locally: the Stripe CLI uses one signing secret per account for every `stripe listen` session (see Step 4).

## Step 4: Set up Stripe CLI for Local Testing

For local development, use the Stripe CLI to forward webhooks:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward the Issuing events to your local server:
   ```bash
   stripe listen \
     --events issuing_card.created,issuing_card.updated,issuing_authorization.created,issuing_authorization.updated,issuing_transaction.created,issuing_transaction.updated \
     --forward-to localhost:3000/api/webhooks/stripe-issuing
   ```
4. Copy the webhook signing secret from the CLI output
5. Use it as your `STRIPE_WEBHOOK_SECRET` in `.env`

**Note**: `--forward-to` accepts exactly one destination, so you cannot list two routes in a single command.
This app has two Stripe webhook routes, so run a second `stripe listen` in another terminal for Identity:

```bash
stripe listen \
  --events identity.verification_session.verified,identity.verification_session.requires_input,identity.verification_session.canceled,identity.verification_session.processing \
  --forward-to localhost:3000/api/webhooks/stripe-identity
```

The `--events` filters are what keep each listener pointed at the route that actually handles those events.
Both listeners print the same signing secret for a given Stripe account, so one `STRIPE_WEBHOOK_SECRET` covers both.

## Step 5: Add Test Funds (Issuing Balance)

Before you can create cards, you need to add test funds to your Issuing balance:

1. Go to **Issuing** → **Balance** in the Stripe Dashboard
2. Click **Add funds**
3. In test mode, you can add any amount (e.g., $10,000)
4. Confirm the top-up

## Step 6: Apply the Database Schema

Set both `DATABASE_URL` and `DIRECT_URL` in `.env` before running this.
Prisma Migrate runs its DDL over `DIRECT_URL`, the unpooled port 5432 connection, and fails if only the pooled `DATABASE_URL` is set.

```bash
pnpm prisma migrate deploy
```

## Step 7: Test Card Creation

1. Navigate to `/cards` in your application
2. Click **Create Virtual Card**
3. Fill in the required information:
   - Date of birth
   - Billing address (street, city, state, ZIP)
   - Optional: card nickname, per-transaction and monthly spending limits, phone number
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

### "First name and last name are required. Please update your profile."
- **Cause**: The card form does not ask for your name - `/api/cards/create` reads `firstName` and `lastName` off your user record, and they are still empty
- **Solution**: Make sure your user row in the database has both names set (they are captured at registration)

### "Could not create cardholder with the details provided"
- **Cause**: Stripe rejected the cardholder details, usually the date of birth or the billing address
- **Solution**: Re-check the date of birth and address you entered on the form

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
- [ ] `STRIPE_SECRET_KEY` configured in `.env` (same as Identity setup)
- [ ] Webhook endpoint configured for Issuing events
- [ ] `STRIPE_WEBHOOK_SECRET` added to `.env`
- [ ] Stripe CLI running for local webhook forwarding
- [ ] Test funds added to Issuing balance
- [ ] `DATABASE_URL` and `DIRECT_URL` set, schema applied (`pnpm prisma migrate deploy`)
- [ ] Card creation successful
- [ ] Card details can be revealed (full number + CVC)
- [ ] Card can be frozen/unfrozen
- [ ] Spending limits can be updated
- [ ] Test transaction created in Stripe Dashboard
- [ ] Transaction appears in app and updates balance

## Production Considerations

This project is a portfolio demo and is only meant to run against Stripe test mode.
The list below is what a real card program would additionally need, not a checklist anyone should follow with this codebase.

1. Apply for Stripe Issuing access (requires business verification)
2. Switch to production API keys (`sk_live_`)
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
