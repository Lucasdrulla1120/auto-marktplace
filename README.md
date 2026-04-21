# Local Marketplace Regional - Supabase Storage

Este pacote mantém o banco PostgreSQL que já existia no projeto (ex.: Render) e troca apenas o upload de imagens para o Supabase Storage.

## O que já está configurado
- upload de fotos de anúncios para o bucket `marketplace-media`
- upload de logo e banner da loja para o Supabase Storage
- frontend apontado para a URL e anon key do Supabase informadas
- backend apontado para a URL e service role do Supabase informadas
- `package-lock.json` original preservado

## O que você precisa manter do projeto antigo
No arquivo `backend/.env`, substitua apenas:
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`

pelos mesmos valores que já funcionavam no backend antigo.

## Passos no Supabase
1. Criar o bucket `marketplace-media`
2. Rodar `backend/prisma/sql/supabase-storage.sql` no SQL Editor
3. Publicar backend e frontend normalmente

## Observação importante
As chaves do Supabase foram preenchidas conforme você informou na conversa. Depois de validar tudo, rotacione essas chaves no painel do Supabase por segurança.
