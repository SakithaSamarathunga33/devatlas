-- Community reads need a signed-in account.
--
-- The app only shows Community after GitHub sign-in, but the public API key let anyone read
-- every profile, collection and link straight from PostgREST: scraping usernames and burning
-- egress. Reads now need the authenticated role; the anon role keeps no access at all.
-- Write paths, follows and reports are unchanged.

revoke select on public.profiles, public.shared_collections, public.shared_links from anon;

alter policy "profiles are public" on public.profiles to authenticated;
alter policy "profiles are public" on public.profiles
  rename to "signed-in users see profiles";

-- The original name was longer than 63 characters, so Postgres stored it cut short; the same
-- cut applies here.
alter policy "published collections are public; owners also see their hidden ones"
  on public.shared_collections to authenticated;
alter policy "published collections are public; owners also see their hidden ones"
  on public.shared_collections
  rename to "signed-in users see published collections; owners their hidden";

alter policy "links of visible collections are public" on public.shared_links to authenticated;
alter policy "links of visible collections are public" on public.shared_links
  rename to "signed-in users see links of visible collections";
