-- Execute este script no SQL Editor do Supabase.
-- Bucket público para servir imagens do marketplace.
-- O upload é autorizado pelo backend via signed upload URL usando a service_role.

insert into storage.buckets (id, name, public)
values ('marketplace-media', 'marketplace-media', true)
on conflict (id) do update set public = true;

-- Apenas leitura pública é necessária para servir as imagens.
drop policy if exists "Public read marketplace media" on storage.objects;
create policy "Public read marketplace media"
on storage.objects
for select
using (bucket_id = 'marketplace-media');
