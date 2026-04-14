# Auto Marketplace - caminho operacional para GitHub, Render e Vercel

## 1. Estrutura correta no GitHub
Na raiz do repositório precisam existir exatamente estes itens:

- `backend/`
- `frontend/`
- `render.yaml`
- `README-HOSPEDAGEM.md`

Se `backend` e `frontend` aparecerem na página principal do GitHub, está certo.

## 2. GitHub Desktop
1. Extraia este ZIP no computador.
2. No GitHub Desktop, use **File > Add local repository** ou clone seu repositório vazio.
3. Abra a pasta do repositório no Explorer.
4. Copie **o conteúdo deste ZIP** para dentro da pasta do repositório.
5. Volte ao GitHub Desktop.
6. Faça um commit, por exemplo: `primeiro envio do sistema`.
7. Clique em **Push origin**.

## 3. Render - banco PostgreSQL
1. No Render, clique em **New > PostgreSQL**.
2. Nome sugerido: `auto-marketplace-db`.
3. Crie o banco.
4. Copie a **Internal Database URL**.

## 4. Render - backend API
Crie um **Web Service** normal.

Campos principais:
- **Language**: `Node`
- **Root Directory**: `backend`
- **Dockerfile Path**: deixe vazio
- **Build Command**:
  `npm install && npx prisma generate && npx prisma db push && node prisma/seed.js && npm run build`
- **Start Command**:
  `npm run start`
- **Health Check Path**:
  `/api/health`

Variáveis de ambiente:
- `DATABASE_URL` = Internal Database URL do Render Postgres
- `JWT_SECRET` = uma senha forte, exemplo: `AutoMarketplace@2026LucasSeguro`
- `HOST` = `0.0.0.0`
- `PORT` = `10000`
- `NODE_ENV` = `production`

Observação: esse backend não precisa de compilação real. O script `build` existe só para o deploy do Render não falhar.

## 5. Teste do backend
Depois do deploy, abra:

`https://SEU-SERVICO.onrender.com/api/health`

Se aparecer um JSON com `status: ok`, o backend subiu.

## 6. Vercel - frontend
1. No Vercel, clique em **Add New > Project**.
2. Importe o mesmo repositório do GitHub.
3. Em **Root Directory**, selecione `frontend`.
4. Adicione a variável:
   - `VITE_API_URL` = `https://SEU-BACKEND.onrender.com/api`
5. Faça o deploy.

## 7. Teste do frontend
Depois do deploy no Vercel:
- abra o link do site
- teste login
- teste cadastro
- teste criar anúncio
- teste página de lojas

## 8. Mercado Pago depois
Quando backend e frontend estiverem funcionando online, aí sim configure:
- `MP_ACCESS_TOKEN`
- `MP_PUBLIC_KEY`
- `MP_WEBHOOK_SECRET`

E use o webhook público do backend.

## 9. Se der erro no Render
Confirme estes pontos:
- `Language = Node`
- `Root Directory = backend`
- `Dockerfile Path` vazio
- `DATABASE_URL` preenchida
- `Build Command` igual ao deste README

## 10. Credenciais demo
- Admin: `admin@automarket.local` / `admin123`
- Particular: `vendedor@automarket.local` / `user123`
- Premium demo: `premium@automarket.local` / `user123`
