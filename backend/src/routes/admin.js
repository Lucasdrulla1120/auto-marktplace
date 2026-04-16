const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired, adminRequired } = require('../middleware/auth');
const { addDays, runMarketplaceMaintenance } = require('../utils/marketplaceLifecycle');

const router = express.Router();
router.use(authRequired, adminRequired);

router.get('/dashboard', async (req, res) => {
  await runMarketplaceMaintenance();
  const [
    users,
    listings,
    pending,
    favorites,
    leads,
    featured,
    activeSubscriptions,
    verifiedStores,
    totalViews,
    totalWhatsappClicks,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.listing.count({ where: { status: 'PENDING' } }),
    prisma.favorite.count(),
    prisma.lead.count(),
    prisma.listing.count({ where: { isFeatured: true, OR: [{ featuredUntil: null }, { featuredUntil: { gt: new Date() } }] } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.user.count({ where: { storeIsActive: true, storeIsVerified: true } }),
    prisma.listing.aggregate({ _sum: { viewCount: true } }),
    prisma.listing.aggregate({ _sum: { whatsappClicks: true } }),
  ]);

  res.json({
    users,
    listings,
    pending,
    favorites,
    leads,
    featured,
    activeSubscriptions,
    verifiedStores,
    totalViews: totalViews._sum.viewCount || 0,
    totalWhatsappClicks: totalWhatsappClicks._sum.whatsappClicks || 0,
  });
});

router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      companyName: true,
      storeName: true,
      storeSlug: true,
      storeCity: true,
      storeNeighborhood: true,
      storeIsActive: true,
      storeIsVerified: true,
      storeVerifiedAt: true,
      createdAt: true,
      _count: { select: { listings: true, favorites: true, subscriptions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

router.patch('/users/:id/store-verification', async (req, res) => {
  const userId = Number(req.params.id);
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) return res.status(404).json({ message: 'Usuário não encontrado.' });

  const nextVerified = req.body.verified !== undefined ? !!req.body.verified : !current.storeIsVerified;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      storeIsVerified: nextVerified,
      storeVerifiedAt: nextVerified ? new Date() : null,
    },
    select: {
      id: true,
      name: true,
      storeName: true,
      storeSlug: true,
      storeIsActive: true,
      storeIsVerified: true,
      storeVerifiedAt: true,
    },
  });

  res.json(updated);
});

router.get('/listings', async (req, res) => {
  await runMarketplaceMaintenance();
  const listings = await prisma.listing.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          companyName: true,
          storeName: true,
          storeSlug: true,
          storeIsActive: true,
          storeIsVerified: true,
        },
      },
      images: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { leads: true, favorites: true } },
    },
    orderBy: [{ status: 'asc' }, { isFeatured: 'desc' }, { qualityScore: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(listings);
});

router.patch('/listings/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['PENDING', 'APPROVED', 'REJECTED'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Status inválido.' });

  const current = await prisma.listing.findUnique({ where: { id: Number(req.params.id) } });
  if (!current) return res.status(404).json({ message: 'Anúncio não encontrado.' });

  const updated = await prisma.listing.update({
    where: { id: current.id },
    data: {
      status,
      publishedAt: status === 'APPROVED' ? current.publishedAt || new Date() : current.publishedAt,
      isFeatured: status === 'REJECTED' ? false : current.isFeatured,
      featuredUntil: status === 'REJECTED' ? null : current.featuredUntil,
    },
  });
  res.json(updated);
});

router.patch('/listings/:id/feature', async (req, res) => {
  const { isFeatured, days } = req.body;
  const durationDays = [7, 15, 30].includes(Number(days)) ? Number(days) : 30;
  const updated = await prisma.listing.update({
    where: { id: Number(req.params.id) },
    data: { isFeatured: !!isFeatured, featuredUntil: isFeatured ? addDays(new Date(), durationDays) : null },
  });
  res.json(updated);
});

router.get('/leads', async (req, res) => {
  const leads = await prisma.lead.findMany({
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          price: true,
          city: true,
          user: { select: { id: true, name: true, storeName: true, companyName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(leads);
});

module.exports = router;
