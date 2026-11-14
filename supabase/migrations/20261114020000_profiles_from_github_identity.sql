-- Profiles come from the GitHub identity, not from user metadata.
--
-- auth.users.raw_user_meta_data is editable by its own user (updateUser({ data })), so reading
-- the username from it let anyone appear as "Shared by <someone else>". identity_data on
-- auth.identities is written by Supabase Auth from GitHub's answer at each sign-in and has no
-- user-facing write path, so the name and avatar shown to others are the ones GitHub reports.

drop trigger sync_profile on auth.users;
drop function public.sync_profile();

create function public.sync_profile_from_github()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  login text := left(coalesce(
    nullif(btrim(new.identity_data ->> 'user_name'), ''),
    nullif(btrim(new.identity_data ->> 'preferred_username'), ''),
    'user'
  ), 39);
  avatar text := new.identity_data ->> 'avatar_url';
begin
  if new.provider <> 'github' then
    return new;
  end if;
  if avatar is not null and avatar !~ '^https://' then
    avatar := null;
  end if;
  insert into public.profiles (id, username, avatar_url)
  values (new.user_id, login, avatar)
  on conflict (id) do update
    set username = excluded.username, avatar_url = excluded.avatar_url;
  return new;
end;
$$;

revoke all on function public.sync_profile_from_github() from public, anon, authenticated;

create trigger sync_profile_from_github
  after insert or update of identity_data on auth.identities
  for each row execute function public.sync_profile_from_github();

-- Bring existing profiles back in line with GitHub, undoing any name set through metadata.
update public.profiles p
  set username = left(coalesce(
        nullif(btrim(i.identity_data ->> 'user_name'), ''),
        nullif(btrim(i.identity_data ->> 'preferred_username'), ''),
        'user'
      ), 39),
      avatar_url = case
        when i.identity_data ->> 'avatar_url' ~ '^https://' then i.identity_data ->> 'avatar_url'
      end
  from auth.identities i
  where i.user_id = p.id and i.provider = 'github';
