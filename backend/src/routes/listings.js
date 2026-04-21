const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired, optionalAuth } = require('../middleware/auth');
const {
  toNumber,
  choosePrimary,
  sanitizeString,
  normalizePhone,
  validateImagesPayload,
  normalizePage,
  normalizePerPage,
} = require('../utils/helpers');
const { runMarketplaceMaintenance, getListingLimitForUser } = require('../utils/marketplaceLifecycle');

const router = express.Router();

function includeConfig(userId = null) {
  const include = {
    user: {
      select: {
        id: true,
        name: true,
        phone: true,
        companyName: true,
        storeName: true,
        storeLogoUrl: true,
        storeBannerUrl: true,
        storeDescription: true,
        storeCity: true,
        storeNeighborhood: true,
        storeWhatsapp: true,
        storeIsActive: true,
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

function serializeListing(listing) {
  const sellerName = listing.user?.storeName || listing.user?.companyName || listing.user?.name || 'Vendedor';
  const sellerType = listing.user?.storeIsActive ? 'LOJA' : listing.user?.companyName ? 'REVENDA' : 'PARTICULAR';

  return {
    ...listing,
    isFavorite: !!listing.favorites?.length,
    favorites: undefined,
    favoriteCount: listing._count?.favorites || 0,
    leadCount: listing._count?.leads || 0,
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
    },
  };
}

function containsFilter(value) {
  return value ? { contains: value, mode: 'insensitive' } : undefined;
}

function buildOrderBy(sortBy) {
  const secondary = { createdAt: 'desc' };
  switch (sortBy) {
    case 'price_asc': return [{ isFeatured: 'desc' }, { price: 'asc' }, secondary];
    case 'price_desc': return [{ isFeatured: 'desc' }, { price: 'desc' }, secondary];
    case 'year_desc': return [{ isFeatured: 'desc' }, { year: 'desc' }, secondary];
    case 'km_asc': return [{ isFeatured: 'desc' }, { km: 'asc' }, secondary];
    default: return [{ isFeatured: 'desc' }, secondary];
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

router.get('/', optionalAuth, async (req, res) => {
  try {
    await runMarketplaceMaintenance();
    const {
      q, brand, model, city, neighborhood, fuel, transmission, color,
      minPrice, maxPrice, minYear, maxYear, minKm, maxKm,
      status, sortBy = 'recent', onlyWithPhoto, favoriteOnly, page, perPage
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
    if (String(favoriteOnly) === 'true') {
      if (!req.user) return res.status(401).json({ message: 'Faça login para ver seus favoritos.' });
      andFilters.push({ favorites: { some: { userId: req.user.id } } });
    }

    if (req.user?.role === 'ADMIN' && status) andFilters.push({ status: String(status) });
    else andFilters.push({ status: 'APPROVED' });

    const where = { AND: andFilters };
    const shouldPaginate = page || perPage;
    const safePage = normalizePage(page, 1);
    const safePerPage = normalizePerPage(perPage, 12, 48);

    const [total, listings] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        include: includeConfig(req.user?.id || null),
        orderBy: buildOrderBy(sortBy),
        ...(shouldPaginate ? { skip: (safePage - 1) * safePerPage, take: safePerPage } : {}),
      }),
    ]);

    const items = listings.map(serializeListing);
    if (!shouldPaginate) return res.json(items);

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

router.get('/mine', authRequired, async (req, res) => {
  try {
    await runMarketplaceMaintenance();
    const listings = await prisma.listing.findMany({
      where: { userId: req.user.id },
      include: includeConfig(req.user.id),
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });
    return res.json(listings.map(serializeListing));
  } catch {
    return res.status(500).json({ message: 'Erro ao listar seus anúncios.' });
  }
});

router.get('/mine/leads', authRequired, async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { listing: { userId: req.user.id } },
      include: { listing: { select: { id: true, title: true, brand: true, model: true, city: true, phone: true, images: { orderBy: { sortOrder: 'asc' } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(leads);
  } catch {
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
    const updated = await prisma.lead.update({ where: { id: lead.id }, data: { status } });
    return res.json(updated);
  } catch {
    return res.status(500).json({ message: 'Erro ao atualizar lead.' });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    await runMarketplaceMaintenance();
    const listing = await prisma.listing.findUnique({ where: { id: Number(req.params.id) }, include: includeConfig(req.user?.id || null) });
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });

    const isOwner = req.user && listing.userId === req.user.id;
    const isAdmin = req.user?.role === 'ADMIN';
    if (listing.status !== 'APPROVED' && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Anúncio indisponível.' });
    }

    return res.json(serializeListing(listing));
  } catch {
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

    const { listingLimit } = await getListingLimitForUser(req.user.id);
    const activeListings = await prisma.listing.count({ where: { userId: req.user.id, status: { not: 'REJECTED' } } });
    if (activeListings >= listingLimit) return res.status(400).json({ message: `Seu plano atual permite até ${listingLimit} anúncio(s) ativo(s).` });

    const normalizedImages = normalizeImagePayload(req.body.images || []);
    const listing = await prisma.listing.create({
      data: { userId: req.user.id, ...data, phone: normalizePhone(data.phone) || data.phone, status: req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING', images: { create: normalizedImages } },
      include: includeConfig(req.user.id),
    });
    return res.status(201).json(serializeListing(listing));
  } catch {
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

    const normalizedImages = normalizeImagePayload(req.body.images || []);
    const nextStatus = req.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING';

    const updated = await prisma.$transaction(async (tx) => {
      await tx.listingImage.deleteMany({ where: { listingId } });
      await tx.listing.update({ where: { id: listingId }, data: { ...data, phone: normalizePhone(data.phone) || data.phone, status: nextStatus } });
      await tx.listingImage.createMany({ data: normalizedImages.map((img, index) => ({ ...img, listingId, sortOrder: index })) });
      return tx.listing.findUnique({ where: { id: listingId }, include: includeConfig(req.user.id) });
    });

    return res.json(serializeListing(updated));
  } catch {
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
  } catch {
    return res.status(500).json({ message: 'Erro ao excluir anúncio.' });
  }
});

router.post('/:id/favorite', authRequired, async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: Number(req.params.id) } });
    if (!listing || listing.status !== 'APPROVED') return res.status(404).json({ message: 'Anúncio não encontrado.' });
    await prisma.favorite.create({ data: { userId: req.user.id, listingId: Number(req.params.id) } });
    return res.status(201).json({ success: true });
  } catch {
    return res.status(400).json({ message: 'Não foi possível favoritar este anúncio.' });
  }
});

router.delete('/:id/favorite', authRequired, async (req, res) => {
  try {
    await prisma.favorite.delete({ where: { userId_listingId: { userId: req.user.id, listingId: Number(req.params.id) } } });
    return res.json({ success: true });
  } catch {
    return res.status(400).json({ message: 'Não foi possível remover dos favoritos.' });
  }
});

router.post('/:id/lead', async (req, res) => {
  try {
    const { name, phone, message } = req.body;
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
        name: sanitizeString(name, 120),
        phone: normalizedPhone || sanitizeString(phone, 30),
        message: sanitizeString(message, 1000),
        status: 'NEW',
      },
    });
    return res.status(201).json(lead);
  } catch {
    return res.status(500).json({ message: 'Erro ao registrar interesse.' });
  }
});

module.exports = router;
