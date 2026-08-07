import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * Money as it arrives over JSON.
 *
 * Accepts a number or a numeric string and hands back a Decimal. Rejects
 * NaN/Infinity, non-positive values, and anything with sub-cent precision.
 * Nothing downstream is allowed to call parseFloat on money.
 */
export const moneyAmount = z
  .union([z.number(), z.string().trim().min(1)])
  .superRefine((value, ctx) => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      ctx.addIssue({ code: 'custom', message: 'Amount must be a finite number' })
      return
    }

    let decimal: Decimal
    try {
      decimal = new Decimal(value)
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Amount must be a valid number' })
      return
    }

    if (!decimal.isFinite()) {
      ctx.addIssue({ code: 'custom', message: 'Amount must be a finite number' })
      return
    }

    if (decimal.lte(0)) {
      ctx.addIssue({ code: 'custom', message: 'Amount must be greater than zero' })
      return
    }

    if (decimal.decimalPlaces() > 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'Amount cannot have more than 2 decimal places',
      })
    }
  })
  .transform((value) => new Decimal(value))

/** Optional money, e.g. a card spending limit that may be omitted. */
export const optionalMoneyAmount = moneyAmount.optional().nullable()

/**
 * Client-supplied idempotency key.
 *
 * Required on every money-moving endpoint. A server-generated key would be
 * different on every retry and would therefore prevent nothing.
 */
export const idempotencyKey = z
  .string()
  .trim()
  .min(8, 'Idempotency-Key must be at least 8 characters')
  .max(255, 'Idempotency-Key must be at most 255 characters')

export const transferDescription = z.string().trim().max(100).optional()

/** Email or internal account number. */
export const recipientIdentifier = z.string().trim().min(1).max(255)

export const p2pTransferSchema = z.object({
  recipientIdentifier,
  amount: moneyAmount,
  description: transferDescription,
})

export const achInitiateSchema = z.object({
  externalAccountId: z.string().uuid(),
  amount: moneyAmount,
  direction: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  description: transferDescription,
})

export const createCardSchema = z.object({
  spendingLimit: optionalMoneyAmount,
  monthlyLimit: optionalMoneyAmount,
  nickname: z.string().trim().max(50).optional(),
  dateOfBirth: z.object({
    day: z.number().int().min(1).max(31),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(1900).max(new Date().getFullYear()),
  }),
  address: z.object({
    line1: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(20),
    country: z.string().trim().length(2).default('US'),
  }),
  phoneNumber: z.string().trim().max(20).optional(),
})

export const updateCardSchema = z.object({
  status: z.enum(['ACTIVE', 'FROZEN', 'CANCELLED']).optional(),
  nickname: z.string().trim().max(50).optional(),
  spendingLimit: optionalMoneyAmount,
  monthlyLimit: optionalMoneyAmount,
})

export const transactionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  type: z
    .enum([
      'P2P_TRANSFER',
      'ACH_DEBIT',
      'ACH_CREDIT',
      'CARD_AUTHORIZATION',
      'CARD_CAPTURE',
      'CARD_PURCHASE',
      'CARD_REFUND',
      'REFUND',
      'FEE',
      'DEPOSIT',
      'WITHDRAWAL',
    ])
    .optional(),
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    .optional(),
  accountId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export const exchangePublicTokenSchema = z.object({
  publicToken: z.string().trim().min(1),
  institutionId: z.string().trim().min(1).optional(),
  institutionName: z.string().trim().min(1).optional(),
})

export const reviewTransferSchema = z.object({
  note: z.string().trim().max(500).optional(),
})

/** Turn a ZodError into a single readable sentence for the client. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join('; ')
}
