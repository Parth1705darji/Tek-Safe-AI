/**
 * Admin authentication middleware.
 *
 * Uses Clerk's sessions.verifySession() API instead of verifyToken() to avoid
 * the JWKS network-fetch that verifyToken() requires on every cold start.
 *
 * Flow:
 *  1. Extract Bearer token from Authorization header
 *  2. Decode JWT (no verification yet) to get the session ID (sid claim)
 *  3. Call clerk.sessions.verifySession(sessionId, token) — Clerk's API
 *     verifies the session AND the token in one call, returning the userId
 *  4. Confirm role === 'admin' in Supabase (source of truth)
 */

import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface AdminIdentity {
  clerkId: string;
  email: string;
}

/** Decode a JWT payload without verification (only used to extract the sid claim). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');
  // Base64url → Base64
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

export async function verifyAdminRequest(req: VercelRequest): Promise<AdminIdentity> {
  // 1. Extract Bearer token
  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(
      new Error('Missing or malformed Authorization header'),
      { status: 401 }
    );
  }
  const token = authHeader.slice(7);

  if (!process.env.CLERK_SECRET_KEY) {
    throw Object.assign(new Error('Clerk not configured on server'), { status: 500 });
  }

  // 2. Verify via Clerk API — more reliable than JWKS fetch in serverless
  let clerkId: string;
  try {
    const claims = decodeJwtPayload(token);
    const sessionId = claims.sid as string | undefined;
    if (!sessionId) throw new Error('Missing session ID (sid) in token');

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    const session = await clerk.sessions.verifySession(sessionId, token);
    clerkId = session.userId;
  } catch {
    throw Object.assign(new Error('Invalid or expired session token'), { status: 401 });
  }

  // 3. Confirm role === 'admin' in Supabase
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: dbUser } = await supabase
    .from('users')
    .select('role, email')
    .eq('clerk_id', clerkId)
    .single();

  if (!dbUser || dbUser.role !== 'admin') {
    throw Object.assign(new Error('Forbidden: admin role required'), { status: 403 });
  }

  return { clerkId, email: dbUser.email as string };
}

/**
 * Sends a JSON error response for auth failures.
 * Reads the `.status` property from the thrown error (defaults to 500).
 */
export function sendAuthError(res: VercelResponse, error: unknown): VercelResponse {
  const err = error as Error & { status?: number };
  return res.status(err.status ?? 500).json({ error: err.message });
}
