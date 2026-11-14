-- "Delete my Community account": the signed-in user erases their account and everything it owns.
--
-- Deleting the auth.users row cascades through Supabase Auth's own tables (identities, sessions,
-- refresh tokens) and through ours: profiles -> shared_collections -> shared_links,
-- collection_follows (as follower and on the user's collections, follower counts kept exact by
-- the count_followers trigger), and reports the user filed or that were filed on their
-- collections. The app's local library is not touched; it never left the computer.
--
-- reports.collection_id stays ON DELETE CASCADE: without its collection a report keeps only a
-- free-text reason, which is no usable moderation history, and erasure should leave no traces.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Sign in to delete your account.' using errcode = '42501';
  end if;
  delete from auth.users u where u.id = caller;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
