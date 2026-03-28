/**
 * Admin authentication middleware.
 *
 * Verification strategy (in priority order):
 *  1. If CLERK_JWT_KEY is set → local RSA verification via verifyToken (no network calls)
 *  2. Otherwise → sessions.verifySession via Clerk API (one network call per request)
 *
 * Flow:
 *  1. Extract Bearer token from Authorization header
 *  2. Verify the JWT (locally or via Clerk API)
 *  3. Confirm role === 'admin' in Supabase (source of truth)
 */

import { createClerkClient, verifyToken } from '@clerk/backend';
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

  // 2. Verify the JWT and extract the Clerk user ID
  let clerkId: string;
  try {
    if (process.env.CLERK_JWT_KEY) {
      // Local RSA verification — zero network calls, reliable in serverless cold starts
      const payload = await verifyToken(token, { jwtKey: process.env.CLERK_JWT_KEY });
      clerkId = payload.sub;
    } else {
      // Fallback: call Clerk's session verify API directly
      const claims = decodeJwtPayload(token);
      const sessionId = claims.sid as string | undefined;
      if (!sessionId) throw new Error('Missing session ID (sid) in token');
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const session = await clerk.sessions.verifySession(sessionId, token);
      clerkId = session.userId;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw Object.assign(new Error(`Token verification failed: ${detail}`), { status: 401 });
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
