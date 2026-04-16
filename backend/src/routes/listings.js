const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired, optionalAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const {
  toNumber,
  choosePrimary,
  sanitizeString,
  normalizePhone,
  validateImagesPayload,
  normalizePage,
  normalizePerPage,
  slugify,
  calculateListingQualityScore,
} = require('../utils/helpers');
const { runMarketplaceMaintenance, getListingLimitForUser } = require('../utils/marketplaceLifecycle');

const router = express.Router();
const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/$/, '');

function buildPublicListingUrl(slug) {
  return FRONTEND_URL && slug ? `${FRONTEND_URL}/?anuncio=${encodeURIComponent(slug)}` : null;
}

function buildPublicStoreUrl(storeSlug) {
  return FRONTEND_URL && storeSlug ? `${FRONTEND_URL}/?loja=${encodeURIComponent(storeSlug)}` : null;
}

function includeConfig(userId = null) {
  const include = {
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
        storeIsActive: true,
        storeIsVerified: true,
        storeVerifiedAt: true,
        createdAt: true,
        _count: { select: { listings: true } },
      },
    },
    images: { orderBy: { sortOrder: 'asc' } },
    _count: { select: { favorites: true, leads: true } },
  };

  if (userId) include.favorites = { where: { userId }, select: { id: true } };
  return include;
}

function serializeListing(listing, options = {}) {
  const sellerName = listing.user?.storeName || listing.user?.companyName || listing.user?.name || 'Vendedor';
  const sellerType = listing.user?.storeIsActive ? 'LOJA' : listing.user?.companyName ? 'REVENDA' : 'PARTICULAR';
  const marketInsight = options.marketInsight || null;

  return {
    ...listing,
    publicUrl: buildPublicListingUrl(listing.slug),
    marketInsight,
    isFavorite: !!listing.favorites?.length,
    favorites: undefined,
    favoriteCount: listing._count?.favorites || 0,
    leadCount: listing._count?.leads || 0,
    metrics: {
      views: listing.viewCount || 0,
      whatsappClicks: listing.whatsappClicks || 0,
      qualityScore: listing.qualityScore || 0,
    },
    seller: {
      id: listing.user?.id || null,
      name: sellerName,
      type: sellerType,
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

function containsFilter(value) {
  return value ? { contains: String(value), mode: 'insensitive' } : undefined;
}

function buildOrderBy(sortBy) {
  const featured = { isFeatured: 'desc' };
  const quality = { qualityScore: 'desc' };
  const createdAt = { createdAt: 'desc' };
  switch (sortBy) {
    case 'price_asc': return [featured, { price: 'asc' }, quality, createdAt];
    case 'price_desc': return [featured, { price: 'desc' }, quality, createdAt];
    case 'year_desc': return [featured, { year: 'desc' }, quality, createdAt];
    case 'km_asc': return [featured, { km: 'asc' }, quality, createdAt];
    case 'quality_desc': return [featured, quality, createdAt];
    case 'views_desc': return [featured, { viewCount: 'desc' }, quality, createdAt];
    default: return [featured, quality, createdAt];
  }
}

function buildListingData(payload = {}) {
  return {
    title: sanitizeString(payload.title, 140),
    description: sanitizeString(payload.description, 5000),
    price: toNumber(payload.price),
    brand: sanitizeString(payload.brand, 60),
    model: sanitizeString(payload.model, 80),
    year: toNumber(payload.year),
    km: toNumber(payload.km),
    transmission: sanitizeString(payload.transmission, 40),
    fuel: sanitizeString(payload.fuel, 40),
    color: sanitizeString(payload.color, 40),
    city: sanitizeString(payload.city, 80),
    neighborhood: sanitizeString(payload.neighborhood, 80),
    phone: sanitizeString(payload.phone, 30),
  };
}

function validateListingData(data) {
  if (!data.title || !data.description || !data.price || !data.brand || !data.model || !data.year || !data.phone) {
    return 'Preencha os campos obrigatórios do anúncio.';
  }
  if (!data.city || !data.neighborhood) return 'Informe a localização do veículo.';
  if (data.year < 1900 || data.year > new Date().getFullYear() + 1) return 'Ano do veículo inválido.';
  if (data.km < 0) return 'KM inválida.';
  if (data.price <= 0) return 'Preço inválido.';
  return null;
}

async function ensureUniqueListingSlug(baseSlug, ignoreId = null) {
  const base = slugify(baseSlug);
  let attempt = base;
  let counter = 2;
  while (true) {
    const existing = await prisma.listing.findUnique({ where: { slug: attempt } }).catch(() => null);
    if (!existing || existing.id === ignoreId) return attempt;
    attempt = `${base}-${counter}`;
    counter += 1;
  }
}

async function findDuplicateListing(userId, data, ignoreId = null) {
  return prisma.listing.findFirst({
    where: {
      userId,
      id: ignoreId ? { not: ignoreId } : undefined,
      status: { not: 'REJECTED' },
      brand: { equals: data.brand, mode: 'insensitive' },
      model: { equals: data.model, mode: 'insensitive' },
      year: data.year,
      title: { equals: data.title, mode: 'insensitive' },
    },
    select: { id: true, title: true, slug: true },
  });
}

async function buildMarketInsight(listing) {
  if (!listing?.brand || !listing?.model || !listing?.year) return null;

  const cityComparables = await prisma.listing.findMany({
    where: {
      id: { not: listing.id },
      status: 'APPROVED',
      brand: listing.brand,
      model: listing.model,
      year: listing.year,
      city: listing.city,
    },
    select: { price: true },
    take: 40,
  });

  let comparables = cityComparables;
  let basis = cityComparables.length >= 2 ? 'cidade' : 'regiao';

  if (comparables.length < 2) {
    comparables = await prisma.listing.findMany({
      where: {
        id: { not: listing.id },
        status: 'APPROVED',
        brand: listing.brand,
        model: listing.model,
        year: listing.year,
      },
      select: { price: true },
      take: 60,
    });
  }

  if (comparables.length < 2) return null;

  const prices = comparables.map((item) => Number(item.price || 0)).filter((price) => price > 0);
  if (!prices.length) return null;

  const averagePrice = prices.reduce((acc, price) => acc + price, 0) / prices.length;
  const diffRatio = averagePrice ? (Number(listing.price) - averagePrice) / averagePrice : 0;
  let status = 'DENTRO_DA_MEDIA';
  let label = 'Dentro da média';

  if (diffRatio <= -0.08) {
    status = 'ABAIXO_DA_MEDIA';
    label = 'Abaixo da média';
  } else if (diffRatio >= 0.08) {
    status = 'ACIMA_DA_MEDIA';
    label = 'Acima da média';
  }

  return {
    status,
    label,
    averagePrice: Math.round(averagePrice),
    sampleSize: prices.length,
    basis,
  };
}

async function fetchListingBy(where, userId = null) {
  return prisma.listing.findFirst({ where, include: includeConfig(userId) });
}

async function maybeIncrementViewCount(listing, reqUser) {
  const isOwner = reqUser && listing.userId === reqUser.id;
  const isAdmin = reqUser?.role === 'ADMIN';
  if (isOwner || isAdmin || listing.status !== 'APPROVED') return listing;

  await prisma.listing.update({ where: { id: listing.id }, data: { viewCount: { increment: 1 } } }).catch(() => null);
  return { ...listing, viewCount: (listing.viewCount || 0) + 1 };
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    await runMarketplaceMaintenance();
    const {
      q,
      brand,
      model,
      city,
      neighborhood,
      fuel,
      transmission,
      color,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      minKm,
      maxKm,
      status,
      sortBy = 'recent',
      onlyWithPhoto,
      favoriteOnly,
      verifiedStoreOnly,
      featuredOnly,
      page,
      perPage,
    } = req.query;

    const andFilters = [];
    if (q) {
      andFilters.push({
        OR: [
          { title: containsFilter(q) },
          { description: containsFilter(q) },
          { brand: containsFilter(q) },
          { model: containsFilter(q) },
          { city: containsFilter(q) },
          { neighborhood: containsFilter(q) },
        ],
      });
    }
    if (brand) andFilters.push({ brand: containsFilter(brand) });
    if (model) andFilters.push({ model: containsFilter(model) });
    if (city) andFilters.push({ city: containsFilter(city) });
    if (neighborhood) andFilters.push({ neighborhood: containsFilter(neighborhood) });
    if (fuel) andFilters.push({ fuel: containsFilter(fuel) });
    if (transmission) andFilters.push({ transmission: containsFilter(transmission) });
    if (color) andFilters.push({ color: containsFilter(color) });
    if (minPrice || maxPrice) andFilters.push({ price: { ...(minPrice ? { gte: toNumber(minPrice) } : {}), ...(maxPrice ? { lte: toNumber(maxPrice) } : {}) } });
    if (minYear || maxYear) andFilters.push({ year: { ...(minYear ? { gte: toNumber(minYear) } : {}), ...(maxYear ? { lte: toNumber(maxYear) } : {}) } });
    if (minKm || maxKm) andFilters.push({ km: { ...(minKm ? { gte: toNumber(minKm) } : {}), ...(maxKm ? { lte: toNumber(maxKm) } : {}) } });
    if (String(onlyWithPhoto) === 'true') andFilters.push({ images: { some: {} } });
    if (String(featuredOnly) === 'true') andFilters.push({ isFeatured: true, OR: [{ featuredUntil: null }, { featuredUntil: { gt: new Date() } }] });
    if (String(verifiedStoreOnly) === 'true') andFilters.push({ user: { storeIsVerified: true } });
    if (String(favoriteOnly) === 'true') {
      if (!req.user) return res.status(401).json({ message: 'Faça login para ver seus favoritos.' });
      andFilters.push({ favorites: { some: { userId: req.user.id } } });
    }

    if (req.user?.role === 'ADMIN' && status) andFilters.push({ status: String(status) });
    else andFilters.push({ status: 'APPROVED' });

    const where = { AND: andFilters };
    const safePage = normalizePage(page, 1);
    const safePerPage = normalizePerPage(perPage, 12, 48);

    const [total, listings] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        include: includeConfig(req.user?.id || null),
        orderBy: buildOrderBy(sortBy),
        skip: (safePage - 1) * safePerPage,
        take: safePerPage,
      }),
    ]);

    const items = listings.map((listing) => serializeListing(listing));
    return res.json({
      items,
      meta: {
        page: safePage,
        perPage: safePerPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePerPage)),
        hasNextPage: safePage * safePerPage < total,
        hasPrevPage: safePage > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao listar anúncios.' });
  }
});

router.get('/mine/analytics', authRequired, async (req, res) => {
  try {
    await runMarketplaceMaintenance();
    const listings = await prisma.listing.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isFeatured: 'desc' }, { qualityScore: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        status: true,
        isFeatured: true,
        qualityScore: true,
        viewCount: true,
        whatsappClicks: true,
        createdAt: true,
        _count: { select: { favorites: true, leads: true } },
        leads: { select: { status: true, createdAt: true, firstResponseAt: true } },
      },
    });

    const totals = {
      listings: listings.length,
      approvedListings: listings.filter((item) => item.status === 'APPROVED').length,
      pendingListings: listings.filter((item) => item.status === 'PENDING').length,
      rejectedListings: listings.filter((item) => item.status === 'REJECTED').length,
      featuredListings: listings.filter((item) => item.isFeatured).length,
      views: listings.reduce((acc, item) => acc + (item.viewCount || 0), 0),
      whatsappClicks: listings.reduce((acc, item) => acc + (item.whatsappClicks || 0), 0),
      favorites: listings.reduce((acc, item) => acc + (item._count?.favorites || 0), 0),
      leads: listings.reduce((acc, item) => acc + (item._count?.leads || 0), 0),
    };

    const leadStatusMap = new Map();
    const responseTimes = [];
    for (const listing of listings) {
      for (const lead of listing.leads) {
        leadStatusMap.set(lead.status, (leadStatusMap.get(lead.status) || 0) + 1);
        if (lead.firstResponseAt) {
          const diff = new Date(lead.firstResponseAt).getTime() - new Date(lead.createdAt).getTime();
          if (diff >= 0) responseTimes.push(diff / 60000);
        }
      }
    }

    const respondedLeads = Array.from(leadStatusMap.entries())
      .filter(([status]) => status !== 'NEW')
      .reduce((acc, [, count]) => acc + count, 0);

    const responseRate = totals.leads ? Math.round((respondedLeads / totals.leads) * 100) : 0;
    const averageResponseMinutes = responseTimes.length
      ? Math.round(responseTimes.reduce((acc, value) => acc + value, 0) / responseTimes.length)
      : null;

    const topListings = listings.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      price: item.price,
      status: item.status,
      isFeatured: item.isFeatured,
      qualityScore: item.qualityScore,
      viewCount: item.viewCount,
      whatsappClicks: item.whatsappClicks,
      favoriteCount: item._count?.favorites || 0,
      leadCount: item._count?.leads || 0,
      publicUrl: buildPublicListingUrl(item.slug),
    }));

    res.json({
      totals: { ...totals, respondedLeads, responseRate, averageResponseMinutes },
      leadPipeline: Array.from(leadStatusMap.entries()).map(([status, count]) => ({ status, count })),
      topListings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar analytics do anunciante.' });
  }
});

router.get('/mine', authRequired, async (req, res) => {
  try {
    await runMarketplaceMaintenance();
    const listings = await prisma.listing.findMany({
      where: { userId: req.user.id },
      include: includeConfig(req.user.id),
      orderBy: [{ isFeatured: 'desc' }, { qualityScore: 'desc' }, { createdAt: 'desc' }],
    });
    return res.json(listings.map((listing) => serializeListing(listing)));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao listar seus anúncios.' });
  }
});

router.get('/mine/leads', authRequired, async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { listing: { userId: req.user.id } },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            brand: true,
            model: true,
            city: true,
            phone: true,
            slug: true,
            images: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(leads);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao listar leads do anunciante.' });
  }
});

router.patch('/leads/:id/status', authRequired, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['NEW', 'CONTACTED', 'NEGOTIATING', 'CLOSED', 'LOST'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Status de lead inválido.' });
    const lead = await prisma.lead.findUnique({ where: { id: Number(req.params.id) }, include: { listing: true } });
    if (!lead) return res.status(404).json({ message: 'Lead não encontrado.' });
    if (lead.listing.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Sem permissão para alterar este lead.' });
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status,
        firstResponseAt: status !== 'NEW' && !lead.firstResponseAt ? new Date() : lead.firstResponseAt,
      },
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar lead.' });
  }
});

router.get('/slug/:slug', optionalAuth, async (req, res) => {
  try {
    await runMarketplaceMaintenance();
    let listing = await fetchListingBy({ slug: String(req.params.slug) }, req.user?.id || null);
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });

    const isOwner = req.user && listing.userId === req.user.id;
    const isAdmin = req.user?.role === 'ADMIN';
    if (listing.status !== 'APPROVED' && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Anúncio indisponível.' });
    }

    listing = await maybeIncrementViewCount(listing, req.user);
    const marketInsight = await buildMarketInsight(listing);
    return res.json(serializeListing(listing, { marketInsight }));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao buscar anúncio.' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    await runMarketplaceMaintenance();
    let listing = await prisma.listing.findUnique({ where: { id: Number(req.params.id) }, include: includeConfig(req.user?.id || null) });
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });

    const isOwner = req.user && listing.userId === req.user.id;
    const isAdmin = req.user?.role === 'ADMIN';
    if (listing.status !== 'APPROVED' && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Anúncio indisponível.' });
    }

    listing = await maybeIncrementViewCount(listing, req.user);
    const marketInsight = await buildMarketInsight(listing);
    return res.json(serializeListing(listing, { marketInsight }));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao buscar anúncio.' });
  }
});

router.post('/', authRequired, async (req, res) => {
  try {
    await runMarketplaceMaintenance();

    const imagesValidation = validateImagesPayload(req.body.images || []);
    if (imagesValidation) return res.status(400).json({ message: imagesValidation });

    const data = buildListingData(req.body);
    const validationError = validateListingData(data);
    if (validationError) return res.status(400).json({ message: validationError });

    const duplicate = await findDuplicateListing(req.user.id, data);
    if (duplicate) return res.status(400).json({ message: 'Você já possui um anúncio muito parecido ativo. Edite o anúncio existente para evitar duplicidade.' });

    const { listingLimit } = await getListingLimitForUser(req.user.id);
    const activeListings = await prisma.listing.count({ where: { userId: req.user.id, status: { not: 'REJECTED' } } });
    if (activeListings >= listingLimit) return res.status(400).json({ message: `Seu plano atual permite até ${listingLimit} anúncio(s) ativo(s).` });

    const normalizedImages = choosePrimary((req.body.images || []).map((img) => ({ imageUrl: String(img.imageUrl || '').trim(), isPrimary: !!img.isPrimary })));
    const slug = await ensureUniqueListingSlug(`${data.title}-${data.brand}-${data.model}-${data.year}-${data.city}`);
    const qualityScore = calculateListingQualityScore(data, normalizedImages.length, req.user);

    const listing = await prisma.listing.create({
      data: {
        userId: req.user.id,
        slug,
        ...data,
        phone: normalizePhone(data.phone) || data.phone,
        status: req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        publishedAt: req.user.role === 'ADMIN' ? new Date() : null,
        qualityScore,
        images: { create: normalizedImages },
      },
      include: includeConfig(req.user.id),
    });
    return res.status(201).json(serializeListing(listing));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao criar anúncio.' });
  }
});

router.put('/:id', authRequired, async (req, res) => {
  try {
    await runMarketplaceMaintenance();
    const listingId = Number(req.params.id);
    const existing = await prisma.listing.findUnique({ where: { id: listingId }, include: { images: true } });
    if (!existing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Sem permissão para editar este anúncio.' });

    const imagesValidation = validateImagesPayload(req.body.images || []);
    if (imagesValidation) return res.status(400).json({ message: imagesValidation });

    const data = buildListingData(req.body);
    const validationError = validateListingData(data);
    if (validationError) return res.status(400).json({ message: validationError });

    const duplicate = await findDuplicateListing(req.user.id, data, listingId);
    if (duplicate) return res.status(400).json({ message: 'Já existe um anúncio muito parecido no seu estoque. Edite o anúncio existente para evitar duplicidade.' });

    const normalizedImages = choosePrimary((req.body.images || []).map((img) => ({ imageUrl: String(img.imageUrl || '').trim(), isPrimary: !!img.isPrimary })));
    const nextStatus = req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING';
    const slug = await ensureUniqueListingSlug(`${data.title}-${data.brand}-${data.model}-${data.year}-${data.city}`, listingId);
    const qualityScore = calculateListingQualityScore(data, normalizedImages.length, req.user);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.listingImage.deleteMany({ where: { listingId } });
      await tx.listing.update({
        where: { id: listingId },
        data: {
          slug,
          ...data,
          phone: normalizePhone(data.phone) || data.phone,
          status: nextStatus,
          qualityScore,
          publishedAt: nextStatus === 'APPROVED' ? existing.publishedAt || new Date() : existing.publishedAt,
        },
      });
      await tx.listingImage.createMany({ data: normalizedImages.map((img, index) => ({ ...img, listingId, sortOrder: index })) });
      return tx.listing.findUnique({ where: { id: listingId }, include: includeConfig(req.user.id) });
    });

    return res.json(serializeListing(updated));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar anúncio.' });
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const existing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!existing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Sem permissão para excluir este anúncio.' });
    await prisma.listing.delete({ where: { id: listingId } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir anúncio.' });
  }
});

router.post('/:id/favorite', authRequired, async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: Number(req.params.id) } });
    if (!listing || listing.status !== 'APPROVED') return res.status(404).json({ message: 'Anúncio não encontrado.' });
    await prisma.favorite.create({ data: { userId: req.user.id, listingId: Number(req.params.id) } });
    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(400).json({ message: 'Não foi possível favoritar este anúncio.' });
  }
});

router.delete('/:id/favorite', authRequired, async (req, res) => {
  try {
    await prisma.favorite.delete({ where: { userId_listingId: { userId: req.user.id, listingId: Number(req.params.id) } } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ message: 'Não foi possível remover dos favoritos.' });
  }
});

router.post('/:id/track/whatsapp', rateLimit({ windowMs: 30 * 60 * 1000, max: 40, message: 'Muitos cliques registrados em pouco tempo.' }), async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: Number(req.params.id) } });
    if (!listing || listing.status !== 'APPROVED') return res.status(404).json({ message: 'Anúncio não encontrado.' });
    await prisma.listing.update({ where: { id: listing.id }, data: { whatsappClicks: { increment: 1 } } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao registrar clique de WhatsApp.' });
  }
});

router.post('/:id/lead', rateLimit({ windowMs: 6 * 60 * 60 * 1000, max: 8, message: 'Muitos contatos enviados. Tente novamente mais tarde.' }), async (req, res) => {
  try {
    const name = sanitizeString(req.body.name, 120);
    const phone = sanitizeString(req.body.phone, 30);
    const message = sanitizeString(req.body.message, 1000);
    const source = sanitizeString(req.body.source || 'FORM', 30) || 'FORM';
    if (!name || !phone || !message) return res.status(400).json({ message: 'Preencha nome, telefone e mensagem.' });

    const listing = await prisma.listing.findUnique({ where: { id: Number(req.params.id) } });
    if (!listing || listing.status !== 'APPROVED') return res.status(404).json({ message: 'Anúncio não encontrado.' });

    const normalizedPhone = normalizePhone(phone);
    const duplicateLead = await prisma.lead.findFirst({
      where: {
        listingId: listing.id,
        phone: normalizedPhone || phone,
        createdAt: { gt: new Date(Date.now() - 1000 * 60 * 60 * 12) },
      },
    });
    if (duplicateLead) return res.status(400).json({ message: 'Você já enviou interesse recentemente para este anúncio.' });

    const lead = await prisma.lead.create({
      data: {
        listingId: listing.id,
        name,
        phone: normalizedPhone || phone,
        message,
        source,
        status: 'NEW',
      },
    });
    return res.status(201).json(lead);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao registrar interesse.' });
  }
});

module.exports = router;
