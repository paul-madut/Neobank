import { NextResponse } from 'next/server'
import { z } from 'zod'
import { formatZodError } from './validation'

/**
 * Error responses that do not leak the server's insides.
 *
 * Returning `error.message` verbatim from a catch block is how a 500 ends up
 * telling the internet the absolute filesystem path of the project, the
 * bundler's chunk names, and the database host and port. Client-facing text is
 * written by hand; the real error goes to the server log with a tag so it can
 * still be found.
 */

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }
  )
}

export function validationError(error: z.ZodError) {
  return badRequest(formatZodError(error))
}

/**
 * Log the real error server-side, return a generic message to the client.
 * `context` is a short tag identifying the route, e.g. "transfers/p2p".
 */
export function serverError(context: string, error: unknown) {
  console.error(`[${context}]`, error)
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.' },
    { status: 500 }
  )
}
