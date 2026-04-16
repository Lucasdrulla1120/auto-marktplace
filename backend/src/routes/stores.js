const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired } = require('../middleware/auth');
const { getCurrentSubscription, runMarketplaceMaintenance } = require('../utils/marketplaceLifecycle');

const router = express.Router();

async function getActiveSubscription(userId) {
  return getCurrentSubscription(userId);
}

function canManageStore(subscription) {
  const slug = subscription?.plan?.slug;
  return slug === 'lojista' || slug === 'premium';
}

router.get('/', async (req, res) => {
  await runMarketplaceMaintenance();
  const { q = '', city = '', neighborhood = '', plan = '' } = req.query;
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      plan: { slug: { in: plan ? [String(plan)] : ['lojista', 'premium'] } },
      user: { storeIsActive: true }
    },
    include: {
      plan: true,
      user: {
        select: {
          id: true, name: true, phone: true, companyName: true,
          storeName: true, storeLogoUrl: true, storeBannerUrl: true, storeDescription: true,
          storeCity: true, storeNeighborhood: true, storeWhatsapp: true, storeInstagram: true,
          storeWebsite: true, storeIsActive: true, createdAt: true,
          _count: { select: { listings: { where: { status: 'APPROVED' } } } }
        }
      }
    },
    orderBy: [{ planId: 'desc' }, { startedAt: 'desc' }]
  });

  const items = subscriptions
    .map((item) => ({
      userId: item.user.id,
      name: item.user.storeName || item.user.companyName || item.user.name,
      logoUrl: item.user.storeLogoUrl,
      bannerUrl: item.user.storeBannerUrl,
      description: item.user.storeDescription || '',
      city: item.user.storeCity || '',
      neighborhood: item.user.storeNeighborhood || '',
      whatsapp: item.user.storeWhatsapp || item.user.phone || '',
      instagram: item.user.storeInstagram || '',
      website: item.user.storeWebsite || '',
      listingCount: item.user._count.listings || 0,
      memberSince: item.user.createdAt,
      planSlug: item.plan.slug,
      planName: item.plan.name,
      isPremium: item.plan.slug === 'premium',
    }))
    .filter((item) => item.listingCount > 0)
    .filter((item) => !q || [item.name, item.description, item.city, item.neighborhood].join(' ').toLowerCase().includes(String(q).toLowerCase()))
    .filter((item) => !city || item.city.toLowerCase().includes(String(city).toLowerCase()))
    .filter((item) => !neighborhood || item.neighborhood.toLowerCase().includes(String(neighborhood).toLowerCase()))
    .sort((a, b) => {
      if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1;
      return b.listingCount - a.listingCount;
    });

  res.json(items);
});

router.get('/me', authRequired, async (req, res) => {
  const subscription = await getActiveSubscription(req.user.id);
  res.json({
    canManageStore: canManageStore(subscription),
    planSlug: subscription?.plan?.slug || 'particular',
    planName: subscription?.plan?.name || 'Particular',
    profile: {
      storeName: req.user.storeName || req.user.companyName || '',
      storeLogoUrl: req.user.storeLogoUrl || '',
      storeBannerUrl: req.user.storeBannerUrl || '',
      storeDescription: req.user.storeDescription || '',
      storeCity: req.user.storeCity || '',
      storeNeighborhood: req.user.storeNeighborhood || '',
      storeWhatsapp: req.user.storeWhatsapp || req.user.phone || '',
      storeInstagram: req.user.storeInstagram || '',
      storeWebsite: req.user.storeWebsite || '',
      storeIsActive: !!req.user.storeIsActive,
    }
  });
});

router.put('/me', authRequired, async (req, res) => {
  const subscription = await getActiveSubscription(req.user.id);
  if (!canManageStore(subscription)) {
    return res.status(403).json({ message: 'Somente lojistas e premium podem personalizar a loja.' });
  }

  const data = {
    storeName: String(req.body.storeName || '').trim(),
    storeLogoUrl: String(req.body.storeLogoUrl || '').trim() || null,
    storeBannerUrl: String(req.body.storeBannerUrl || '').trim() || null,
    storeDescription: String(req.body.storeDescription || '').trim() || null,
    storeCity: String(req.body.storeCity || '').trim() || null,
    storeNeighborhood: String(req.body.storeNeighborhood || '').trim() || null,
    storeWhatsapp: String(req.body.storeWhatsapp || '').trim() || null,
    storeInstagram: String(req.body.storeInstagram || '').trim() || null,
    storeWebsite: String(req.body.storeWebsite || '').trim() || null,
    storeIsActive: req.body.storeIsActive !== false && req.body.storeIsActive !== 'false',
  };

  if (!data.storeName) return res.status(400).json({ message: 'Informe o nome da loja.' });
  if (!data.storeCity) return res.status(400).json({ message: 'Informe a cidade da loja.' });

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: {
      id: true, storeName: true, storeLogoUrl: true, storeBannerUrl: true, storeDescription: true,
      storeCity: true, storeNeighborhood: true, storeWhatsapp: true, storeInstagram: true,
      storeWebsite: true, storeIsActive: true
    }
  });

  res.json(updated);
});

router.get('/:userId', async (req, res) => {
  await runMarketplaceMaintenance();
  const userId = Number(req.params.userId);
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], plan: { slug: { in: ['lojista', 'premium'] } } },
    include: { plan: true },
    orderBy: { startedAt: 'desc' }
  });
  if (!subscription) return res.status(404).json({ message: 'Loja não encontrada.' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      listings: {
        where: { status: 'APPROVED' },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          user: { select: { id: true, name: true, companyName: true, phone: true, storeName: true, storeCity: true, storeNeighborhood: true, storeWhatsapp: true, storeIsActive: true, createdAt: true, _count: { select: { listings: true } } } },
          favorites: { select: { userId: true } },
          _count: { select: { favorites: true, leads: true } },
        },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
      }
    }
  });
  if (!user || !user.storeIsActive) return res.status(404).json({ message: 'Loja não encontrada.' });

  res.json({
    userId: user.id,
    name: user.storeName || user.companyName || user.name,
    logoUrl: user.storeLogoUrl,
    bannerUrl: user.storeBannerUrl,
    description: user.storeDescription || '',
    city: user.storeCity || '',
    neighborhood: user.storeNeighborhood || '',
    whatsapp: user.storeWhatsapp || user.phone || '',
    instagram: user.storeInstagram || '',
    website: user.storeWebsite || '',
    planSlug: subscription.plan.slug,
    planName: subscription.plan.name,
    listings: user.listings.map((listing) => ({
      ...listing,
      isFavorite: false,
      favoriteCount: listing._count?.favorites || 0,
      leadCount: listing._count?.leads || 0,
      seller: {
        id: listing.user?.id || null,
        name: listing.user?.storeName || listing.user?.companyName || listing.user?.name || 'Loja',
        type: 'LOJA',
        memberSince: listing.user?.createdAt || null,
        listingCount: listing.user?._count?.listings || 0,
        city: listing.user?.storeCity || listing.city,
        neighborhood: listing.user?.storeNeighborhood || listing.neighborhood,
        whatsapp: listing.user?.storeWhatsapp || listing.phone,
        storeIsActive: !!listing.user?.storeIsActive,
      },
    })),
  });
});

module.exports = router;
