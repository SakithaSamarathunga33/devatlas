-- Following shared collections. Who follows what stays private to each user; everyone sees only
-- each collection's follower_count, which the trigger below keeps exact.

alter table public.shared_collections
  add column follower_count integer not null default 0 check (follower_count >= 0);

create table public.collection_follows (
  collection_id uuid not null references public.shared_collections (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);

create index collection_follows_user_idx on public.collection_follows (user_id);

alter table public.collection_follows enable row level security;

revoke all on public.collection_follows from anon, authenticated;
grant select, delete on public.collection_follows to authenticated;
grant insert (collection_id) on public.collection_follows to authenticated;

create policy "users see their own follows"
  on public.collection_follows for select to authenticated
  using (user_id = (select auth.uid()));

-- Only collections the caller can see, and never their own.
create policy "users follow visible collections of others"
  on public.collection_follows for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.shared_collections c
      where c.id = collection_id
        and not c.is_hidden
        and c.owner_id <> (select auth.uid())
    )
  );

create policy "users unfollow"
  on public.collection_follows for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.count_followers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.shared_collections
      set follower_count = follower_count + 1
      where id = new.collection_id;
    return new;
  end if;
  update public.shared_collections
    set follower_count = greatest(follower_count - 1, 0)
    where id = old.collection_id;
  return old;
end;
$$;

revoke all on function public.count_followers() from public, anon, authenticated;

create trigger count_followers
  after insert or delete on public.collection_follows
  for each row execute function public.count_followers();
