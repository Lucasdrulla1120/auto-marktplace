# Melhorias implementadas

## Produto e vendas
- branding configuravel por nome da marca, cidade e tagline
- mensagem de WhatsApp mais comercial, com titulo do anuncio e cidade
- filtros mais completos para facilitar comparacao e compra local
- paginação no feed para melhorar experiencia e escalar catalogo
- destaque comercial com duracao correta e expiracao automatica

## Seguranca e operacao
- remocao do uso inseguro de `x-user-id` em rotas publicas
- anuncios nao aprovados visiveis apenas para dono ou admin
- anuncio novo e anuncio editado voltam para moderacao
- deduplicacao basica de lead por telefone em janela de 12 horas

## Performance
- compressao de imagem no navegador antes do envio
- payload HTTP configuravel por ambiente
- debounce na busca do feed
- polling de pagamento menos agressivo
- indices no schema Prisma para buscas e paineis

## Comercial e planos
- assinatura ativa considera expiracao real
- destaque simultaneo respeita limite do plano
- pagamentos pendentes expiram automaticamente
- stores publicas exigem assinatura valida
- dashboard admin revisado para refletir estado comercial mais real

## Arquivos mais alterados
- `backend/src/routes/listings.js`
- `backend/src/routes/payments.js`
- `backend/src/routes/plans.js`
- `backend/src/routes/admin.js`
- `backend/src/routes/stores.js`
- `backend/src/routes/auth.js`
- `backend/prisma/schema.prisma`
- `frontend/src/App.jsx`

## Proximo passo recomendado
Antes de trafego pago forte, vale fazer 3 coisas: mover imagens para Cloudinary/S3, colocar dominio proprio com SEO local e ligar webhooks reais de pagamento.
