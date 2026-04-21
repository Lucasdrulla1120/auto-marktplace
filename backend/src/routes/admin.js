const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired, adminRequired } = require('../middleware/auth');
const { addDays, runMarketplaceMaintenance } = require('../utils/marketplaceLifecycle');

const router = express.Router();
router.use(authRequired, adminRequired);

router.get('/dashboard', async (req, res) => {
  await runMarketplaceMaintenance();
  const [users, listings, favorites, featured, activeSubscriptions, bannedUsers] = await Promise.all([
    prisma.user.count({ where: { role: { not: 'BANNED' } } }),
    prisma.listing.count(),
    prisma.favorite.count(),
    prisma.listing.count({ where: { isFeatured: true, OR: [{ featuredUntil: null }, { featuredUntil: { gt: new Date() } }] } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.user.count({ where: { role: 'BANNED' } }),
  ]);
  res.json({ users, listings, pending: 0, favorites, featured, activeSubscriptions, bannedUsers });
});

router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, phone: true, role: true, companyName: true, createdAt: true,
      _count: { select: { listings: true, favorites: true, subscriptions: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(users);
});

router.get('/listings', async (req, res) => {
  await runMarketplaceMaintenance();
  const listings = await prisma.listing.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, companyName: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { leads: true, favorites: true } }
    },
    orderBy: [{ status: 'asc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }]
  });
  res.json(listings);
});

router.patch('/listings/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['PENDING', 'APPROVED', 'REJECTED'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Status inválido.' });
  const updated = await prisma.listing.update({ where: { id: Number(req.params.id) }, data: { status } });
  res.json(updated);
});

router.patch('/listings/:id/feature', async (req, res) => {
  const { isFeatured, days } = req.body;
  const durationDays = [7, 15, 30].includes(Number(days)) ? Number(days) : 30;
  const updated = await prisma.listing.update({
    where: { id: Number(req.params.id) },
    data: { isFeatured: !!isFeatured, featuredUntil: isFeatured ? addDays(new Date(), durationDays) : null }
  });
  res.json(updated);
});

router.get('/leads', async (req, res) => {
  const leads = await prisma.lead.findMany({
    include: { listing: { select: { id: true, title: true, price: true, city: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(leads);
});


router.patch('/users/:id/ban', async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) return res.status(400).json({ message: 'Usuário inválido.' });
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ message: 'Usuário não encontrado.' });
  if (target.role === 'ADMIN') return res.status(400).json({ message: 'Não é possível banir administradores.' });
  const user = await prisma.user.update({ where: { id: userId }, data: { role: 'BANNED' } });
  return res.json({ id: user.id, role: user.role });
});

router.patch('/users/:id/unban', async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) return res.status(400).json({ message: 'Usuário inválido.' });
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return res.status(404).json({ message: 'Usuário não encontrado.' });
  const user = await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
  return res.json({ id: user.id, role: user.role });
});

module.exports = router;
