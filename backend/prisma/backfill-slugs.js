const { PrismaClient } = require('@prisma/client');
const { slugify } = require('../src/utils/helpers');

const prisma = new PrismaClient();

async function uniqueListingSlug(baseSlug, ignoreId) {
  const base = slugify(baseSlug || 'anuncio');
  let slug = base;
  let counter = 2;
  while (true) {
    const existing = await prisma.listing.findFirst({ where: { slug } });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

async function uniqueStoreSlug(baseSlug, ignoreId) {
  const base = slugify(baseSlug || 'loja');
  let slug = base;
  let counter = 2;
  while (true) {
    const existing = await prisma.user.findFirst({ where: { storeSlug: slug } });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: { OR: [{ slug: null }, { slug: '' }] },
    select: { id: true, title: true, brand: true, model: true, year: true, city: true },
  });

  for (const item of listings) {
    const slug = await uniqueListingSlug(
      `${item.title || ''}-${item.brand || ''}-${item.model || ''}-${item.year || ''}-${item.city || ''}`,
      item.id,
    );
    await prisma.listing.update({ where: { id: item.id }, data: { slug } });
  }

  const stores = await prisma.user.findMany({
    where: {
      storeIsActive: true,
      AND: [
        { OR: [{ storeSlug: null }, { storeSlug: '' }] },
        { OR: [{ storeName: { not: null } }, { companyName: { not: null } }] },
      ],
    },
    select: { id: true, storeName: true, companyName: true },
  });

  for (const store of stores) {
    const slug = await uniqueStoreSlug(store.storeName || store.companyName || `loja-${store.id}`, store.id);
    await prisma.user.update({ where: { id: store.id }, data: { storeSlug: slug } });
  }

  console.log(`[ok] backfill concluido: ${listings.length} anuncio(s) e ${stores.length} loja(s).`);
}

main()
  .catch((error) => {
    console.error('Falha ao preencher slugs legados:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
