# Local Marketplace Regional Sales Ready v5.0

Versao final reforcada para colocar no ar e comecar a vender na sua cidade com uma apresentacao mais profissional para clientes, lojistas e parceiros locais.

## O que entrou nesta versao
- slugs publicos para anuncios e lojas
- links publicos compartilhaveis por anuncio e por loja
- analytics do anunciante com views, favoritos, leads, WhatsApp e tempo medio de resposta
- rastreio de clique no WhatsApp por anuncio
- score de qualidade do anuncio
- leitura de preco vs media local quando houver base comparavel
- verificacao de loja no admin
- loja publica com status verificada, metricas e link proprio
- filtros mais fortes no feed, incluindo destaque e loja verificada
- pagina com metadados dinamicos para melhorar compartilhamento local
- protecoes extras de seguranca e rate limit em rotas sensiveis
- schema Prisma preparado para escalar melhor nas buscas e paineis

## Como rodar
1. Copie `backend/.env.example` para `backend/.env`
2. Copie `frontend/.env.example` para `frontend/.env`
3. No backend rode `npm install`
4. Rode `npx prisma generate`
5. Rode `npx prisma db push`
6. Rode `node prisma/seed.js`
7. No frontend rode `npm install`
8. Rode `npm run dev` no backend e no frontend

## Deploy recomendado
- backend: Render / Railway / VPS com Node 18+
- frontend: Vercel / Netlify
- banco: PostgreSQL gerenciado
- imagens: idealmente mover depois para Cloudinary ou S3

## Variaveis importantes
### Backend
- `DATABASE_URL`
- `JWT_SECRET`
- `API_URL`
- `APP_URL`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `REQUEST_BODY_LIMIT`
- `ENABLE_REQUEST_LOGS`
- `MP_ACCESS_TOKEN`
- `MP_PUBLIC_KEY`
- `MP_WEBHOOK_URL`
- `MP_WEBHOOK_SECRET`

### Frontend
- `VITE_API_URL`
- `VITE_MARKETPLACE_NAME`
- `VITE_MARKETPLACE_CITY`
- `VITE_MARKETPLACE_TAGLINE`

## Validacoes feitas
- frontend com build de producao via Vite
- backend com validacao de sintaxe nos arquivos principais
- schema Prisma revisado para refletir as novas metricas, slugs e verificacao de loja

## Observacao honesta
Neste ambiente eu nao consegui finalizar `npm install` do backend por causa de uma restricao externa ao baixar dependencia do Prisma. O codigo do backend foi validado por sintaxe, e o frontend buildou normalmente. Na sua maquina ou hospedagem, o fluxo padrao com `npm install`, `prisma generate` e `prisma db push` deve seguir normalmente.

## Login demo
- Admin: `admin@automarket.local` / `admin123`
- Usuario: `vendedor@automarket.local` / `user123`
- Loja Premium: `premium@automarket.local` / `user123`

## Arquivos para ler primeiro
- `MELHORIAS-IMPLEMENTADAS.md`
- `GUIA-LANCAMENTO-REGIONAL.md`
- `README-HOSPEDAGEM.md`
