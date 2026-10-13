import crypto from 'crypto'

// Fails closed: if CRON_SECRET is not configured, no request is accepted.
export function verifyCronSecret(authHeader: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false
  if (!authHeader) return false

  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) return false

  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
