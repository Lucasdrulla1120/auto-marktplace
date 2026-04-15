# Hospedagem e produção

## Render backend
- Language: Node
- Root Directory: backend
- Build Command: `npm install && npx prisma generate && npx prisma db push && node prisma/seed.js && npm run build`
- Start Command: `npm run start`
- Health Check Path: `/api/health`

### Variáveis de ambiente
- `DATABASE_URL`: URL interna do PostgreSQL
- `JWT_SECRET`: chave forte
- `HOST=0.0.0.0`
- `PORT=10000`
- `NODE_ENV=production`
- `APP_URL=https://SEU-FRONTEND.vercel.app`
- `API_URL=https://SEU-BACKEND.onrender.com`
- `CORS_ORIGIN=https://SEU-FRONTEND.vercel.app`
- `MP_ACCESS_TOKEN=SEU_ACCESS_TOKEN`
- `MP_PUBLIC_KEY=SUA_PUBLIC_KEY`
- `MP_WEBHOOK_URL=https://SEU-BACKEND.onrender.com/api/payments/webhook/mercadopago`
- `MP_WEBHOOK_SECRET=SUA_CHAVE_DE_VALIDACAO`

## Vercel frontend
- Root Directory: frontend
- Variável: `VITE_API_URL=https://SEU-BACKEND.onrender.com/api`

## Mercado Pago
1. Criar aplicação em Suas integrações.
2. Pegar Public Key e Access Token.
3. Cadastrar chave Pix na conta.
4. Preencher variáveis no Render.
5. Configurar webhook apontando para `/api/payments/webhook/mercadopago`.
6. Testar upgrade do plano.

## Fluxo
- Particular continua grátis e ativo.
- Upgrade gera Pix.
- Pagamento aprovado ativa o plano automaticamente.
- Cobrança pendente não derruba o plano atual.
