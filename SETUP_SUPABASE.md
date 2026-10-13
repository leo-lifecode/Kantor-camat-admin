# Setup Supabase

## 1. Install dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## 2. Configure environment

Copy `.env.example` to `.env.local`, then fill the project URL and anon/public key from Supabase Project Settings → API. Do not commit `.env.local`.

## 3. Create database and secure functions

Run these files in the Supabase SQL Editor in this order:

1. `supabase/schema.sql`
2. `supabase/queue_actions.sql`
3. `supabase/security_hardening.sql`

The hardening migration disables self-promotion to ADMIN, enforces one active queue per citizen, validates service selection, and serializes the single counter's FCFS call-next operation. If the unique index fails, inspect and resolve duplicate active queues before retrying.

## 4. Create the first admin

1. Register the trusted administrator through Supabase Auth.
2. Locate that user's UUID in Authentication → Users.
3. Assign the role through SQL Editor:

```sql
insert into public.profiles (id, name, role)
values ('AUTH_USER_UUID', 'Admin Talawi', 'ADMIN')
on conflict (id) do update set role = 'ADMIN';
```

Replace `AUTH_USER_UUID` with the real UUID. Never make the admin role editable by a normal user.

## Current repository status

The dashboard pages intentionally use demonstration data until a Supabase project is configured. Login uses Supabase Auth. The middleware protects dashboard routes and checks the ADMIN role when both environment variables are present. Queue RPC helpers are available in `src/lib/queue-actions.ts`; the detail-page demo buttons and list pages still need to be connected to live records.

## Production checklist

- [ ] Install dependencies and set environment variables.
- [ ] Run all three SQL files in the order above.
- [ ] Create the first ADMIN account.
- [ ] Connect service, announcement, user, report, and FCFS pages to database queries.
- [ ] Connect queue detail buttons to `runQueueAction` and real queue IDs.
- [ ] Add Supabase Realtime subscriptions and FCM push delivery.
- [ ] Build the React Native WARGA application.
- [ ] Test RLS with separate WARGA and ADMIN accounts.
- [ ] Run lint, TypeScript checks, and end-to-end tests.
