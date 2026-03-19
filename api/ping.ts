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
      hasOpenAI: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_key_here'),
      hasHIBP: !!(process.env.HIBP_API_KEY && process.env.HIBP_API_KEY !== 'your_key_here'),
      hasVirusTotal: !!(process.env.VIRUSTOTAL_API_KEY && process.env.VIRUSTOTAL_API_KEY !== 'your_key_here'),
      hasAbuseIPDB: !!(process.env.ABUSEIPDB_API_KEY && process.env.ABUSEIPDB_API_KEY !== 'your_key_here'),
      hasRazorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_xxxxxxxxxxxx'),
      hasChatwoot: !!(process.env.VITE_CHATWOOT_WEBSITE_TOKEN && process.env.VITE_CHATWOOT_WEBSITE_TOKEN !== 'your_token_here'),
      hasAdminEmail: !!process.env.VITE_ADMIN_EMAIL,
      hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
    },
  });
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(payload);
}
