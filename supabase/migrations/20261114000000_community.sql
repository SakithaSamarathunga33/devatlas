-- Community: collections DevAtlas users publish for others to browse and copy from.
--
-- Anyone may read what is published. Writing goes only through the functions at the end, which
-- check who is calling; signed-in users get no direct write access to the tables except
-- deleting their own collections and filing reports. Every published value is untrusted input
-- to other users' apps, so lengths, counts and link schemes are enforced here, not only in the
-- app.

-- A public face for each account, kept in step with GitHub by the trigger below.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 1 and 39),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  created_at timestamptz not null default now()
);

create table public.shared_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  link_count integer not null default 0 check (link_count between 0 and 200),
  -- Set by a moderator to take a collection down without deleting it.
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', title || ' ' || coalesce(description, ''))
  ) stored
);

create index shared_collections_owner_idx on public.shared_collections (owner_id);
create index shared_collections_updated_idx on public.shared_collections (updated_at desc);
create index shared_collections_search_idx on public.shared_collections using gin (search);

create table public.shared_links (
  collection_id uuid not null references public.shared_collections (id) on delete cascade,
  position integer not null check (position between 0 and 199),
  url text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 2048),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  primary key (collection_id, position)
);

create table public.reports (
  id bigint generated always as identity primary key,
  collection_id uuid not null references public.shared_collections (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (collection_id, reporter_id)
);

create index reports_reporter_idx on public.reports (reporter_id);

-- Row level security: reads are public, writes are narrow.

alter table public.profiles enable row level security;
alter table public.shared_collections enable row level security;
alter table public.shared_links enable row level security;
alter table public.reports enable row level security;

revoke all on public.profiles, public.shared_collections, public.shared_links, public.reports
  from anon, authenticated;
grant select on public.profiles, public.shared_collections, public.shared_links
  to anon, authenticated;
grant delete on public.shared_collections to authenticated;
grant insert (collection_id, reason) on public.reports to authenticated;

create policy "profiles are public"
  on public.profiles for select to anon, authenticated
  using (true);

create policy "published collections are public; owners also see their hidden ones"
  on public.shared_collections for select to anon, authenticated
  using (not is_hidden or owner_id = (select auth.uid()));

create policy "owners delete their collections"
  on public.shared_collections for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "links of visible collections are public"
  on public.shared_links for select to anon, authenticated
  using (exists (select 1 from public.shared_collections c where c.id = collection_id));

create policy "signed-in users report collections as themselves"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Profiles follow the GitHub account: created at first sign-in, refreshed at each one.

create function public.sync_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  login text := left(coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    'user'
  ), 39);
  avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  if avatar is not null and avatar !~ '^https://' then
    avatar := null;
  end if;
  insert into public.profiles (id, username, avatar_url)
  values (new.id, login, avatar)
  on conflict (id) do update
    set username = excluded.username, avatar_url = excluded.avatar_url;
  return new;
end;
$$;

create trigger sync_profile
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile();

-- Publishing. `links` is a JSON array of {"url", "title"} objects, in order.
-- With `collection` null it creates a collection, otherwise it replaces one the caller owns.

create function public.publish_collection(
  collection uuid,
  title text,
  description text,
  links jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target uuid := collection;
  link_total integer;
begin
  if caller is null then
    raise exception 'Sign in to publish a collection.' using errcode = '42501';
  end if;
  if jsonb_typeof(links) is distinct from 'array' then
    raise exception 'links must be a JSON array' using errcode = '22023';
  end if;
  link_total := jsonb_array_length(links);
  if link_total = 0 or link_total > 200 then
    raise exception 'A shared collection holds 1 to 200 links.' using errcode = '22023';
  end if;

  if target is null then
    if (select count(*) from public.shared_collections c where c.owner_id = caller) >= 50 then
      raise exception 'You can share up to 50 collections.' using errcode = '54000';
    end if;
    insert into public.shared_collections (owner_id, title, description, link_count)
    values (caller, btrim(title), nullif(btrim(description), ''), link_total)
    returning id into target;
  else
    update public.shared_collections c
      set title = btrim(publish_collection.title),
          description = nullif(btrim(publish_collection.description), ''),
          link_count = link_total,
          updated_at = now()
      where c.id = target and c.owner_id = caller;
    if not found then
      raise exception 'That shared collection is not yours.' using errcode = '42501';
    end if;
    delete from public.shared_links l where l.collection_id = target;
  end if;

  insert into public.shared_links (collection_id, position, url, title)
  select target, (item.ordinality - 1)::integer, item.value ->> 'url', btrim(item.value ->> 'title')
  from jsonb_array_elements(links) with ordinality as item (value, ordinality);

  return target;
end;
$$;

revoke all on function public.publish_collection(uuid, text, text, jsonb) from public, anon;
grant execute on function public.publish_collection(uuid, text, text, jsonb) to authenticated;
revoke all on function public.sync_profile() from public, anon, authenticated;
