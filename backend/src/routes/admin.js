const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired, adminRequired } = require('../middleware/auth');
const { addDays, runMarketplaceMaintenance } = require('../utils/marketplaceLifecycle');

const router = express.Router();
router.use(authRequired, adminRequired);

router.get('/dashboard', async (req, res) => {
  await runMarketplaceMaintenance();
  const [users, listings, pending, favorites, leads, featured, activeSubscriptions] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.listing.count({ where: { status: 'PENDING' } }),
    prisma.favorite.count(),
    prisma.lead.count(),
    prisma.listing.count({ where: { isFeatured: true, OR: [{ featuredUntil: null }, { featuredUntil: { gt: new Date() } }] } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
  ]);
  res.json({ users, listings, pending, favorites, leads, featured, activeSubscriptions });
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

module.exports = router;
