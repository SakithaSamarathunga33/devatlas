-- Link images: a small JPEG copy of each of the first 24 links' preview images, made and uploaded
-- by the owner's app when sharing, kept in `collection-covers/{collection id}/links/{position}.jpg`.
-- A collection page shows each link's image and a card its first three, all from this project's
-- storage, so a sharer can't learn who looked. Replaces `covers`, which older app versions still
-- read and write, so it stays until they are gone.

alter table public.shared_collections
  -- Positions of the links that have an image, ascending.
  add column images smallint[] not null default '{}'
    check (
      cardinality(images) <= 24 and array_position(images, null) is null
      and 0 <= all (images) and 23 >= all (images)
    );

-- Republishing replaces the links, so the old images may sit next to other links: drop them until
-- the owner's app uploads the new ones. Only publishing changes `updated_at`.
create function public.forget_link_images()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.images := '{}';
  return new;
end;
$$;

create trigger forget_link_images
  before update of updated_at on public.shared_collections
  for each row when (new.updated_at is distinct from old.updated_at)
  execute function public.forget_link_images();

revoke all on function public.forget_link_images() from public, anon, authenticated;

-- Records which of the caller's collection's links have an image, after uploading them.
create function public.set_collection_images(collection uuid, positions smallint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sorted smallint[];
begin
  select coalesce(array_agg(distinct p order by p), '{}') into sorted from unnest(positions) p;
  if positions is null or cardinality(sorted) <> cardinality(positions)
    or exists (select 1 from unnest(sorted) p where p is null or p < 0 or p > 23) then
    raise exception 'Images go with links 0 to 23, once each.' using errcode = '22023';
  end if;
  update public.shared_collections c
    -- Older app versions read `covers`; the files it counts are deleted with this change.
    set images = sorted, covers = 0, covers_at = now()
    where c.id = collection and c.owner_id = (select auth.uid())
      and (select coalesce(max(p), -1) from unnest(sorted) p) < c.link_count
      -- A hidden collection's images can be cleared, never put back.
      and (cardinality(sorted) = 0 or not c.is_hidden);
  if not found then
    raise exception 'That collection isn''t yours.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_collection_images(uuid, smallint[]) from public, anon;
grant execute on function public.set_collection_images(uuid, smallint[]) to authenticated;

-- Owners may now also write `{collection id}/links/{0..23}.jpg`.
alter policy "owners manage their collections' covers" on storage.objects
  with check (
    bucket_id = 'collection-covers'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/([0-2]|links/(1?[0-9]|2[0-3]))\.jpg$'
    and (storage.foldername(name))[1] in (
      select c.id::text from public.shared_collections c
      where c.owner_id = (select auth.uid()) and not c.is_hidden
    )
  );
