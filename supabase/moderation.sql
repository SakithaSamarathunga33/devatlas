-- How to moderate DevAtlas Community
--
-- Not a migration: the owner runs these by hand in the Supabase SQL editor, which connects as
-- `postgres` and so sees every row, hidden collections included. Run the read-only queries
-- freely. The statements that change data are commented out on purpose: copy one, put in the
-- id, and run it on its own.
--
-- Reports have no status column. A report is "open" while its collection is still visible;
-- hiding the collection settles it. Deleting a collection, or its owner deleting their account,
-- deletes its reports too (see migration 20261114030000_delete_my_account.sql).

-- 1. Open reports, newest first, with the collection and who owns and reported it.
select
  r.id as report_id,
  r.created_at as reported_at,
  r.reason,
  c.id as collection_id,
  c.title,
  c.link_count,
  op.username as owner,
  c.owner_id,
  rp.username as reporter
from public.reports r
join public.shared_collections c on c.id = r.collection_id
join public.profiles op on op.id = c.owner_id
join public.profiles rp on rp.id = r.reporter_id
where not c.is_hidden
order by r.created_at desc;

-- 2. Collections by number of reports, to see what many people flagged.
select c.id, c.title, c.is_hidden, op.username as owner, count(*) as reports
from public.reports r
join public.shared_collections c on c.id = r.collection_id
join public.profiles op on op.id = c.owner_id
group by c.id, c.title, c.is_hidden, op.username
order by reports desc, c.updated_at desc;

-- 3. The links of one collection, to review before deciding. Put in the collection id.
-- select position, url, title
-- from public.shared_links
-- where collection_id = '00000000-0000-0000-0000-000000000000'
-- order by position;

-- Changing data: run one statement at a time, with the right id.
--
-- Hide a collection. It disappears from browsing for everyone but its owner, who still sees it
-- in their own list; nobody can start following it.
-- update public.shared_collections set is_hidden = true where id = '00000000-0000-0000-0000-000000000000';
--
-- Unhide it again.
-- update public.shared_collections set is_hidden = false where id = '00000000-0000-0000-0000-000000000000';
--
-- Dismiss a report that needs no action.
-- delete from public.reports where id = 0;
