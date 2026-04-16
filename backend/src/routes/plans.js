const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired, adminRequired } = require('../middleware/auth');
const { createPixPayment, makeExternalRef, hasMercadoPagoConfig, normalizePaymentStatus } = require('../utils/mercadoPago');
const { addDays, getCurrentSubscription, runMarketplaceMaintenance } = require('../utils/marketplaceLifecycle');

const router = express.Router();

function normalizePlanPayload(payload = {}) {
  const raw = payload || {};
  const slug = String(raw.slug || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const benefitsValue = Array.isArray(raw.benefits)
    ? raw.benefits.join('|')
    : String(raw.benefits || '')
        .split(/\r?\n|\|/)
        .map((item) => item.trim())
        .filter(Boolean)
        .join('|');

  return {
    slug,
    name: String(raw.name || '').trim(),
    priceMonthly: Number(raw.priceMonthly || 0),
    listingLimit: Number(raw.listingLimit || 0),
    featuredSlots: Number(raw.featuredSlots || 0),
    description: String(raw.description || '').trim(),
    benefits: benefitsValue || null,
    displayOrder: Number(raw.displayOrder || 0),
    isRecommended: raw.isRecommended === true || raw.isRecommended === 'true',
    isActive: raw.isActive !== false && raw.isActive !== 'false',
  };
}

function validatePlanPayload(data, { requireSlug = true } = {}) {
  if (!data.name) return 'Nome do plano é obrigatório.';
  if (requireSlug && !data.slug) return 'Slug do plano é obrigatório.';
  if (!Number.isFinite(data.priceMonthly) || data.priceMonthly < 0) return 'Preço inválido.';
  if (!Number.isInteger(data.listingLimit) || data.listingLimit < 0) return 'Limite de anúncios inválido.';
  if (!Number.isInteger(data.featuredSlots) || data.featuredSlots < 0) return 'Quantidade de destaques inválida.';
  if (!Number.isInteger(data.displayOrder) || data.displayOrder < 0) return 'Ordem de exibição inválida.';
  if (!data.description) return 'Descrição do plano é obrigatória.';
  return null;
}

router.get('/', async (req, res) => {
  await runMarketplaceMaintenance();
  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { priceMonthly: 'asc' }] });
  res.json(plans);
});

router.get('/my-subscription', authRequired, async (req, res) => {
  await runMarketplaceMaintenance();
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: req.user.id,
      status: { in: ['ACTIVE', 'ACTIVATING', 'PENDING_PAYMENT', 'PAST_DUE'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      plan: true,
      user: { select: { id: true, name: true, companyName: true, storeName: true, storeLogoUrl: true, storeBannerUrl: true, storeDescription: true, storeCity: true, storeNeighborhood: true, storeWhatsapp: true, storeInstagram: true, storeWebsite: true, storeIsActive: true } },
    },
    orderBy: { startedAt: 'desc' },
  });
  res.json(subscription);
});

router.post('/subscribe', authRequired, async (req, res) => {
  await runMarketplaceMaintenance();
  const { planId } = req.body;
  const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
  if (!plan || !plan.isActive) return res.status(404).json({ message: 'Plano não encontrado ou inativo.' });

  const currentActiveSubscription = await getCurrentSubscription(req.user.id);
  if (currentActiveSubscription?.planId === plan.id) return res.status(400).json({ message: 'Este já é o seu plano atual.' });

  const existingPending = await prisma.subscription.findFirst({
    where: { userId: req.user.id, planId: plan.id, status: 'PENDING_PAYMENT', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { plan: true },
    orderBy: { startedAt: 'desc' },
  });

  if (existingPending) {
    const latestPayment = await prisma.payment.findFirst({ where: { subscriptionId: existingPending.id }, orderBy: { createdAt: 'desc' } });
    return res.status(200).json({
      subscription: existingPending,
      payment: latestPayment,
      checkout: latestPayment ? {
        mode: latestPayment.provider === 'MERCADO_PAGO' ? 'MERCADO_PAGO_PIX' : 'LOCAL_SIMULATION',
        instructions: 'Você já possui uma cobrança pendente para este plano.',
        pixCode: latestPayment.pixCode,
        pixQrBase64: latestPayment.pixQrBase64,
        checkoutUrl: latestPayment.checkoutUrl,
        paymentId: latestPayment.id,
      } : null,
      message: 'Você já possui um upgrade pendente para este plano.',
    });
  }

  const externalRef = makeExternalRef('PLAN', req.user.id);
  const subscription = await prisma.subscription.create({
    data: {
      userId: req.user.id,
      planId: plan.id,
      status: plan.priceMonthly > 0 ? 'PENDING_PAYMENT' : 'ACTIVE',
      billingCycle: 'MONTHLY',
      paymentMethod: hasMercadoPagoConfig() ? 'MERCADO_PAGO_PIX' : 'LOCAL_SIMULATION',
      externalRef,
      mercadoPagoPayerEmail: req.user.email,
      startedAt: new Date(),
      expiresAt: plan.priceMonthly > 0 ? addDays(new Date(), 30) : null,
    },
    include: { plan: true },
  });

  if (plan.priceMonthly <= 0) return res.status(201).json({ subscription, checkout: null, message: 'Plano gratuito ativado.' });

  const checkout = await createPixPayment({
    amount: plan.priceMonthly,
    description: `Assinatura do plano ${plan.name}`,
    payerEmail: req.user.email,
    externalRef,
  });

  const payment = await prisma.payment.create({
    data: {
      userId: req.user.id,
      subscriptionId: subscription.id,
      type: 'PLAN',
      status: normalizePaymentStatus(checkout.status),
      amount: plan.priceMonthly,
      provider: checkout.provider,
      providerRef: checkout.providerRef || null,
      externalRef,
      checkoutUrl: checkout.checkoutUrl || null,
      pixCode: checkout.qrCode || null,
      pixQrBase64: checkout.qrCodeBase64 || null,
      description: `Cobrança do plano ${plan.name}`,
      durationDays: 30,
      expiresAt: checkout.expiresAt || null,
    },
  });

  res.status(201).json({
    subscription,
    payment,
    checkout: {
      mode: hasMercadoPagoConfig() ? 'MERCADO_PAGO_PIX' : 'LOCAL_SIMULATION',
      instructions: hasMercadoPagoConfig()
        ? 'Abra o checkout/Pix para concluir o pagamento. Após a confirmação, o plano é ativado automaticamente.'
        : `Modo local: configure MP_ACCESS_TOKEN para cobrança real. Referência ${externalRef}.`,
      checkoutUrl: checkout.checkoutUrl || null,
      pixCode: checkout.qrCode || null,
      pixQrBase64: checkout.qrCodeBase64 || null,
      amount: plan.priceMonthly,
      expiresAt: checkout.expiresAt || null,
    },
  });
});

router.get('/admin/plans', authRequired, adminRequired, async (req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] });
  res.json(plans);
});

router.post('/admin/plans', authRequired, adminRequired, async (req, res) => {
  const data = normalizePlanPayload(req.body);
  const validation = validatePlanPayload(data);
  if (validation) return res.status(400).json({ message: validation });

  const exists = await prisma.plan.findUnique({ where: { slug: data.slug } }).catch(() => null);
  if (exists) return res.status(400).json({ message: 'Já existe um plano com esse slug.' });

  const created = await prisma.plan.create({ data });
  res.status(201).json(created);
});

router.patch('/admin/plans/:id', authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.plan.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return res.status(404).json({ message: 'Plano não encontrado.' });

  const normalized = normalizePlanPayload({ ...existing, ...req.body, slug: req.body.slug ?? existing.slug });
  const validation = validatePlanPayload(normalized);
  if (validation) return res.status(400).json({ message: validation });

  const slugOwner = await prisma.plan.findUnique({ where: { slug: normalized.slug } }).catch(() => null);
  if (slugOwner && slugOwner.id !== id) return res.status(400).json({ message: 'Já existe outro plano com esse slug.' });

  const updated = await prisma.plan.update({ where: { id }, data: normalized });
  res.json(updated);
});

router.delete('/admin/plans/:id', authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.plan.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return res.status(404).json({ message: 'Plano não encontrado.' });

  const subscriptionsCount = await prisma.subscription.count({ where: { planId: id } });
  if (subscriptionsCount > 0) {
    const updated = await prisma.plan.update({ where: { id }, data: { isActive: false } });
    return res.json({ message: 'Plano inativado porque já possui assinaturas vinculadas.', plan: updated });
  }

  await prisma.plan.delete({ where: { id } });
  res.json({ success: true });
});

router.get('/admin/subscriptions', authRequired, adminRequired, async (req, res) => {
  await runMarketplaceMaintenance();
  const subscriptions = await prisma.subscription.findMany({
    include: { user: { select: { id: true, name: true, email: true } }, plan: true },
    orderBy: { startedAt: 'desc' },
  });
  res.json(subscriptions);
});

router.patch('/admin/subscriptions/:id/status', authRequired, adminRequired, async (req, res) => {
  const { status } = req.body;
  const allowed = ['PENDING_PAYMENT', 'ACTIVATING', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Status inválido.' });
  const updated = await prisma.subscription.update({ where: { id: Number(req.params.id) }, data: { status }, include: { plan: true, user: true } });
  res.json(updated);
});

module.exports = router;
