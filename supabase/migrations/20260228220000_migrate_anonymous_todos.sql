-- Reassign todos from an anonymous user to the current (signed-in) user.
-- Callable only by authenticated users; reassignment is always TO auth.uid().
-- SECURITY DEFINER allows updating rows where user_id = from_user_id (RLS would block otherwise).
create or replace function migrate_anonymous_todos(from_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update todos
  set user_id = auth.uid()
  where user_id = from_user_id;
end;
$$;

grant execute on function migrate_anonymous_todos(uuid) to authenticated;
