const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired, adminRequired } = require('../middleware/auth');
const { createPixPayment, makeExternalRef, verifyWebhookSignature, hasMercadoPagoConfig, getPaymentById, normalizePaymentStatus } = require('../utils/mercadoPago');
const { addDays, runMarketplaceMaintenance, getCurrentSubscription } = require('../utils/marketplaceLifecycle');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

function getFeaturedPrice(days) {
  const normalizedDays = [7, 15, 30].includes(Number(days)) ? Number(days) : 7;
  const prices = { 7: 19.9, 15: 34.9, 30: 59.9 };
  return { days: normalizedDays, amount: prices[normalizedDays] };
}

async function validateFeaturedEligibility(user, listing) {
  if (user.role === 'ADMIN') return null;
  const subscription = await getCurrentSubscription(user.id);
  const featuredSlots = subscription?.plan?.featuredSlots ?? 0;

  if (!subscription?.plan) {
    return 'Você precisa de um plano ativo para destacar anúncios.';
  }
  if (featuredSlots <= 0) {
    return `Seu plano ${subscription.plan.name} não inclui destaques simultâneos.`;
  }

  const activeFeaturedCount = await prisma.listing.count({
    where: {
      userId: user.id,
      isFeatured: true,
      OR: [{ featuredUntil: null }, { featuredUntil: { gt: new Date() } }],
      status: 'APPROVED',
    },
  });

  const alreadyFeaturedAndActive = !!(listing.isFeatured && (!listing.featuredUntil || listing.featuredUntil > new Date()));
  if (!alreadyFeaturedAndActive && activeFeaturedCount >= featuredSlots) {
    return `Seu plano permite ${featuredSlots} destaque(s) simultâneo(s). Remova um destaque antes de contratar outro.`;
  }
  return null;
}

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
    data: { status: 'SUPERSEDED' },
  });

  const durationDays = payment.durationDays || 30;
  const baseDate = subscription.expiresAt && subscription.expiresAt > new Date() ? subscription.expiresAt : new Date();

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ACTIVE',
      paymentMethod: payment.provider === 'MERCADO_PAGO' ? 'MERCADO_PAGO_PIX' : payment.provider,
      startedAt: subscription.startedAt || new Date(),
      expiresAt: addDays(baseDate, durationDays),
    },
    include: { plan: true },
  });
}

async function activateFeaturedPayment(payment) {
  if (!payment?.listingId) return null;
  const listing = await prisma.listing.findUnique({ where: { id: payment.listingId } });
  if (!listing) return null;

  const durationDays = payment.durationDays || 7;
  const baseDate = listing.featuredUntil && listing.featuredUntil > new Date() ? listing.featuredUntil : new Date();

  return prisma.listing.update({
    where: { id: payment.listingId },
    data: { isFeatured: true, featuredUntil: addDays(baseDate, durationDays) },
  });
}

async function syncPaymentStatus(paymentId) {
  await runMarketplaceMaintenance();
  const payment = await prisma.payment.findUnique({ where: { id: Number(paymentId) }, include: { subscription: true, listing: true } });
  if (!payment) return null;

  let nextStatus = payment.status;
  let paidAt = payment.paidAt;

  if (payment.provider === 'MERCADO_PAGO' && payment.providerRef && hasMercadoPagoConfig()) {
    const remote = await getPaymentById(payment.providerRef);
    if (remote) {
      nextStatus = normalizePaymentStatus(remote.status);
      paidAt = nextStatus === 'PAID' ? new Date(remote.date_approved || Date.now()) : null;
    }
  } else if (payment.status === 'PENDING' && payment.expiresAt && payment.expiresAt < new Date()) {
    nextStatus = 'EXPIRED';
  }

  const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status: nextStatus, paidAt } });

  if (updated.type === 'PLAN' && updated.status === 'PAID') await activatePlanPayment(updated);
  if (updated.type === 'FEATURED' && updated.status === 'PAID') await activateFeaturedPayment(updated);

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
  await runMarketplaceMaintenance();
  const payments = await prisma.payment.findMany({
    where: { userId: req.user.id },
    include: {
      subscription: { include: { plan: true } },
      listing: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(payments);
});

router.post('/feature-listing', authRequired, rateLimit({ windowMs: 30 * 60 * 1000, max: 12, message: 'Muitas tentativas de destacar anúncios. Aguarde alguns minutos.' }), async (req, res) => {
  await runMarketplaceMaintenance();
  const listingId = Number(req.body.listingId);
  const featureOffer = getFeaturedPrice(req.body.days || 7);
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
  if (listing.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Sem permissão para destacar este anúncio.' });
  if (listing.status !== 'APPROVED' && req.user.role !== 'ADMIN') return res.status(400).json({ message: 'Somente anúncios aprovados podem receber destaque.' });

  const featuredEligibilityError = await validateFeaturedEligibility(req.user, listing);
  if (featuredEligibilityError) return res.status(400).json({ message: featuredEligibilityError });

  const externalRef = makeExternalRef('FEATURED', listingId);
  const checkout = await createPixPayment({
    amount: featureOffer.amount,
    description: `Destaque do anúncio ${listing.title} por ${featureOffer.days} dias`,
    payerEmail: req.user.email,
    externalRef,
  });

  const payment = await prisma.payment.create({
    data: {
      userId: req.user.id,
      listingId: listing.id,
      type: 'FEATURED',
      amount: featureOffer.amount,
      status: normalizePaymentStatus(checkout.status),
      provider: checkout.provider,
      providerRef: checkout.providerRef || null,
      externalRef,
      checkoutUrl: checkout.checkoutUrl || null,
      pixCode: checkout.qrCode || null,
      pixQrBase64: checkout.qrCodeBase64 || null,
      description: `Destaque do anúncio ${listing.title} por ${featureOffer.days} dias`,
      durationDays: featureOffer.days,
      expiresAt: checkout.expiresAt || null,
    },
  });

  res.status(201).json({ payment, checkout, featureDays: featureOffer.days });
});

router.post('/webhook/mercadopago', rateLimit({ windowMs: 60 * 1000, max: 120, message: 'Muitos eventos recebidos em pouco tempo.' }), async (req, res) => {
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
    },
  });

  if (!validSignature) {
    return res.status(401).json({ received: false, message: 'Assinatura inválida.' });
  }

  try {
    if (externalId) {
      const localPayment = await prisma.payment.findFirst({ where: { providerRef: externalId } });
      if (localPayment) await syncPaymentStatus(localPayment.id);
    }

    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processed: true, processingNote: 'Evento processado com sucesso.' } });
    return res.json({ received: true });
  } catch (error) {
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processingNote: error.message || 'Falha ao processar evento.' } });
    return res.status(500).json({ received: false, message: 'Falha ao processar webhook.' });
  }
});

router.get('/admin/all', authRequired, adminRequired, async (req, res) => {
  await runMarketplaceMaintenance();
  const payments = await prisma.payment.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      subscription: { include: { plan: true } },
      listing: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(payments);
});

router.post('/:id/refresh', authRequired, rateLimit({ windowMs: 60 * 1000, max: 20, message: 'Muitas atualizações de pagamento em pouco tempo.' }), async (req, res) => {
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

  if (payment.type === 'FEATURED' && normalized === 'PAID') await activateFeaturedPayment(payment);
  if (payment.type === 'PLAN' && normalized === 'PAID') await activatePlanPayment(payment);

  res.json(payment);
});

module.exports = router;
