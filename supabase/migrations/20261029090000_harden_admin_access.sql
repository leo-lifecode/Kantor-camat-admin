-- Keep public read access limited to active services and announcements.
-- Admin-only SELECT policies preserve access to inactive records for authenticated admins.
drop policy if exists "services readable" on public.services;
create policy "services public read active"
on public.services for select to anon, authenticated
using (is_active = true);
create policy "services admin read all"
on public.services for select to authenticated
using (public.current_user_is_admin());

drop policy if exists "announcements public read" on public.announcements;
create policy "announcements public read active"
on public.announcements for select to anon, authenticated
using (is_active = true);
create policy "announcements admin read all"
on public.announcements for select to authenticated
using (public.current_user_is_admin());

-- Anonymous clients do not need direct access to this helper.
revoke execute on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;
