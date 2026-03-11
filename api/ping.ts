import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const payload = JSON.stringify({
    ok: true,
    time: new Date().toISOString(),
    node: process.version,
    env: {
      hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasDeepSeek: !!process.env.DEEPSEEK_API_KEY,
    },
  });
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(payload);
}
