# Local Marketplace Regional Upgrade v4.5

Pacote melhorado para vender melhor em uma cidade ou regiao, com foco em operacao local, seguranca, confianca comercial e busca mais proxima de Webmotors/OLX.

## O que mudou nesta versao
- moderacao real: anuncio novo ou editado volta para analise
- listagem publica mais segura: sem exposicao indevida de anuncios nao aprovados
- busca avancada no frontend e backend
- paginação no feed principal
- compressao de imagens no navegador antes do upload
- regras de destaque corrigidas para 7, 15 e 30 dias
- expiração automatica de destaques, pagamentos pendentes e assinaturas vencidas
- limite de destaque simultaneo respeitando o plano
- painel admin com aprovacao, rejeicao e retorno para analise
- lojas publicas mais consistentes, considerando assinatura ativa
- checkout e polling menos pesados
- branding por cidade via variaveis de ambiente

## Como rodar
1. Copie `backend/.env.example` para `backend/.env`
2. Copie `frontend/.env.example` para `frontend/.env`
3. No backend rode `npm install`
4. Rode `npx prisma generate`
5. Rode `npx prisma db push`
6. Rode `node prisma/seed.js`
7. No frontend rode `npm install`
8. Rode `npm run dev` no backend e no frontend

## Variaveis novas importantes
### Frontend
- `VITE_MARKETPLACE_NAME`
- `VITE_MARKETPLACE_CITY`
- `VITE_MARKETPLACE_TAGLINE`

### Backend
- `REQUEST_BODY_LIMIT`

## Validacoes feitas
- frontend com build de producao via Vite
- backend com validacao de sintaxe dos principais arquivos

## Observacao importante
Neste ambiente, a instalacao completa do backend nao terminou por uma restricao de autenticacao ao baixar um pacote interno do Prisma. O codigo foi validado por sintaxe e o frontend buildou normalmente. Em hospedagem comum ou na sua maquina, o fluxo normal de `npm install` + `prisma generate` deve seguir com suas credenciais e acesso padrao ao npm.

## Logins demo
- Admin: `admin@automarket.local` / `admin123`
- Usuario: `vendedor@automarket.local` / `user123`
- Loja: `premium@automarket.local` / `user123`
