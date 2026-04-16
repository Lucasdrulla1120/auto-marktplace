const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired } = require('../middleware/auth');
const { getCurrentSubscription, runMarketplaceMaintenance } = require('../utils/marketplaceLifecycle');
const { sanitizeString, slugify, sanitizeOptionalUrl } = require('../utils/helpers');

const router = express.Router();
const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/$/, '');

async function getActiveSubscription(userId) {
  return getCurrentSubscription(userId);
}

function canManageStore(subscription) {
  const slug = subscription?.plan?.slug;
  return slug === 'lojista' || slug === 'premium';
}

function buildPublicStoreUrl(storeSlug) {
  return FRONTEND_URL && storeSlug ? `${FRONTEND_URL}/?loja=${encodeURIComponent(storeSlug)}` : null;
}

function buildPublicListingUrl(listingSlug) {
  return FRONTEND_URL && listingSlug ? `${FRONTEND_URL}/?anuncio=${encodeURIComponent(listingSlug)}` : null;
}

function serializeStoreListing(listing) {
  return {
    ...listing,
    publicUrl: buildPublicListingUrl(listing.slug),
    isFavorite: false,
    favoriteCount: listing._count?.favorites || 0,
    leadCount: listing._count?.leads || 0,
    metrics: {
      views: listing.viewCount || 0,
      whatsappClicks: listing.whatsappClicks || 0,
      qualityScore: listing.qualityScore || 0,
    },
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
      verified: !!listing.user?.storeIsVerified,
      storeSlug: listing.user?.storeSlug || null,
      publicUrl: buildPublicStoreUrl(listing.user?.storeSlug),
    },
  };
}

function buildStoreStats(listings = []) {
  const listingCount = listings.length;
  const featuredCount = listings.filter((item) => item.isFeatured).length;
  const totalViews = listings.reduce((acc, item) => acc + (item.viewCount || 0), 0);
  const totalWhatsappClicks = listings.reduce((acc, item) => acc + (item.whatsappClicks || 0), 0);
  const totalPrice = listings.reduce((acc, item) => acc + Number(item.price || 0), 0);
  const totalQuality = listings.reduce((acc, item) => acc + Number(item.qualityScore || 0), 0);
  return {
    listingCount,
    featuredCount,
    totalViews,
    totalWhatsappClicks,
    averagePrice: listingCount ? Math.round(totalPrice / listingCount) : 0,
    averageQualityScore: listingCount ? Math.round(totalQuality / listingCount) : 0,
  };
}

async function ensureUniqueStoreSlug(baseSlug, ignoreUserId = null) {
  const base = slugify(baseSlug);
  let attempt = base;
  let counter = 2;
  while (true) {
    const existing = await prisma.user.findFirst({ where: { storeSlug: attempt } });
    if (!existing || existing.id === ignoreUserId) return attempt;
    attempt = `${base}-${counter}`;
    counter += 1;
  }
}

async function fetchStoreData(userId) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      plan: { slug: { in: ['lojista', 'premium'] } },
    },
    include: { plan: true },
    orderBy: { startedAt: 'desc' },
  });
  if (!subscription) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      listings: {
        where: { status: 'APPROVED' },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          user: {
            select: {
              id: true,
              name: true,
              companyName: true,
              phone: true,
              storeName: true,
              storeSlug: true,
              storeCity: true,
              storeNeighborhood: true,
              storeWhatsapp: true,
              storeIsActive: true,
              storeIsVerified: true,
              createdAt: true,
              _count: { select: { listings: true } },
            },
          },
          favorites: { select: { userId: true } },
          _count: { select: { favorites: true, leads: true } },
        },
        orderBy: [{ isFeatured: 'desc' }, { qualityScore: 'desc' }, { createdAt: 'desc' }],
      },
    },
  });
  if (!user || !user.storeIsActive) return null;

  const stats = buildStoreStats(user.listings || []);

  return {
    userId: user.id,
    name: user.storeName || user.companyName || user.name,
    slug: user.storeSlug,
    logoUrl: user.storeLogoUrl,
    bannerUrl: user.storeBannerUrl,
    description: user.storeDescription || '',
    city: user.storeCity || '',
    neighborhood: user.storeNeighborhood || '',
    whatsapp: user.storeWhatsapp || user.phone || '',
    instagram: user.storeInstagram || '',
    website: user.storeWebsite || '',
    verified: !!user.storeIsVerified,
    verifiedAt: user.storeVerifiedAt || null,
    memberSince: user.createdAt,
    publicUrl: buildPublicStoreUrl(user.storeSlug),
    planSlug: subscription.plan.slug,
    planName: subscription.plan.name,
    stats,
    listings: user.listings.map(serializeStoreListing),
  };
}

router.get('/', async (req, res) => {
  await runMarketplaceMaintenance();
  const { q = '', city = '', neighborhood = '', plan = '' } = req.query;
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      plan: { slug: { in: plan ? [String(plan)] : ['lojista', 'premium'] } },
      user: { storeIsActive: true },
    },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          companyName: true,
          storeName: true,
          storeSlug: true,
          storeLogoUrl: true,
          storeBannerUrl: true,
          storeDescription: true,
          storeCity: true,
          storeNeighborhood: true,
          storeWhatsapp: true,
          storeInstagram: true,
          storeWebsite: true,
          storeIsActive: true,
          storeIsVerified: true,
          storeVerifiedAt: true,
          createdAt: true,
          listings: {
            where: { status: 'APPROVED' },
            select: { price: true, qualityScore: true, viewCount: true, whatsappClicks: true, isFeatured: true },
          },
        },
      },
    },
    orderBy: [{ planId: 'desc' }, { startedAt: 'desc' }],
  });

  const items = subscriptions
    .map((item) => {
      const stats = buildStoreStats(item.user.listings || []);
      return {
        userId: item.user.id,
        name: item.user.storeName || item.user.companyName || item.user.name,
        slug: item.user.storeSlug,
        logoUrl: item.user.storeLogoUrl,
        bannerUrl: item.user.storeBannerUrl,
        description: item.user.storeDescription || '',
        city: item.user.storeCity || '',
        neighborhood: item.user.storeNeighborhood || '',
        whatsapp: item.user.storeWhatsapp || item.user.phone || '',
        instagram: item.user.storeInstagram || '',
        website: item.user.storeWebsite || '',
        listingCount: stats.listingCount,
        memberSince: item.user.createdAt,
        planSlug: item.plan.slug,
        planName: item.plan.name,
        isPremium: item.plan.slug === 'premium',
        verified: !!item.user.storeIsVerified,
        verifiedAt: item.user.storeVerifiedAt || null,
        stats,
        publicUrl: buildPublicStoreUrl(item.user.storeSlug),
      };
    })
    .filter((item) => item.listingCount > 0)
    .filter((item) => !q || [item.name, item.description, item.city, item.neighborhood].join(' ').toLowerCase().includes(String(q).toLowerCase()))
    .filter((item) => !city || item.city.toLowerCase().includes(String(city).toLowerCase()))
    .filter((item) => !neighborhood || item.neighborhood.toLowerCase().includes(String(neighborhood).toLowerCase()))
    .sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1;
      return b.listingCount - a.listingCount;
    });

  res.json(items);
});

router.get('/me', authRequired, async (req, res) => {
  const subscription = await getActiveSubscription(req.user.id);
  const statsSource = await prisma.listing.findMany({
    where: { userId: req.user.id, status: 'APPROVED' },
    select: { price: true, qualityScore: true, viewCount: true, whatsappClicks: true, isFeatured: true },
  });
  res.json({
    canManageStore: canManageStore(subscription),
    planSlug: subscription?.plan?.slug || 'particular',
    planName: subscription?.plan?.name || 'Particular',
    publicUrl: buildPublicStoreUrl(req.user.storeSlug),
    profile: {
      storeName: req.user.storeName || req.user.companyName || '',
      storeSlug: req.user.storeSlug || '',
      storeLogoUrl: req.user.storeLogoUrl || '',
      storeBannerUrl: req.user.storeBannerUrl || '',
      storeDescription: req.user.storeDescription || '',
      storeCity: req.user.storeCity || '',
      storeNeighborhood: req.user.storeNeighborhood || '',
      storeWhatsapp: req.user.storeWhatsapp || req.user.phone || '',
      storeInstagram: req.user.storeInstagram || '',
      storeWebsite: req.user.storeWebsite || '',
      storeIsActive: !!req.user.storeIsActive,
      storeIsVerified: !!req.user.storeIsVerified,
      storeVerifiedAt: req.user.storeVerifiedAt || null,
    },
    stats: buildStoreStats(statsSource),
  });
});

router.put('/me', authRequired, async (req, res) => {
  const subscription = await getActiveSubscription(req.user.id);
  if (!canManageStore(subscription)) {
    return res.status(403).json({ message: 'Somente lojistas e premium podem personalizar a loja.' });
  }

  const storeName = sanitizeString(req.body.storeName, 120);
  const storeCity = sanitizeString(req.body.storeCity, 80);
  if (!storeName) return res.status(400).json({ message: 'Informe o nome da loja.' });
  if (!storeCity) return res.status(400).json({ message: 'Informe a cidade da loja.' });

  const requestedSlug = sanitizeString(req.body.storeSlug, 90);
  const storeSlug = await ensureUniqueStoreSlug(requestedSlug || storeName, req.user.id);

  const data = {
    storeName,
    storeSlug,
    storeLogoUrl: String(req.body.storeLogoUrl || '').trim() || null,
    storeBannerUrl: String(req.body.storeBannerUrl || '').trim() || null,
    storeDescription: sanitizeString(req.body.storeDescription, 1200) || null,
    storeCity,
    storeNeighborhood: sanitizeString(req.body.storeNeighborhood, 80) || null,
    storeWhatsapp: sanitizeString(req.body.storeWhatsapp, 30) || null,
    storeInstagram: sanitizeString(req.body.storeInstagram, 80) || null,
    storeWebsite: sanitizeOptionalUrl(req.body.storeWebsite) || null,
    storeIsActive: req.body.storeIsActive !== false && req.body.storeIsActive !== 'false',
  };

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: {
      id: true,
      storeName: true,
      storeSlug: true,
      storeLogoUrl: true,
      storeBannerUrl: true,
      storeDescription: true,
      storeCity: true,
      storeNeighborhood: true,
      storeWhatsapp: true,
      storeInstagram: true,
      storeWebsite: true,
      storeIsActive: true,
      storeIsVerified: true,
      storeVerifiedAt: true,
    },
  });

  res.json({ ...updated, publicUrl: buildPublicStoreUrl(updated.storeSlug) });
});

router.get('/slug/:slug', async (req, res) => {
  await runMarketplaceMaintenance();
  const user = await prisma.user.findFirst({ where: { storeSlug: String(req.params.slug) }, select: { id: true } });
  if (!user) return res.status(404).json({ message: 'Loja não encontrada.' });
  const store = await fetchStoreData(user.id);
  if (!store) return res.status(404).json({ message: 'Loja não encontrada.' });
  res.json(store);
});

router.get('/:userId', async (req, res) => {
  await runMarketplaceMaintenance();
  const store = await fetchStoreData(Number(req.params.userId));
  if (!store) return res.status(404).json({ message: 'Loja não encontrada.' });
  res.json(store);
});

module.exports = router;
