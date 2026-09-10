# Getting Started — AI Chatbot SaaS

## Prerequisites

- Node.js 20+
- Docker Desktop (for Supabase local dev)
- Supabase CLI (`brew install supabase/tap/supabase`)

## 1. Install Dependencies

```bash
npm install
```

## 2. Start Supabase Locally

```bash
supabase start
```

This boots the local Supabase stack (Postgres, Auth, Storage, etc.) via Docker. First run takes a few minutes to pull images.

Once running, you'll see output with your local credentials:

```
API URL:   http://127.0.0.1:54321
anon key:  eyJ...
service_role key: eyJ...
```

## 3. Apply Migrations + Seed Data

```bash
supabase db reset
```

This drops the database, re-applies all migrations (`supabase/migrations/*.sql`), and runs `supabase/seed.sql` which creates the admin account.

## 4. Configure Environment

Copy `.env.local.example` to `.env.local` (if not already present). The local defaults should work:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
CRON_SECRET=local-dev-secret
```

## 5. Start the Dev Server

```bash
npm run dev
```

App runs at **http://localhost:3000**.

---

## Accounts

### Admin Account (Seeded)

| Field    | Value                 |
|----------|-----------------------|
| Email    | `admin@chatbot.local` |
| Password | `admin123456`         |
| Role     | `admin`               |
| Plan     | `enterprise`          |

1. Go to http://localhost:3000/login
2. Enter the credentials above
3. You'll be redirected to `/dashboard`
4. Access the admin panel at http://localhost:3000/admin

The admin account can:
- Manage users, change plans, activate/deactivate accounts
- Review and approve/reject payment proofs
- Configure LLM providers (API keys for OpenAI, Anthropic, Google)
- Manage platform settings (rate limits, plan definitions, bank details)
- View analytics and impersonate users

### Creating a Regular User Account

1. Go to http://localhost:3000/register
2. Fill in: Full Name, Email, Password (min 8 characters), Confirm Password
3. Click "Create account"
4. In local dev, email confirmation is **disabled** — you're immediately registered
5. Go to http://localhost:3000/login and sign in
6. You'll land on the user dashboard with the **free** plan (100 messages, 1 chatbot)

### Promoting a User to Admin

If you need another admin, use the Supabase SQL editor:

```sql
-- Via Supabase Studio (http://127.0.0.1:54323)
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-user@example.com';
```

Or via the admin panel: go to `/admin/users` → click the user → change their role.

---

## Key URLs

| URL                        | Description                          |
|----------------------------|--------------------------------------|
| http://localhost:3000       | App home (redirects to login)        |
| http://localhost:3000/login | Login page                           |
| http://localhost:3000/register | Registration page                 |
| http://localhost:3000/dashboard | User dashboard                   |
| http://localhost:3000/chatbots | Chatbot management                |
| http://localhost:3000/billing | Billing & plan upgrade             |
| http://localhost:3000/admin | Admin dashboard                      |
| http://localhost:3000/admin/payments | Admin payment review          |
| http://localhost:3000/admin/users | Admin user management            |
| http://localhost:3000/admin/settings | Platform settings              |
| http://127.0.0.1:54323     | Supabase Studio (DB admin)           |
| http://127.0.0.1:54324     | Inbucket (local email testing)       |

---

## Quick Workflow: Test the Full Billing Flow

1. **Login as admin** → Go to `/admin/settings` → Fill in bank transfer details → Save
2. **Create a regular user** → Register at `/register` → Login
3. **Upgrade plan** → Go to `/billing` → Click "Upgrade to Pro" → Select billing cycle → See bank details and amount → Upload a proof image → Submit
4. **Approve as admin** → Login as admin → Go to `/admin/payments` → See the pending payment → Click "View Proof" → Click "Approve"
5. **Verify upgrade** → Login as the regular user → Dashboard shows "PRO" badge, message limit is now 5,000, chatbot limit is 5

---

## Troubleshooting

**"Invalid login credentials"** — Run `supabase db reset` to re-apply seed data.

**Supabase not starting** — Make sure Docker Desktop is running. Try `supabase stop && supabase start`.

**Port conflicts** — Default ports are 54321 (API), 54322 (DB), 54323 (Studio). Check `supabase/config.toml` to change.

**"supabaseAdmin" build errors** — Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`. Get it from `supabase status`.
