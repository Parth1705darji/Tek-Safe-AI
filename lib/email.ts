/**
 * Minimal Resend email helper — fire-and-forget, non-fatal.
 * Set RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel env vars.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // Not configured — skip silently

  const from = process.env.RESEND_FROM_EMAIL ?? 'Tek-Safe AI <noreply@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: [payload.to], subject: payload.subject, html: payload.html }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.warn(`Resend email failed (non-fatal): ${res.status} ${err}`);
  }
}

export function welcomeEmailHtml(displayName: string): string {
  const name = displayName || 'there';
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f1117;color:#e5e7eb;margin:0;padding:40px 20px">
<div style="max-width:520px;margin:0 auto;background:#1a1d2e;border-radius:16px;padding:32px;border:1px solid #2d2f3e">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
    <span style="font-size:28px">🛡️</span>
    <span style="font-size:20px;font-weight:700;color:#ffffff">Tek-Safe AI</span>
  </div>
  <h1 style="font-size:22px;font-weight:600;color:#ffffff;margin:0 0 12px">Welcome, ${name}!</h1>
  <p style="color:#9ca3af;line-height:1.6;margin:0 0 20px">
    Your account is ready. Tek-Safe AI is your always-on cybersecurity assistant —
    ask about threats, scan URLs, check emails for breaches, and get actionable security guidance.
  </p>
  <a href="${process.env.VITE_APP_URL ?? 'https://tek-safe.ai'}"
     style="display:inline-block;background:#00D4AA;color:#0f1117;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px">
    Start Chatting →
  </a>
  <p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #2d2f3e;padding-top:16px">
    Tek-Safe AI · Cybersecurity Assistant
  </p>
</div>
</body></html>`;
}

export function suspensionEmailHtml(displayName: string, reason?: string): string {
  const name = displayName || 'User';
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f1117;color:#e5e7eb;margin:0;padding:40px 20px">
<div style="max-width:520px;margin:0 auto;background:#1a1d2e;border-radius:16px;padding:32px;border:1px solid #2d2f3e">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
    <span style="font-size:28px">🛡️</span>
    <span style="font-size:20px;font-weight:700;color:#ffffff">Tek-Safe AI</span>
  </div>
  <h1 style="font-size:22px;font-weight:600;color:#ffffff;margin:0 0 12px">Account Suspended</h1>
  <p style="color:#9ca3af;line-height:1.6;margin:0 0 12px">Hello ${name},</p>
  <p style="color:#9ca3af;line-height:1.6;margin:0 0 20px">
    Your Tek-Safe AI account has been temporarily suspended.
    ${reason ? `<br/><br/><strong style="color:#e5e7eb">Reason:</strong> ${reason}` : ''}
  </p>
  <p style="color:#9ca3af;line-height:1.6;margin:0">
    If you believe this is an error, please contact our support team.
  </p>
  <p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #2d2f3e;padding-top:16px">
    Tek-Safe AI · Cybersecurity Assistant
  </p>
</div>
</body></html>`;
}
