const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { authRequired } = require('../middleware/auth');
const { getCurrentSubscription, runMarketplaceMaintenance } = require('../utils/marketplaceLifecycle');

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
    include: { plan: true }
  });
}

async function cleanupExpiredPasswordTokens() {
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => null);
}

function buildRecoveryCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const router = express.Router();

function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

function validatePassword(password = '') {
  return String(password || '').trim().length >= 6;
}

router.post('/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    }
    if (!validatePassword(password)) return res.status(400).json({ message: 'A senha precisa ter pelo menos 6 caracteres.' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ message: 'E-mail já cadastrado.' });

    if (!validatePassword(password)) return res.status(400).json({ message: 'A nova senha precisa ter pelo menos 6 caracteres.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, phone, passwordHash, role: 'USER' } });
    await ensureDefaultPlanSubscription(user.id, user.email);

    return res.status(201).json({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao cadastrar usuário.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Credenciais inválidas.' });

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) return res.status(401).json({ message: 'Credenciais inválidas.' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao fazer login.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
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
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: 'Código de recuperação de senha - Local Marketplace',
        text: `Olá! Seu código de recuperação é ${plainCode}. Ele expira em 15 minutos.`
      });
      return res.json({ message: 'Enviamos um código de recuperação para o seu e-mail.', delivery: 'EMAIL_CODE' });
    }

    return res.status(503).json({ message: 'Envio por e-mail não configurado. Defina as variáveis SMTP no backend.' });
  } catch (error) {
    return res.status(500).json({ message: 'Não foi possível iniciar a recuperação de senha.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();
    const password = String(req.body.password || '');
    if (!email || !code || !password) return res.status(400).json({ message: 'E-mail, código e nova senha são obrigatórios.' });
    await cleanupExpiredPasswordTokens();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Código inválido ou expirado.' });

    const tokenHash = crypto.createHash('sha256').update(String(code)).digest('hex');
    const record = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id, tokenHash, usedAt: null, expiresAt: { gt: new Date() } }
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

router.post('/change-password', authRequired, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Informe a senha atual e a nova senha.' });
    const passwordOk = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!passwordOk) return res.status(400).json({ message: 'Senha atual inválida.' });
    if (!validatePassword(newPassword)) return res.status(400).json({ message: 'A nova senha precisa ter pelo menos 6 caracteres.' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Não foi possível alterar a senha.' });
  }
});


router.put('/me', authRequired, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const phone = String(req.body.phone || '').trim();
    const companyName = String(req.body.companyName || '').trim() || null;

    if (!name || !email || !phone) {
      return res.status(400).json({ message: 'Nome, e-mail e telefone são obrigatórios.' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email, id: { not: req.user.id } },
      select: { id: true }
    });
    if (existingUser) return res.status(409).json({ message: 'Este e-mail já está em uso.' });

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, email, phone, companyName },
    });

    const favoriteCount = await prisma.favorite.count({ where: { userId: req.user.id } });
    const listingCount = await prisma.listing.count({ where: { userId: req.user.id } });
    const activeSubscription = await ensureDefaultPlanSubscription(req.user.id, updatedUser.email);

    return res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      companyName: updatedUser.companyName,
      subscription: activeSubscription,
      metrics: updatedUser.role === 'ADMIN' ? { favoriteCount, listingCount } : { favoriteCount }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Não foi possível atualizar seus dados.' });
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
    subscription: activeSubscription,
    metrics: req.user.role === 'ADMIN' ? { favoriteCount, listingCount } : { favoriteCount }
  });
});

module.exports = router;
