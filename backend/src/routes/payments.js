const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired, adminRequired } = require('../middleware/auth');
const { createPixPayment, makeExternalRef, verifyWebhookSignature, hasMercadoPagoConfig, getPaymentById, normalizePaymentStatus } = require('../utils/mercadoPago');

const router = express.Router();

async function activatePlanPayment(payment) {
  if (!payment?.subscriptionId) return null;
  const subscription = await prisma.subscription.findUnique({ where: { id: payment.subscriptionId }, include: { plan: true } });
  if (!subscription) return null;

  await prisma.subscription.updateMany({
    where: {
      userId: subscription.userId,
      id: { not: subscription.id },
      status: { in: ['ACTIVE', 'ACTIVATING', 'PENDING_PAYMENT', 'PAST_DUE'] },
    },
    data: { status: 'SUPERSEDED' }
  });

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ACTIVE',
      paymentMethod: payment.provider === 'MERCADO_PAGO' ? 'MERCADO_PAGO_PIX' : payment.provider,
      startedAt: subscription.startedAt || new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
    include: { plan: true }
  });
}

async function activateFeaturedPayment(payment) {
  if (!payment?.listingId) return null;
  return prisma.listing.update({
    where: { id: payment.listingId },
    data: { isFeatured: true, featuredUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) }
  });
}

async function syncPaymentStatus(paymentId) {
  const payment = await prisma.payment.findUnique({ where: { id: Number(paymentId) }, include: { subscription: true, listing: true } });
  if (!payment) return null;

  let nextStatus = payment.status;
  let paidAt = payment.paidAt;

  if (payment.provider === 'MERCADO_PAGO' && payment.providerRef && hasMercadoPagoConfig()) {
    const remote = await getPaymentById(payment.providerRef);
    nextStatus = normalizePaymentStatus(remote.status);
    paidAt = nextStatus === 'PAID' ? new Date(remote.date_approved || Date.now()) : null;
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: nextStatus, paidAt }
  });

  if (updated.type === 'PLAN' && updated.status === 'PAID') {
    await activatePlanPayment(updated);
  }

  if (updated.type === 'FEATURED' && updated.status === 'PAID') {
    await activateFeaturedPayment(updated);
  }

  return updated;
}

router.get('/config', (req, res) => {
  res.json({
    enabled: hasMercadoPagoConfig(),
    provider: hasMercadoPagoConfig() ? 'MERCADO_PAGO' : 'LOCAL_SIMULATION',
    webhookConfigured: !!process.env.MP_WEBHOOK_URL,
    publicKeyConfigured: !!process.env.MP_PUBLIC_KEY,
    productionReady: !!(process.env.MP_ACCESS_TOKEN && process.env.MP_WEBHOOK_URL && process.env.APP_URL),
  });
});

router.get('/mine', authRequired, async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.user.id },
    include: {
      subscription: { include: { plan: true } },
      listing: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(payments);
});

router.post('/feature-listing', authRequired, async (req, res) => {
  const listingId = Number(req.body.listingId);
  const days = Number(req.body.days || 7);
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
  if (listing.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Sem permissão para destacar este anúncio.' });

  const prices = { 7: 19.9, 15: 34.9, 30: 59.9 };
  const amount = prices[days] || prices[7];
  const externalRef = makeExternalRef('FEATURED', listingId);
  const checkout = await createPixPayment({
    amount,
    description: `Destaque do anúncio ${listing.title} por ${days} dias`,
    payerEmail: req.user.email,
    externalRef,
  });

  const payment = await prisma.payment.create({
    data: {
      userId: req.user.id,
      listingId: listing.id,
      type: 'FEATURED',
      amount,
      status: normalizePaymentStatus(checkout.status),
      provider: checkout.provider,
      providerRef: checkout.providerRef || null,
      externalRef,
      checkoutUrl: checkout.checkoutUrl || null,
      pixCode: checkout.qrCode || null,
      pixQrBase64: checkout.qrCodeBase64 || null,
      description: `Destaque do anúncio ${listing.title}`,
      expiresAt: checkout.expiresAt || null,
    }
  });

  res.status(201).json({ payment, checkout, featureDays: days });
});

router.post('/webhook/mercadopago', async (req, res) => {
  const validSignature = verifyWebhookSignature(req);
  const externalId = req.body.data?.id ? String(req.body.data.id) : null;
  const event = await prisma.webhookEvent.create({
    data: {
      provider: 'MERCADO_PAGO',
      topic: req.query.topic ? String(req.query.topic) : null,
      action: req.body.action ? String(req.body.action) : null,
      externalId,
      payload: JSON.stringify(req.body),
      processed: false,
      processingNote: validSignature ? 'Recebido para processamento.' : 'Assinatura não validada.',
    }
  });

  if (!validSignature) {
    return res.status(401).json({ received: false, message: 'Assinatura inválida.' });
  }

  try {
    if (externalId) {
      const localPayment = await prisma.payment.findFirst({ where: { providerRef: externalId } });
      if (localPayment) {
        await syncPaymentStatus(localPayment.id);
      }
    }

    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processed: true, processingNote: 'Evento processado com sucesso.' } });
    return res.json({ received: true });
  } catch (error) {
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processingNote: error.message || 'Falha ao processar evento.' } });
    return res.status(500).json({ received: false, message: 'Falha ao processar webhook.' });
  }
});

router.get('/admin/all', authRequired, adminRequired, async (req, res) => {
  const payments = await prisma.payment.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      subscription: { include: { plan: true } },
      listing: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(payments);
});

router.post('/:id/refresh', authRequired, async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: Number(req.params.id) }, include: { subscription: true, listing: true } });
  if (!payment) return res.status(404).json({ message: 'Pagamento não encontrado.' });
  if (payment.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Sem permissão para atualizar este pagamento.' });

  const refreshed = await syncPaymentStatus(payment.id);
  res.json(refreshed);
});

router.patch('/admin/:id/status', authRequired, adminRequired, async (req, res) => {
  const { status } = req.body;
  const normalized = normalizePaymentStatus(status);
  const payment = await prisma.payment.update({ where: { id: Number(req.params.id) }, data: { status: normalized, paidAt: normalized === 'PAID' ? new Date() : null } });

  if (payment.type === 'FEATURED' && normalized === 'PAID') {
    await activateFeaturedPayment(payment);
  }

  if (payment.type === 'PLAN' && normalized === 'PAID') {
    await activatePlanPayment(payment);
  }

  res.json(payment);
});

module.exports = router;
