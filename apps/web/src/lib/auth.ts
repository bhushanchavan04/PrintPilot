import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

export const AUTH_COOKIE_NAME = 'myprint-token'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production'
  return new TextEncoder().encode(secret)
}

/**
 * Hash a plain-text password using bcryptjs.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12)
  return bcrypt.hash(password, salt)
}

/**
 * Verify a plain-text password against its bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Create a signed JWT for the given payload, valid for 7 days.
 */
export async function createToken(payload: object): Promise<string> {
  const secret = getJwtSecret()
  const token = await new SignJWT({ ...(payload as Record<string, unknown>) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
  return token
}

/**
 * Verify and decode a JWT string.
 * Throws if the token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<any> {
  const secret = getJwtSecret()
  const { payload } = await jwtVerify(token, secret)
  return payload
}

/**
 * Extract and verify the authenticated user from the request cookie.
 * Returns null if no valid token is found.
 */
export async function getAuthUser(
  request: NextRequest
): Promise<{ id: string; email: string; role: string; shopId: string | null } | null> {
  try {
    const cookieHeader = request.cookies.get(AUTH_COOKIE_NAME)
    if (!cookieHeader?.value) return null

    const payload = await verifyToken(cookieHeader.value)

    if (
      typeof payload.id !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null
    }

    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      shopId: typeof payload.shopId === 'string' ? payload.shopId : null,
    }
  } catch {
    return null
  }
}
