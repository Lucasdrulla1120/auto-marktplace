# Versão Premium - melhorias e verificação

## O que foi melhorado
- vitrine premium nos cards de anúncios
- selo de anunciante verificado / confiável
- reforço comercial na home e na área de planos
- lojas com comunicação mais premium para Curitiba e região
- controle de validade de anúncios no backend e no painel
- botão para renovar anúncio diretamente no dashboard
- exibição de validade do anúncio no card e no painel

## Expiração de anúncios
Agora cada anúncio possui `expiresAt` no banco.

Regras implementadas:
- Particular: 30 dias
- Lojista: 45 dias
- Premium: 60 dias
- ao criar anúncio, o sistema define a validade automaticamente
- a manutenção do marketplace expira anúncios vencidos e remove destaque ativo vencido
- o usuário pode renovar um anúncio pelo endpoint `POST /api/listings/:id/renew`

## Expiração de assinatura
A assinatura já tinha suporte e foi auditada.

Verificado no backend:
- assinatura com `expiresAt`
- rotina de manutenção marca assinatura como `EXPIRED` quando vence
- pagamentos pendentes podem expirar
- ativação de pagamento renova a assinatura e encerra planos anteriores com `SUPERSEDED`

## Arquivos principais alterados
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.js`
- `backend/src/routes/listings.js`
- `backend/src/utils/marketplaceLifecycle.js`
- `frontend/src/App.jsx`
- `frontend/src/styles.css`

## Verificações executadas
- `npm run build` no frontend: OK
- `node -c` em rotas/utilitários principais do backend: OK
- `npx prisma validate`: OK

## Importante para subir em produção
Como foi adicionado o campo `expiresAt` em `Listing`, rode a migração do Prisma antes de publicar:

```bash
cd backend
npx prisma migrate dev --name add_listing_expiration
```

Se for ambiente já em produção, use o fluxo da sua esteira de deploy com migração do Prisma.
