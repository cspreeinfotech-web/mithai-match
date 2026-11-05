-- 0009's revoke only touched the named roles; Postgres had granted EXECUTE to PUBLIC
-- by default when the function was created (0008), which anon/authenticated inherit via
-- PUBLIC regardless of a revoke on the named roles alone. Confirmed via has_function_privilege
-- after this ran: anon/authenticated -> false, service_role -> true.
revoke execute on function public.apply_purchase(uuid, text, text, text, bigint, text, integer, integer) from public;
grant execute on function public.apply_purchase(uuid, text, text, text, bigint, text, integer, integer) to service_role;
