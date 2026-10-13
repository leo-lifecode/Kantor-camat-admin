# Setup Supabase

## 1. Install dependency

```bash
npm install @supabase/supabase-js
```

## 2. Configure environment

Copy `.env.example` to `.env.local`, then fill the project URL and anon/public key from Supabase Project Settings → API. Do not commit `.env.local`.

## 3. Create database

Open Supabase → SQL Editor, paste and run `supabase/schema.sql`. Review the SQL and RLS rules for your deployment before enabling public access.

## 4. Create the first admin

1. Register the trusted administrator through Supabase Auth.
2. Locate that user's UUID in Authentication → Users.
3. Insert/update their profile role through SQL Editor:

```sql
insert into public.profiles (id, name, role)
values ('AUTH_USER_UUID', 'Admin Talawi', 'ADMIN')
on conflict (id) do update set role = 'ADMIN';
``

Replace `AUTH_USER_UUID` with the real UUID. Never make the admin role editable by a normal user.

## Current repository status

The dashboard pages currently contain demonstration data so the UI can be reviewed without credentials. The profile, service, announcement, user, report, and FCFS screens are not yet wired to live database queries. The SQL includes core tables, RLS, and an atomic FCFS call-next function; the other queue state transitions, push notifications, and React Native client still need integration and testing.

## Production checklist

- [ ] Install Supabase dependency and set environment variables.
- [ ] Add Supabase Auth login/logout and route protection.
- [ ] Replace demonstration arrays with database queries.
- [ ] Add validated service/announcement create and edit forms.
- [ ] Wire queue actions to secure database functions.
- [ ] Implement realtime subscriptions and FCM push delivery.
- [ ] Test RLS with separate WARGA and ADMIN accounts.
- [ ] Verify FCFS metrics against real server timestamps.
- [ ] Run lint, TypeScript checks, and end-to-end tests.
