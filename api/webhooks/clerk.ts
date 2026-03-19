import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';

// Disable body parsing so we can read the raw body for svix signature verification
export const config = {
  api: { bodyParser: false },
};

// Service role client — bypasses RLS for server-side operations
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ClerkUserCreatedEvent = {
  type: 'user.created';
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    username: string | null;
  };
};

type ClerkUserUpdatedEvent = {
  type: 'user.updated';
  data: ClerkUserCreatedEvent['data'];
};

type ClerkUserDeletedEvent = {
  type: 'user.deleted';
  data: { id: string; deleted: boolean };
};

type ClerkSessionCreatedEvent = {
  type: 'session.created';
  data: { user_id: string };
};

type WebhookEvent =
  | ClerkUserCreatedEvent
  | ClerkUserUpdatedEvent
  | ClerkUserDeletedEvent
  | ClerkSessionCreatedEvent;

async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing CLERK_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Read and verify the raw body
  const rawBody = await getRawBody(req);
  const svixHeaders = {
    'svix-id': req.headers['svix-id'] as string,
    'svix-timestamp': req.headers['svix-timestamp'] as string,
    'svix-signature': req.headers['svix-signature'] as string,
  };

  let event: WebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(rawBody, svixHeaders) as WebhookEvent;
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    switch (event.type) {
      case 'user.created': {
        const { id, email_addresses, primary_email_address_id, first_name, last_name, image_url, username } = event.data;
        const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ?? '';
        const displayName = [first_name, last_name].filter(Boolean).join(' ') || username || null;

        await supabaseAdmin.from('users').insert({
          clerk_id: id,
          email: primaryEmail,
          display_name: displayName,
          avatar_url: image_url,
        });

        await supabaseAdmin.from('analytics_events').insert({
          event_type: 'sign_up',
          event_data: { clerk_id: id },
        });

        // Set default role in Clerk publicMetadata
        try {
          const { createClerkClient } = await import('@clerk/backend');
          const clerkBackend = createClerkClient({
            secretKey: process.env.CLERK_SECRET_KEY!,
          });

          const isAdminEmail = primaryEmail === process.env.VITE_ADMIN_EMAIL;
          const role = isAdminEmail ? 'admin' : 'user';

          await clerkBackend.users.updateUserMetadata(id, {
            publicMetadata: { role },
          });

          // Also set role in Supabase
          await supabaseAdmin
            .from('users')
            .update({ role })
            .eq('clerk_id', id);
        } catch (e) {
          console.warn('Failed to set role metadata (non-fatal):', (e as Error).message);
        }
        break;
      }

      case 'user.updated': {
        const { id, email_addresses, primary_email_address_id, first_name, last_name, image_url, username } = event.data;
        const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ?? '';
        const displayName = [first_name, last_name].filter(Boolean).join(' ') || username || null;

        await supabaseAdmin
          .from('users')
          .update({ email: primaryEmail, display_name: displayName, avatar_url: image_url })
          .eq('clerk_id', id);
        break;
      }

      case 'user.deleted': {
        await supabaseAdmin.from('users').delete().eq('clerk_id', event.data.id);
        break;
      }

      case 'session.created': {
        // Look up internal user_id by clerk_id
        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('clerk_id', event.data.user_id)
          .single();

        if (dbUser) {
          await supabaseAdmin.from('analytics_events').insert({
            user_id: dbUser.id,
            event_type: 'login',
            event_data: { clerk_id: event.data.user_id },
          });
        }
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
