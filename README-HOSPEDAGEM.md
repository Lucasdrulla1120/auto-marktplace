# Auto Marketplace V3.6 - pronto para hospedagem

Este pacote foi ajustado para hospedagem com:
- frontend no Vercel
- backend no Render
- banco PostgreSQL no Render

## Estrutura
- `frontend/` app React + Vite
- `backend/` API Express + Prisma
- `render.yaml` blueprint opcional do Render

## 1) Criar conta no GitHub
1. Entre em github.com
2. Clique em **New repository**
3. Dê um nome como `auto-marketplace`
4. Suba as pastas `frontend`, `backend`, o arquivo `render.yaml` e este README

## 2) Hospedar o banco no Render
1. Entre em render.com
2. Clique em **New > PostgreSQL**
3. Nome sugerido: `auto-marketplace-db`
4. Copie a `Internal Database URL` ou deixe o Render preencher automático quando usar o blueprint

## 3) Hospedar o backend no Render
1. Clique em **New > Web Service**
2. Conecte seu GitHub
3. Selecione o repositório
4. Root Directory: `backend`
5. Build Command: `npm install && npm run deploy:prepare`
6. Start Command: `npm start`
7. Environment: Node 20

### Variáveis do backend
Crie estas variáveis:
- `DATABASE_URL` = conexão do PostgreSQL
- `JWT_SECRET` = frase longa e secreta
- `HOST` = `0.0.0.0`
- `PORT` = `4000`
- `CORS_ORIGIN` = URL do seu frontend, ex: `https://seu-site.vercel.app,https://seudominio.com`
- `MP_ACCESS_TOKEN` = token do Mercado Pago
- `MP_PUBLIC_KEY` = chave pública do Mercado Pago
- `MP_WEBHOOK_URL` = `https://api.seudominio.com/api/payments/webhook/mercadopago`
- `MP_WEBHOOK_SECRET` = segredo do webhook

## 4) Hospedar o frontend no Vercel
1. Entre em vercel.com
2. Clique em **Add New > Project**
3. Importe o repositório
4. Configure o Root Directory como `frontend`
5. Variável obrigatória: `VITE_API_URL` = URL do backend + `/api`
   - exemplo: `https://auto-marketplace-api.onrender.com/api`
6. Deploy

## 5) Ligar domínio próprio
### Frontend
- no Vercel, abra o projeto
- vá em **Settings > Domains**
- adicione `seudominio.com`

### Backend
- no Render, abra o serviço da API
- vá em **Settings > Custom Domains**
- adicione `api.seudominio.com`

## 6) Configurar o Mercado Pago
1. Entre em Mercado Pago Developers
2. Abra **Suas integrações**
3. Copie `Public Key` e `Access Token`
4. Coloque as chaves no backend do Render
5. Configure o webhook apontando para:
   `https://api.seudominio.com/api/payments/webhook/mercadopago`

## 7) Checklist final
- backend abre `/api/health`
- frontend carrega a lista de anúncios
- cadastro e login funcionam
- criação de anúncio funciona
- página de lojas funciona
- upgrade gera Pix
- pagamento aprovado ativa o plano

## Observações importantes
- esta versão está pronta para PostgreSQL
- imagens ainda estão salvas como data URL/base64 em alguns fluxos; para produção pesada, migre isso para Cloudinary ou S3
- o webhook do Mercado Pago só funciona com o backend público em HTTPS
