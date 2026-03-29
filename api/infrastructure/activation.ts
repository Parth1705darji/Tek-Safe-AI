/**
 * GET /api/infrastructure/activation
 *
 * Returns the authenticated user's infrastructure agent status and activation code.
 * Creates a new agent record (with a generated activation_code) if none exists yet.
 *
 * Response shapes:
 *   { status: 'active',   activation_code, agent_hostname, last_heartbeat }
 *   { status: 'pending',  activation_code }
 *   { status: 'offline',  activation_code, agent_hostname, last_heartbeat }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { verifyUserRequest, sendAuthError } from '../../lib/userAuth';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });
  }

  // Verify the requesting user
  let identity: Awaited<ReturnType<typeof verifyUserRequest>>;
  try {
    identity = await verifyUserRequest(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Look up an existing agent for this user
  const { data: existing, error: fetchError } = await supabase
    .from('infrastructure_agents')
    .select('activation_code, status, agent_hostname, last_heartbeat')
    .eq('user_id', identity.userId)
    .maybeSingle();

  if (fetchError) {
    console.error('[activation] fetch error:', fetchError.message);
    return res.status(500).json({ error: 'Failed to query agent status' });
  }

  if (existing) {
    // Return existing record
    return res.status(200).json({
      status: existing.status,
      activation_code: existing.activation_code,
      agent_hostname: existing.agent_hostname ?? null,
      last_heartbeat: existing.last_heartbeat ?? null,
    });
  }

  // No agent yet — generate one
  const activationCode = randomUUID();

  const { error: insertError } = await supabase
    .from('infrastructure_agents')
    .insert({
      user_id: identity.userId,
      activation_code: activationCode,
      status: 'pending',
    });

  if (insertError) {
    console.error('[activation] insert error:', insertError.message);
    return res.status(500).json({ error: 'Failed to create agent record' });
  }

  return res.status(200).json({
    status: 'pending',
    activation_code: activationCode,
  });
}
