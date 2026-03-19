# Tek-Safe AI — Admin Setup Guide

## Overview

The Admin Portal is protected by role-based access control (RBAC). Roles are stored in:
1. Clerk `publicMetadata.role` (for frontend auth)
2. Supabase `users.role` column (for backend queries)

---

## Step 1 — Run the Database Migration

Open the **Supabase SQL Editor** and run:

```
supabase/migrations/003_rbac.sql
```

This adds the `role` column to the `users` table with values `'user'` or `'admin'`.

---

## Step 2 — Set Your Admin Role in Clerk Dashboard

Since you were created before RBAC was implemented, set your role manually:

1. Go to **Clerk Dashboard** → **Users**
2. Find your account
3. Click **Edit** → **Metadata**
4. In **Public Metadata**, add:
   ```json
   { "role": "admin" }
   ```
5. Save

---

## Step 3 — Set Your Admin Role in Supabase

In Supabase SQL Editor, run:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

---

## Step 4 — Install @clerk/backend

The webhook and set-role API require `@clerk/backend`:

```bash
npm install @clerk/backend
```

---

## Step 5 — Environment Variables

Ensure these are set in Vercel (or `.env.local` for dev):

| Variable | Required | Purpose |
|---|---|---|
| `VITE_ADMIN_EMAIL` | Yes | Your admin email (gates admin API endpoints) |
| `CLERK_SECRET_KEY` | Yes | Clerk backend SDK (for role updates) |
| `CLERK_WEBHOOK_SECRET` | Yes | Svix webhook signature verification |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role (bypasses RLS) |
| `DEEPSEEK_API_KEY` | Yes | AI responses |
| `OPENAI_API_KEY` | Yes | KB embeddings |
| `HIBP_API_KEY` | Optional | HaveIBeenPwned breach check |
| `VIRUSTOTAL_API_KEY` | Optional | URL scanning |
| `ABUSEIPDB_API_KEY` | Optional | IP reputation |
| `RAZORPAY_KEY_ID` | Optional | Payments |
| `VITE_CHATWOOT_WEBSITE_TOKEN` | Optional | Live chat widget |

---

## Step 6 — Clerk Webhook (for new users)

After installing `@clerk/backend`, the webhook at `/api/webhooks/clerk` will automatically:
- Assign `role: 'admin'` if the new user's email matches `VITE_ADMIN_EMAIL`
- Assign `role: 'user'` for all other new users

Make sure the webhook is configured in **Clerk Dashboard** → **Webhooks** for these events:
- `user.created`
- `user.updated`
- `user.deleted`
- `session.created`

---

## Accessing the Admin Portal

Navigate to `/admin` — you will be redirected to `/chat` if not signed in as an admin.

The portal includes:
- **Dashboard** — overview stats, recent users, quick actions
- **Knowledge Base** — full CRUD for KB articles
- **Users** — paginated user table with search/filter and role management
- **Analytics** — tool usage breakdown, feedback scores
- **System** — API key status, database row counts
