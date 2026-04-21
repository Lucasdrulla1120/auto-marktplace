# Supabase para imagens

Este pacote mantém o PostgreSQL existente (ex.: Render) e troca apenas o upload de imagens para o Supabase Storage.

## O que já foi apontado
- frontend para a URL e anon key do Supabase
- backend para a URL e service role do Supabase
- bucket esperado: `marketplace-media`

## O que você ainda precisa garantir
- manter `DATABASE_URL`, `DIRECT_URL` e `JWT_SECRET` originais do projeto antigo no backend
- criar o bucket `marketplace-media` no Supabase
- rodar `backend/prisma/sql/supabase-storage.sql` no SQL Editor do Supabase
