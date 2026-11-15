-- Covers: up to three small JPEG copies of a shared collection's link preview images, made and
-- uploaded by the owner's app when sharing. Viewers load them from this project's storage,
-- never from the linked sites, so a sharer can't learn who looked at a collection.

alter table public.shared_collections
  add column covers smallint not null default 0 check (covers between 0 and 3),
  -- When the covers last changed; cards add it to the image address so a new cover shows.
  add column covers_at timestamptz;

-- Records how many covers the caller's collection has (0 to 3), after uploading them.
create function public.set_collection_covers(collection uuid, cover_count smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cover_count is null or cover_count < 0 or cover_count > 3 then
    raise exception 'A collection has 0 to 3 covers.' using errcode = '22023';
  end if;
  update public.shared_collections c
    set covers = cover_count, covers_at = now()
    where c.id = collection and c.owner_id = (select auth.uid())
      -- A hidden collection's covers can be cleared, never put back.
      and (cover_count = 0 or not c.is_hidden);
  if not found then
    raise exception 'That collection isn''t yours.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_collection_covers(uuid, smallint) from public, anon;
grant execute on function public.set_collection_covers(uuid, smallint) to authenticated;

-- Public reads (plain image addresses, no account needed to render an <img>); only small JPEGs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collection-covers', 'collection-covers', true, 102400, array['image/jpeg']);

-- `{collection id}/{0,1,2}.jpg`, only in a folder named after one of the caller's collections.
create policy "owners manage their collections' covers"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'collection-covers'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.shared_collections c where c.owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'collection-covers'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-2]\.jpg$'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.shared_collections c
      where c.owner_id = (select auth.uid()) and not c.is_hidden
    )
  );
