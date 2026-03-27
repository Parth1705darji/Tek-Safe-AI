/**
 * Admin authentication middleware.
 *
 * Replaces the old x-admin-email header check (trivially spoofable) with
 * Clerk JWT verification: the client sends a real signed session token,
 * we verify it cryptographically then confirm role === 'admin' in Supabase.
 */

import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface AdminIdentity {
  clerkId: string;
  email: string;
}

/**
 * Verifies the request carries a valid Clerk session token belonging to an admin.
 * Throws an Error with a `.status` property on failure so callers can send the
 * right HTTP status code without duplicating error-handling logic.
 */
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

  // 2. Verify JWT signature with Clerk — this proves the token is real and not expired
  let clerkId: string;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    clerkId = payload.sub;
  } catch {
    throw Object.assign(new Error('Invalid or expired session token'), { status: 401 });
  }

  // 3. Confirm the user has role === 'admin' in Supabase (source of truth, kept in
  //    sync with Clerk publicMetadata via the set-role endpoint)
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
