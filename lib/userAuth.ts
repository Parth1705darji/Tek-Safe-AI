/**
 * User authentication middleware (non-admin).
 *
 * Same JWT verification strategy as adminAuth.ts but without the admin role check.
 * Returns the verified Clerk ID and the user's Supabase UUID so API handlers
 * can perform user-scoped queries with the service role key.
 */

import { createClerkClient, verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface UserIdentity {
  clerkId: string;
  userId: string; // Supabase users.id (UUID)
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

export async function verifyUserRequest(req: VercelRequest): Promise<UserIdentity> {
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

  // 2. Verify JWT and extract Clerk user ID
  let clerkId: string;
  try {
    if (process.env.CLERK_JWT_KEY) {
      const payload = await verifyToken(token, { jwtKey: process.env.CLERK_JWT_KEY });
      clerkId = payload.sub;
    } else {
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

  // 3. Look up user in Supabase (no role restriction)
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, email, is_suspended')
    .eq('clerk_id', clerkId)
    .single();

  if (!dbUser) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  if (dbUser.is_suspended) {
    throw Object.assign(new Error('Account suspended'), { status: 403 });
  }

  return { clerkId, userId: dbUser.id as string, email: dbUser.email as string };
}

/**
 * Sends a JSON error response for auth failures.
 * Reads the `.status` property from the thrown error (defaults to 500).
 */
export function sendAuthError(res: VercelResponse, error: unknown): VercelResponse {
  const err = error as Error & { status?: number };
  return res.status(err.status ?? 500).json({ error: err.message });
}
