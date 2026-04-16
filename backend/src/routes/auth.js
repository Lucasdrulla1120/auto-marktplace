const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { authRequired } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { getCurrentSubscription, runMarketplaceMaintenance } = require('../utils/marketplaceLifecycle');
const { sanitizeString, normalizePhone, isValidEmail, passwordValidationError } = require('../utils/helpers');

async function ensureDefaultPlanSubscription(userId, email) {
  await runMarketplaceMaintenance();
  const current = await getCurrentSubscription(userId);
  if (current) return current;

  const pending = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['PENDING_PAYMENT', 'ACTIVATING'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { plan: true },
    orderBy: { startedAt: 'desc' },
  });
  if (pending) return pending;

  const plan = await prisma.plan.findUnique({ where: { slug: 'particular' } }).catch(() => null);
  if (!plan) return null;

  return prisma.subscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      paymentMethod: 'DEFAULT_PARTICULAR',
      startedAt: new Date(),
      expiresAt: null,
      externalRef: `DEFAULT-PARTICULAR-${userId}`,
      mercadoPagoPayerEmail: email || null,
    },
    include: { plan: true },
  });
}

async function cleanupExpiredPasswordTokens() {
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => null);
}

function buildRecoveryCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function serializeUser(user, subscription = null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    companyName: user.companyName,
    storeName: user.storeName,
    storeSlug: user.storeSlug,
    storeIsActive: !!user.storeIsActive,
    storeIsVerified: !!user.storeIsVerified,
    subscription,
  };
}

const router = express.Router();

router.post('/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Muitas tentativas de cadastro. Aguarde alguns minutos.' }), async (req, res) => {
  try {
    const name = sanitizeString(req.body.name, 120);
    const email = sanitizeString(req.body.email, 120).toLowerCase();
    const phone = normalizePhone(req.body.phone) || sanitizeString(req.body.phone, 30);
    const password = String(req.body.password || '');

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Informe um e-mail válido.' });
    const passwordError = passwordValidationError(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ message: 'E-mail já cadastrado.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash, role: 'USER' },
    });
    const subscription = await ensureDefaultPlanSubscription(user.id, user.email);

    return res.status(201).json(serializeUser(user, subscription));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao cadastrar usuário.' });
  }
});

router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 40, message: 'Muitas tentativas de login. Aguarde um pouco antes de tentar de novo.' }), async (req, res) => {
  try {
    const email = sanitizeString(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Informe e-mail e senha.' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Credenciais inválidas.' });

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) return res.status(401).json({ message: 'Credenciais inválidas.' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const subscription = await ensureDefaultPlanSubscription(user.id, user.email);
    return res.json({ token, user: serializeUser(user, subscription) });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao fazer login.' });
  }
});

router.post('/forgot-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 12, message: 'Muitas tentativas de recuperação. Aguarde alguns minutos.' }), async (req, res) => {
  try {
    const email = sanitizeString(req.body.email, 120).toLowerCase();
    if (!email) return res.status(400).json({ message: 'Informe o e-mail cadastrado.' });
    await cleanupExpiredPasswordTokens();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ message: 'Se o e-mail existir, enviaremos um código de recuperação.' });

    const plainCode = buildRecoveryCode();
    const tokenHash = crypto.createHash('sha256').update(plainCode).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }).catch(() => null);
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: `Código de recuperação de senha - ${process.env.MARKETPLACE_NAME || 'Marketplace local'}`,
        text: `Olá! Seu código de recuperação é ${plainCode}. Ele expira em 15 minutos.`,
      });
      return res.json({ message: 'Enviamos um código de recuperação para o seu e-mail.', delivery: 'EMAIL_CODE' });
    }

    return res.status(503).json({ message: 'Envio por e-mail não configurado. Defina as variáveis SMTP no backend.' });
  } catch (error) {
    return res.status(500).json({ message: 'Não foi possível iniciar a recuperação de senha.' });
  }
});

router.post('/reset-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Muitas tentativas de redefinição. Aguarde alguns minutos.' }), async (req, res) => {
  try {
    const email = sanitizeString(req.body.email, 120).toLowerCase();
    const code = sanitizeString(req.body.code, 12);
    const password = String(req.body.password || '');
    if (!email || !code || !password) return res.status(400).json({ message: 'E-mail, código e nova senha são obrigatórios.' });
    const passwordError = passwordValidationError(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    await cleanupExpiredPasswordTokens();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Código inválido ou expirado.' });

    const tokenHash = crypto.createHash('sha256').update(String(code)).digest('hex');
    const record = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id, tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) return res.status(400).json({ message: 'Código inválido ou expirado.' });

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Não foi possível redefinir a senha.' });
  }
});

router.post('/change-password', authRequired, rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Muitas tentativas de troca de senha. Aguarde um pouco.' }), async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Informe a senha atual e a nova senha.' });
    const passwordError = passwordValidationError(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const passwordOk = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!passwordOk) return res.status(400).json({ message: 'Senha atual inválida.' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Não foi possível alterar a senha.' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  const favoriteCount = await prisma.favorite.count({ where: { userId: req.user.id } });
  const listingCount = await prisma.listing.count({ where: { userId: req.user.id } });
  const activeSubscription = await ensureDefaultPlanSubscription(req.user.id, req.user.email);

  return res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    phone: req.user.phone,
    role: req.user.role,
    companyName: req.user.companyName,
    storeName: req.user.storeName,
    storeSlug: req.user.storeSlug,
    storeIsActive: !!req.user.storeIsActive,
    storeIsVerified: !!req.user.storeIsVerified,
    subscription: activeSubscription,
    metrics: req.user.role === 'ADMIN'
      ? { favoriteCount, listingCount }
      : { favoriteCount, listingCount },
  });
});

module.exports = router;
