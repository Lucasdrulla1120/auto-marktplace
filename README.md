# Auto Marketplace V3.2 Comercial

Versão focada em monetização e experiência comercial.

## Entradas principais da V3.2
- integração preparada para **painel operacional e Mercado Pago preparado / Pix**
- fallback em **simulação local** quando não houver token configurado
- contratação de plano com **Pix gerado na hora**
- pagamento aprovado com **ativação automática do plano**
- admin configurando **preço dos planos** no próprio painel
- cobranças de **destaque de anúncio**
- painel do anunciante com **pagamentos e ativações**
- painel admin com **controle de pagamentos e planos**
- leads com status
- anúncios com até 15 fotos e foto principal

## Requisitos
- Windows 11
- Node.js LTS (recomendado Node 20)

## Como rodar
1. Extraia o ZIP em uma pasta nova
2. Rode `setup-windows.bat`
3. Depois rode `run-windows.bat`

## URLs
- Frontend: http://127.0.0.1:3000
- API: http://127.0.0.1:4000/api/health

## Logins demo
- Admin: `admin@automarket.local` / `admin123`
- Usuário: `vendedor@automarket.local` / `user123`

## painel operacional e Mercado Pago preparado
Por padrão, o sistema sobe em **modo local** e gera cobranças simuladas.

Para ativar a cobrança real, edite `backend/.env` com:

```env
MP_ACCESS_TOKEN="SEU_ACCESS_TOKEN"
MP_PUBLIC_KEY="SUA_PUBLIC_KEY"
MP_WEBHOOK_URL="https://seu-dominio.com/api/payments/webhook/mercadopago"
MP_WEBHOOK_SECRET="seu-segredo-opcional"
```

### O que já está pronto
- criação de cobrança Pix para plano
- criação de cobrança Pix para destaque de anúncio
- armazenamento de pagamentos e referências externas
- endpoint de webhook para painel operacional e Mercado Pago preparado
- ativação manual pelo admin para teste local

### Próximos passos recomendados para hospedagem
- migrar SQLite para PostgreSQL
- ligar webhook público HTTPS
- mover imagens para Cloudinary ou S3
- enviar notificação por e-mail/WhatsApp quando o lead entrar


## Fluxo de contratação de plano
1. O anunciante escolhe o plano
2. O sistema gera o Pix imediatamente
3. O pagamento fica como **Aguardando pagamento**
4. O painel operacional e Mercado Pago preparado confirma o Pix via webhook
5. O sistema coloca a assinatura em **Em ativação** e depois **Ativo** automaticamente
6. O admin pode ajustar os preços no próprio painel
