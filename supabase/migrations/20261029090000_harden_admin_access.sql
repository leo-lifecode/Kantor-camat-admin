-- Least-privilege hardening: this helper is used internally by RLS policies.
-- Anonymous clients do not need to call it directly.
revoke execute on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;
