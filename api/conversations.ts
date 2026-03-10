// api/conversations.ts — Vercel serverless function
// to be implemented in Step 4

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(501).json({ error: 'Not implemented yet' });
}
