import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
})

export interface CreateCardholderParams {
  email: string
  firstName: string
  lastName: string
  phoneNumber?: string
  dateOfBirth: {
    day: number
    month: number
    year: number
  }
  address: {
    line1: string
    city: string
    state: string
    postalCode: string
    country: string
  }
}

export interface CreateCardParams {
  cardholderId: string
  currency?: string
  spendingLimit?: number
  monthlyLimit?: number
}

/**
 * Create a Stripe Issuing cardholder
 */
export async function createCardholder(params: CreateCardholderParams) {
  try {
    const cardholder = await stripe.issuing.cardholders.create({
      name: `${params.firstName} ${params.lastName}`,
      email: params.email,
      phone_number: params.phoneNumber,
      type: 'individual',
      individual: {
        first_name: params.firstName,
        last_name: params.lastName,
        dob: {
          day: params.dateOfBirth.day,
          month: params.dateOfBirth.month,
          year: params.dateOfBirth.year,
        },
      },
      billing: {
        address: {
          line1: params.address.line1,
          city: params.address.city,
          state: params.address.state,
          postal_code: params.address.postalCode,
          country: params.address.country,
        },
      },
    })

    return {
      success: true,
      cardholderId: cardholder.id,
      cardholder,
    }
  } catch (error) {
    console.error('Error creating Stripe cardholder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create cardholder',
    }
  }
}

/**
 * Create a virtual card
 */
export async function createVirtualCard(params: CreateCardParams) {
  try {
    const cardParams: Stripe.Issuing.CardCreateParams = {
      cardholder: params.cardholderId,
      currency: params.currency || 'usd',
      type: 'virtual',
      status: 'active',
    }

    // Add spending controls if provided
    if (params.spendingLimit || params.monthlyLimit) {
      cardParams.spending_controls = {
        spending_limits: [],
      }

      if (params.spendingLimit) {
        cardParams.spending_controls.spending_limits.push({
          amount: Math.round(params.spendingLimit * 100), // Convert to cents
          interval: 'per_authorization',
        })
      }

      if (params.monthlyLimit) {
        cardParams.spending_controls.spending_limits.push({
          amount: Math.round(params.monthlyLimit * 100), // Convert to cents
          interval: 'monthly',
        })
      }
    }

    const card = await stripe.issuing.cards.create(cardParams)

    return {
      success: true,
      cardId: card.id,
      last4: card.last4,
      brand: card.brand,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      status: card.status,
      card,
    }
  } catch (error) {
    console.error('Error creating virtual card:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create card',
    }
  }
}

/**
 * Update card status (freeze/unfreeze/cancel)
 */
export async function updateCardStatus(
  cardId: string,
  status: 'active' | 'inactive' | 'canceled'
) {
  try {
    const card = await stripe.issuing.cards.update(cardId, { status })

    return {
      success: true,
      status: card.status,
      card,
    }
  } catch (error) {
    console.error('Error updating card status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update card status',
    }
  }
}

/**
 * Update card spending limits
 */
export async function updateCardSpendingLimits(
  cardId: string,
  spendingLimit?: number,
  monthlyLimit?: number
) {
  try {
    const spendingLimits: Stripe.Issuing.CardUpdateParams.SpendingControls.SpendingLimit[] = []

    if (spendingLimit) {
      spendingLimits.push({
        amount: Math.round(spendingLimit * 100),
        interval: 'per_authorization',
      })
    }

    if (monthlyLimit) {
      spendingLimits.push({
        amount: Math.round(monthlyLimit * 100),
        interval: 'monthly',
      })
    }

    const card = await stripe.issuing.cards.update(cardId, {
      spending_controls: {
        spending_limits: spendingLimits,
      },
    })

    return {
      success: true,
      card,
    }
  } catch (error) {
    console.error('Error updating card spending limits:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update spending limits',
    }
  }
}

/**
 * Get card details (includes sensitive data like card number, CVC)
 */
export async function getCardDetails(cardId: string) {
  try {
    const card = await stripe.issuing.cards.retrieve(cardId, {
      expand: ['number', 'cvc'],
    })

    return {
      success: true,
      card,
      // @ts-ignore - number and cvc are available when expanded
      number: card.number,
      // @ts-ignore
      cvc: card.cvc,
    }
  } catch (error) {
    console.error('Error retrieving card details:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve card details',
    }
  }
}

/**
 * List all cards for a cardholder
 */
export async function listCards(cardholderId: string) {
  try {
    const cards = await stripe.issuing.cards.list({
      cardholder: cardholderId,
      limit: 100,
    })

    return {
      success: true,
      cards: cards.data,
    }
  } catch (error) {
    console.error('Error listing cards:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list cards',
    }
  }
}

export { stripe }
