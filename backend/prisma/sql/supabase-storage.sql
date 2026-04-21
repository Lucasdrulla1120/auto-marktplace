insert into storage.buckets (id, name, public)
values ('marketplace-media', 'marketplace-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read marketplace media" on storage.objects;
create policy "Public read marketplace media"
on storage.objects
for select
using (bucket_id = 'marketplace-media');
