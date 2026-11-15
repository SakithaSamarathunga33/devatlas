-- Agent setups: the skills, MCP servers and plugins a developer uses in Claude Code and Codex.
-- One setup per account. Only names, short descriptions and public sources (a GitHub
-- repository, an npm or PyPI package) are stored, never an MCP server's command, arguments,
-- environment or a file path. The app builds install commands from these checked fields, so the
-- checks below are what stop a setup from carrying shell text.

create table public.shared_setups (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  description text check (description is null or char_length(description) <= 500),
  skill_count integer not null default 0 check (skill_count between 0 and 300),
  mcp_server_count integer not null default 0 check (mcp_server_count between 0 and 300),
  plugin_count integer not null default 0 check (plugin_count between 0 and 300),
  -- Set by a moderator to take a setup down without deleting it.
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The feed: visible setups, newest first, `owner_id` breaking ties.
create index shared_setups_feed_idx on public.shared_setups (updated_at desc, owner_id desc)
  where not is_hidden;

create table public.shared_setup_items (
  owner_id uuid not null references public.shared_setups (owner_id) on delete cascade,
  position integer not null check (position between 0 and 299),
  kind text not null check (kind in ('skill', 'mcp-server', 'plugin')),
  -- Letters, digits, '.', '_', '-' and one '@' (plugin@marketplace); never a leading '-'.
  name text not null check (
    char_length(name) <= 100 and name ~ '^[A-Za-z0-9][A-Za-z0-9._-]*(@[A-Za-z0-9][A-Za-z0-9._-]*)?$'
  ),
  description text check (description is null or char_length(description) <= 300),
  source_type text check (source_type in ('github', 'npm', 'pypi')),
  -- owner/repo, an npm package (optionally @scope/) or a PyPI project; no spaces or shell text.
  source text check (
    char_length(source) <= 214 and source ~ '^@?[A-Za-z0-9][A-Za-z0-9._~-]*(/[A-Za-z0-9][A-Za-z0-9._~-]*)?$'
  ),
  tools text[] not null check (
    cardinality(tools) between 1 and 2 and tools <@ array['claude-code', 'codex']::text[]
  ),
  check ((source_type is null) = (source is null)),
  -- Each type's own shape, so a source can't pass as another kind.
  check (
    source_type is null
    or (source_type = 'github' and source ~ '^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9][A-Za-z0-9._-]*$')
    or (source_type = 'npm' and source ~ '^(@[A-Za-z0-9][A-Za-z0-9._~-]*/)?[A-Za-z0-9][A-Za-z0-9._~-]*$')
    or (source_type = 'pypi' and source ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$')
  ),
  primary key (owner_id, position),
  unique (owner_id, kind, name)
);

create table public.setup_reports (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.shared_setups (owner_id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (owner_id, reporter_id)
);

create index setup_reports_reporter_idx on public.setup_reports (reporter_id);

alter table public.shared_setups enable row level security;
alter table public.shared_setup_items enable row level security;
alter table public.setup_reports enable row level security;

revoke all on public.shared_setups, public.shared_setup_items, public.setup_reports
  from anon, authenticated;
grant select on public.shared_setups, public.shared_setup_items to authenticated;
grant delete on public.shared_setups to authenticated;
grant insert (owner_id, reason) on public.setup_reports to authenticated;

create policy "signed-in users see published setups; owners their hidden"
  on public.shared_setups for select to authenticated
  using (not is_hidden or owner_id = (select auth.uid()));

-- Not once hidden: deleting and publishing again would undo a moderator's takedown.
create policy "owners delete their visible setup"
  on public.shared_setups for delete to authenticated
  using (owner_id = (select auth.uid()) and not is_hidden);

create policy "signed-in users see items of visible setups"
  on public.shared_setup_items for select to authenticated
  using (exists (select 1 from public.shared_setups s where s.owner_id = shared_setup_items.owner_id));

create policy "signed-in users report others' setups as themselves"
  on public.setup_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and owner_id <> (select auth.uid())
    and exists (select 1 from public.shared_setups s where s.owner_id = setup_reports.owner_id)
  );

-- Publishes or replaces the caller's setup with `items`, in order.
create function public.publish_setup(description text, items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  item_total integer;
begin
  if caller is null then
    raise exception 'Sign in to share your setup.' using errcode = '42501';
  end if;
  if jsonb_typeof(items) is distinct from 'array' then
    raise exception 'items must be a JSON array' using errcode = '22023';
  end if;
  item_total := jsonb_array_length(items);
  if item_total = 0 or item_total > 300 then
    raise exception 'A shared setup holds 1 to 300 items.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(items) e
    where jsonb_typeof(e.value) is distinct from 'object'
       or jsonb_typeof(e.value -> 'tools') is distinct from 'array'
  ) then
    raise exception 'Each item must be an object with a tools array.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.shared_setups s
    where s.owner_id = caller and s.updated_at > now() - interval '10 seconds'
  ) then
    raise exception 'Wait a few seconds before sharing your setup again.' using errcode = '54000';
  end if;

  insert into public.shared_setups (owner_id, description, updated_at)
  values (caller, nullif(btrim(publish_setup.description), ''), now())
  on conflict (owner_id) do update
    set description = excluded.description, updated_at = now();

  delete from public.shared_setup_items i where i.owner_id = caller;
  insert into public.shared_setup_items (
    owner_id, position, kind, name, description, source_type, source, tools
  )
  select
    caller,
    (entry.ordinality - 1)::integer,
    entry.value ->> 'kind',
    entry.value ->> 'name',
    nullif(btrim(entry.value ->> 'description'), ''),
    entry.value ->> 'source_type',
    entry.value ->> 'source',
    array(select distinct t from jsonb_array_elements_text(entry.value -> 'tools') t order by 1)
  from jsonb_array_elements(items) with ordinality as entry (value, ordinality);

  update public.shared_setups s
    set skill_count = (select count(*) from public.shared_setup_items i
                       where i.owner_id = caller and i.kind = 'skill'),
        mcp_server_count = (select count(*) from public.shared_setup_items i
                            where i.owner_id = caller and i.kind = 'mcp-server'),
        plugin_count = (select count(*) from public.shared_setup_items i
                        where i.owner_id = caller and i.kind = 'plugin')
    where s.owner_id = caller;
end;
$$;

revoke all on function public.publish_setup(text, jsonb) from public, anon;
grant execute on function public.publish_setup(text, jsonb) to authenticated;
