-- Library sync: each account's library, sealed on the user's computers with a key made from
-- their sync passphrase (Argon2id, then XChaCha20-Poly1305). The server stores ciphertext and
-- the salt only, and can't read a library. One row per account, gone with the account.

create table public.library_sync (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  -- New (random, chosen by the app) when sync starts over with a new passphrase, so other
  -- computers ask for it. Sealed copies are bound to it and to the revision.
  generation uuid not null,
  -- Goes up with every save; a save from an out-of-date copy is refused.
  revision bigint not null default 1 check (revision > 0),
  -- 16 random bytes in padded base64.
  salt text not null check (salt ~ '^[A-Za-z0-9+/]{21}[AQgw]==$'),
  -- Base64 of a gzipped, sealed library: 12 MiB is far more than a large library needs.
  data text not null check (octet_length(data) between 1 and 12582912),
  updated_at timestamptz not null default now()
);

alter table public.library_sync enable row level security;

create policy "owners read their library copy" on public.library_sync
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "owners delete their library copy" on public.library_sync
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Owners read and delete; writes go through save_library_sync only.
revoke all on public.library_sync from anon, authenticated;
grant select, delete on public.library_sync to authenticated;

-- Stores the caller's copy. expected_revision 0 creates the first copy, of copy_generation and
-- with its salt; otherwise the copy is replaced only if it is still copy_generation at
-- expected_revision, so a computer that missed a start-over can't seal over the new copy with
-- the old key. A refusal is SQLSTATE 40001, which the app answers by merging again.
create function public.save_library_sync(
  copy_generation uuid,
  expected_revision bigint,
  new_salt text,
  new_data text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  saved public.library_sync;
begin
  if caller is null then
    raise exception 'Sign in to sync your library.' using errcode = '42501';
  end if;
  if expected_revision = 0 then
    insert into public.library_sync (owner_id, generation, salt, data)
    values (caller, copy_generation, new_salt, new_data)
    on conflict (owner_id) do nothing
    returning * into saved;
  else
    -- The salt is fixed for a generation, so new_salt is ignored here.
    update public.library_sync s
    set revision = s.revision + 1, data = new_data, updated_at = now()
    where s.owner_id = caller
      and s.generation = copy_generation
      and s.revision = expected_revision
    returning * into saved;
  end if;
  if not found then
    raise exception 'Your library changed on another computer.' using errcode = '40001';
  end if;
  return jsonb_build_object('generation', saved.generation, 'revision', saved.revision);
end;
$$;

revoke all on function public.save_library_sync(uuid, bigint, text, text) from public, anon;
grant execute on function public.save_library_sync(uuid, bigint, text, text) to authenticated;
