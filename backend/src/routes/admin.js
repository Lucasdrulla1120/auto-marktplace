const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, adminRequired);

router.get('/dashboard', async (req, res) => {
  const [users, listings, pending, favorites, leads, featured, activeSubscriptions] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.listing.count({ where: { status: 'PENDING' } }),
    prisma.favorite.count(),
    prisma.lead.count(),
    prisma.listing.count({ where: { isFeatured: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
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
  const listings = await prisma.listing.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, companyName: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { leads: true, favorites: true } }
    },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
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
  const { isFeatured } = req.body;
  const updated = await prisma.listing.update({
    where: { id: Number(req.params.id) },
    data: { isFeatured: !!isFeatured, featuredUntil: isFeatured ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) : null }
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
