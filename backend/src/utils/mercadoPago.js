const crypto = require('crypto');

const MP_API_BASE = process.env.MP_API_BASE || 'https://api.mercadopago.com';

function hasMercadoPagoConfig() {
  return !!process.env.MP_ACCESS_TOKEN;
}

function makeExternalRef(prefix, entityId) {
  return `${prefix}-${entityId}-${Date.now()}`;
}

async function mpFetch(path, options = {}) {
  const response = await fetch(`${MP_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || data.error || 'Erro na API do Mercado Pago.';
    throw new Error(message);
  }
  return data;
}

function simulatedPix(amount, externalRef, description) {
  return {
    provider: 'LOCAL_SIMULATION',
    checkoutUrl: null,
    qrCode: `00020126360014BR.GOV.BCB.PIX0114+550000000000520400005303986540${String(amount.toFixed(2)).replace('.', '')}5802BR5913AUTO MARKET6009SAO PAULO62070503***6304${crypto.createHash('md5').update(externalRef).digest('hex').slice(0,4).toUpperCase()}`,
    qrCodeBase64: null,
    description: description || 'Cobrança simulada local',
    expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    instructions: `Modo local: configure MP_ACCESS_TOKEN para ativar checkout real. Referência ${externalRef}.`,
  };
}

async function createPixPayment({ amount, description, payerEmail, externalRef }) {
  if (!hasMercadoPagoConfig()) {
    return simulatedPix(amount, externalRef, description);
  }

  const body = {
    transaction_amount: Number(amount),
    description,
    payment_method_id: 'pix',
    payer: {
      email: payerEmail || process.env.MP_DEFAULT_PAYER_EMAIL || 'comprador@example.com',
    },
    external_reference: externalRef,
    notification_url: process.env.MP_WEBHOOK_URL || undefined,
  };

  const data = await mpFetch('/v1/payments', { method: 'POST', body: JSON.stringify(body) });
  return {
    provider: 'MERCADO_PAGO',
    providerRef: String(data.id),
    checkoutUrl: data.point_of_interaction?.transaction_data?.ticket_url || null,
    qrCode: data.point_of_interaction?.transaction_data?.qr_code || null,
    qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 || null,
    expiresAt: data.date_of_expiration ? new Date(data.date_of_expiration) : new Date(Date.now() + 1000 * 60 * 30),
    status: data.status || 'pending',
    raw: data,
  };
}

function verifyWebhookSignature() {
  return true;
}

module.exports = {
  hasMercadoPagoConfig,
  makeExternalRef,
  createPixPayment,
  verifyWebhookSignature,
};
