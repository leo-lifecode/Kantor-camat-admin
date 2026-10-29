-- SECURITY DEFINER RPCs must not be executable by anonymous clients.
-- These functions are intended for authenticated warga/admin flows only.
revoke execute on function public.call_next_queue() from public, anon;
revoke execute on function public.cancel_own_queue(uuid) from public, anon;
revoke execute on function public.complete_queue_service(uuid) from public, anon;
revoke execute on function public.create_queue(uuid) from public, anon;
revoke execute on function public.current_user_is_admin() from public, anon;
revoke execute on function public.expire_stale_queues() from public, anon;
revoke execute on function public.skip_queue(uuid) from public, anon;
revoke execute on function public.start_queue_service(uuid) from public, anon;

grant execute on function public.call_next_queue() to authenticated;
grant execute on function public.cancel_own_queue(uuid) to authenticated;
grant execute on function public.complete_queue_service(uuid) to authenticated;
grant execute on function public.create_queue(uuid) to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.expire_stale_queues() to authenticated;
grant execute on function public.skip_queue(uuid) to authenticated;
grant execute on function public.start_queue_service(uuid) to authenticated;
