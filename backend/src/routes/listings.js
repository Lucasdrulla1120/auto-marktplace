const express = require('express');
const prisma = require('../utils/prisma');
const { authRequired } = require('../middleware/auth');
const { toNumber, choosePrimary } = require('../utils/helpers');

const router = express.Router();

function includeConfig(userId = null) {
  return {
    user: { select: { id: true, name: true, phone: true, companyName: true, storeName: true, storeLogoUrl: true, storeBannerUrl: true, storeDescription: true, storeCity: true, storeNeighborhood: true, storeWhatsapp: true, storeIsActive: true } },
    images: { orderBy: { sortOrder: 'asc' } },
    favorites: userId ? { where: { userId }, select: { id: true } } : false,
    _count: { select: { favorites: true, leads: true } }
  };
}

function serializeListing(listing) {
  return { ...listing, isFavorite: !!listing.favorites?.length, favorites: undefined };
}
function containsFilter(value) { return value ? { contains: value, mode: 'insensitive' } : undefined; }
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

router.get('/', async (req, res) => {
  try {
    const { q, brand, model, city, neighborhood, fuel, transmission, color, minPrice, maxPrice, minYear, maxYear, minKm, maxKm, status, sortBy = 'recent', onlyWithPhoto } = req.query;
    const andFilters = [];

    if (q) andFilters.push({ OR: [{ title: containsFilter(q) }, { description: containsFilter(q) }, { brand: containsFilter(q) }, { model: containsFilter(q) }] });
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
    andFilters.push(status ? { status } : { status: 'APPROVED' });

    const userId = req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null;
    const listings = await prisma.listing.findMany({ where: { AND: andFilters }, include: includeConfig(userId), orderBy: buildOrderBy(sortBy) });
    return res.json(listings.map(serializeListing));
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao listar anúncios.' });
  }
});

router.get('/mine', authRequired, async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({ where: { userId: req.user.id }, include: includeConfig(req.user.id), orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }] });
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
      orderBy: { createdAt: 'desc' }
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

router.get('/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null;
    const listing = await prisma.listing.findUnique({ where: { id: Number(req.params.id) }, include: includeConfig(userId) });
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    if (listing.status !== 'APPROVED' && !userId) return res.status(403).json({ message: 'Anúncio indisponível.' });
    return res.json(serializeListing(listing));
  } catch {
    return res.status(500).json({ message: 'Erro ao buscar anúncio.' });
  }
});

router.post('/', authRequired, async (req, res) => {
  try {
    const { title, description, price, brand, model, year, km, transmission, fuel, color, city, neighborhood, phone, images = [] } = req.body;
    if (!title || !description || !price || !brand || !model || !year || !phone) return res.status(400).json({ message: 'Preencha os campos obrigatórios do anúncio.' });
    if (!city || !neighborhood) return res.status(400).json({ message: 'Informe a localização do veículo.' });
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ message: 'Adicione pelo menos uma foto.' });
    if (images.length > 15) return res.status(400).json({ message: 'O limite é de 15 fotos por anúncio.' });

    const activeSubscription = await prisma.subscription.findFirst({ where: { userId: req.user.id, status: 'ACTIVE' }, include: { plan: true }, orderBy: { startedAt: 'desc' } });
    const activeListings = await prisma.listing.count({ where: { userId: req.user.id, status: { not: 'REJECTED' } } });
    const listingLimit = activeSubscription?.plan?.listingLimit ?? 2;
    if (activeListings >= listingLimit) return res.status(400).json({ message: `Seu plano atual permite até ${listingLimit} anúncio(s) ativo(s).` });

    const normalizedImages = choosePrimary(images.map((img) => ({ imageUrl: img.imageUrl, isPrimary: !!img.isPrimary })));
    const listing = await prisma.listing.create({
      data: { userId: req.user.id, title, description, price: toNumber(price), brand, model, year: toNumber(year), km: toNumber(km), transmission: transmission || '', fuel: fuel || '', color: color || '', city, neighborhood, phone, status: 'APPROVED', images: { create: normalizedImages } },
      include: includeConfig(req.user.id)
    });
    return res.status(201).json(serializeListing(listing));
  } catch {
    return res.status(500).json({ message: 'Erro ao criar anúncio.' });
  }
});

router.put('/:id', authRequired, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const existing = await prisma.listing.findUnique({ where: { id: listingId }, include: { images: true } });
    if (!existing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Sem permissão para editar este anúncio.' });
    const { title, description, price, brand, model, year, km, transmission, fuel, color, city, neighborhood, phone, images = [] } = req.body;
    if (!Array.isArray(images) || images.length === 0) return res.status(400).json({ message: 'Adicione pelo menos uma foto.' });
    if (images.length > 15) return res.status(400).json({ message: 'O limite é de 15 fotos por anúncio.' });
    if (!city || !neighborhood) return res.status(400).json({ message: 'Informe a localização do veículo.' });

    const normalizedImages = choosePrimary(images.map((img) => ({ imageUrl: img.imageUrl, isPrimary: !!img.isPrimary })));
    const updated = await prisma.$transaction(async (tx) => {
      await tx.listingImage.deleteMany({ where: { listingId } });
      await tx.listing.update({ where: { id: listingId }, data: { title, description, price: toNumber(price), brand, model, year: toNumber(year), km: toNumber(km), transmission, fuel, color, city, neighborhood, phone, status: 'APPROVED' } });
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
    if (!listing) return res.status(404).json({ message: 'Anúncio não encontrado.' });
    const lead = await prisma.lead.create({ data: { listingId: Number(req.params.id), name, phone, message, status: 'NEW' } });
    return res.status(201).json(lead);
  } catch {
    return res.status(500).json({ message: 'Erro ao registrar interesse.' });
  }
});

module.exports = router;
