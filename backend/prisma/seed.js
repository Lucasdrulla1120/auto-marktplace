const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function ensurePlan(data) {
  return prisma.plan.upsert({ where: { slug: data.slug }, update: data, create: data });
}

async function ensureListing(data) {
  const exists = await prisma.listing.findFirst({ where: { slug: data.slug } });
  if (exists) {
    await prisma.listingImage.deleteMany({ where: { listingId: exists.id } });
    return prisma.listing.update({
      where: { id: exists.id },
      data: {
        ...data,
        images: data.images,
      },
    });
  }
  return prisma.listing.create({ data });
}

async function ensurePayment(data) {
  const exists = await prisma.payment.findUnique({ where: { externalRef: data.externalRef } }).catch(() => null);
  if (exists) return exists;
  return prisma.payment.create({ data });
}

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@automarket.local' },
    update: {
      name: 'Administrador',
      phone: '(00) 90000-0000',
      role: 'ADMIN',
      companyName: 'Local Marketplace Admin',
    },
    create: {
      name: 'Administrador',
      email: 'admin@automarket.local',
      phone: '(00) 90000-0000',
      passwordHash: adminPassword,
      role: 'ADMIN',
      companyName: 'Local Marketplace Admin',
    },
  });

  const seller = await prisma.user.upsert({
    where: { email: 'vendedor@automarket.local' },
    update: {
      name: 'Vendedor Demo',
      phone: '5511988887777',
      companyName: 'Drulla Veículos',
    },
    create: {
      name: 'Vendedor Demo',
      email: 'vendedor@automarket.local',
      phone: '5511988887777',
      passwordHash: userPassword,
      role: 'USER',
      companyName: 'Drulla Veículos',
    },
  });

  const premiumSeller = await prisma.user.upsert({
    where: { email: 'premium@automarket.local' },
    update: {
      name: 'Loja Premium Demo',
      phone: '5511977776666',
      companyName: 'Premium Cars',
      storeName: 'Premium Cars',
      storeSlug: 'premium-cars',
      storeDescription: 'Loja demo com vitrine profissional e atendimento rápido pelo WhatsApp.',
      storeCity: 'Sua Cidade',
      storeNeighborhood: 'Centro',
      storeWhatsapp: '5511977776666',
      storeInstagram: '@premiumcars',
      storeIsActive: true,
      storeIsVerified: true,
      storeVerifiedAt: new Date(),
      storeLogoUrl: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=400&q=80',
      storeBannerUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    },
    create: {
      name: 'Loja Premium Demo',
      email: 'premium@automarket.local',
      phone: '5511977776666',
      passwordHash: userPassword,
      role: 'USER',
      companyName: 'Premium Cars',
      storeName: 'Premium Cars',
      storeSlug: 'premium-cars',
      storeDescription: 'Loja demo com vitrine profissional e atendimento rápido pelo WhatsApp.',
      storeCity: 'Sua Cidade',
      storeNeighborhood: 'Centro',
      storeWhatsapp: '5511977776666',
      storeInstagram: '@premiumcars',
      storeIsActive: true,
      storeIsVerified: true,
      storeVerifiedAt: new Date(),
      storeLogoUrl: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=400&q=80',
      storeBannerUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    },
  });

  const plans = await Promise.all([
    ensurePlan({ slug: 'particular', name: 'Particular', priceMonthly: 0, listingLimit: 2, featuredSlots: 0, description: 'Para vendedor ocasional com até 2 anúncios ativos.', benefits: '2 anúncios ativos|Sem destaque|Leads por WhatsApp', displayOrder: 1, isRecommended: false }),
    ensurePlan({ slug: 'lojista', name: 'Lojista', priceMonthly: 99, listingLimit: 25, featuredSlots: 3, description: 'Plano mensal para lojas com maior volume e leads.', benefits: '25 anúncios ativos|3 destaques simultâneos|Painel comercial de leads', displayOrder: 2, isRecommended: true }),
    ensurePlan({ slug: 'premium', name: 'Premium', priceMonthly: 199, listingLimit: 80, featuredSlots: 12, description: 'Plano comercial com vitrine forte e mais destaque.', benefits: '80 anúncios ativos|12 destaques simultâneos|Loja verificada e prioridade comercial', displayOrder: 3, isRecommended: false }),
  ]);

  const particularPlan = plans.find((p) => p.slug === 'particular');
  const premiumPlan = plans.find((p) => p.slug === 'premium');
  const subscription = await prisma.subscription.upsert({
    where: { externalRef: 'DEFAULT-PARTICULAR-DEMO-001' },
    update: { userId: seller.id, planId: particularPlan.id, status: 'ACTIVE', paymentMethod: 'DEFAULT_PARTICULAR', expiresAt: null },
    create: {
      userId: seller.id,
      planId: particularPlan.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      paymentMethod: 'DEFAULT_PARTICULAR',
      startedAt: new Date(),
      expiresAt: null,
      externalRef: 'DEFAULT-PARTICULAR-DEMO-001',
      mercadoPagoPayerEmail: seller.email,
    },
  });

  await prisma.subscription.upsert({
    where: { externalRef: 'DEFAULT-PREMIUM-DEMO-001' },
    update: { userId: premiumSeller.id, planId: premiumPlan.id, status: 'ACTIVE', paymentMethod: 'LOCAL_SIMULATION', expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
    create: {
      userId: premiumSeller.id,
      planId: premiumPlan.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      paymentMethod: 'LOCAL_SIMULATION',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      externalRef: 'DEFAULT-PREMIUM-DEMO-001',
      mercadoPagoPayerEmail: premiumSeller.email,
    },
  });

  const sampleListings = [
    {
      userId: seller.id,
      slug: 'honda-civic-exl-2020-sua-cidade',
      title: 'Honda Civic EXL 2020',
      description: 'Sedan muito bem conservado, revisado, com laudo cautelar aprovado e fotos completas para gerar mais confiança.',
      price: 112900,
      brand: 'Honda',
      model: 'Civic',
      year: 2020,
      km: 48500,
      transmission: 'Automático',
      fuel: 'Flex',
      color: 'Prata',
      city: 'Sua Cidade',
      neighborhood: 'Centro',
      phone: seller.phone,
      status: 'APPROVED',
      qualityScore: 86,
      viewCount: 112,
      whatsappClicks: 18,
      isFeatured: true,
      featuredUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
      publishedAt: new Date(),
      images: { create: [
        { imageUrl: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=900&q=80', isPrimary: true, sortOrder: 0 },
        { imageUrl: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=900&q=80', isPrimary: false, sortOrder: 1 },
      ] },
    },
    {
      userId: seller.id,
      slug: 'toyota-corolla-xei-2022-sua-cidade',
      title: 'Toyota Corolla XEi 2022',
      description: 'Corolla de garagem, multimídia, bancos em couro, revisões em dia e excelente estado geral.',
      price: 139900,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
      km: 22000,
      transmission: 'CVT',
      fuel: 'Flex',
      color: 'Branco',
      city: 'Sua Cidade',
      neighborhood: 'Jardim América',
      phone: seller.phone,
      status: 'APPROVED',
      qualityScore: 81,
      viewCount: 78,
      whatsappClicks: 11,
      isFeatured: false,
      publishedAt: new Date(),
      images: { create: [
        { imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80', isPrimary: true, sortOrder: 0 },
      ] },
    },
    {
      userId: premiumSeller.id,
      slug: 'jeep-compass-longitude-2023-sua-cidade',
      title: 'Jeep Compass Longitude 2023',
      description: 'SUV de loja premium com revisão em dia, acabamento impecável, atendimento rápido e veículo pronto para transferência.',
      price: 168900,
      brand: 'Jeep',
      model: 'Compass',
      year: 2023,
      km: 15000,
      transmission: 'Automático',
      fuel: 'Flex',
      color: 'Preto',
      city: 'Sua Cidade',
      neighborhood: 'Centro',
      phone: premiumSeller.phone,
      status: 'APPROVED',
      qualityScore: 93,
      viewCount: 215,
      whatsappClicks: 34,
      isFeatured: true,
      featuredUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
      publishedAt: new Date(),
      images: { create: [
        { imageUrl: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=80', isPrimary: true, sortOrder: 0 },
      ] },
    },
  ];

  for (const item of sampleListings) {
    await ensureListing(item);
  }

  const firstListing = await prisma.listing.findFirst({ orderBy: { id: 'asc' } });
  if (firstListing) {
    await prisma.favorite.upsert({
      where: { userId_listingId: { userId: seller.id, listingId: firstListing.id } },
      update: {},
      create: { userId: seller.id, listingId: firstListing.id },
    });

    const existingLead = await prisma.lead.findFirst({ where: { listingId: firstListing.id, phone: '5511999990000' } });
    if (!existingLead) {
      await prisma.lead.create({
        data: {
          listingId: firstListing.id,
          name: 'Comprador Demo',
          phone: '5511999990000',
          message: 'Olá! Gostaria de agendar uma visita para ver esse veículo.',
          source: 'FORM',
          status: 'CONTACTED',
          firstResponseAt: new Date(Date.now() - 1000 * 60 * 45),
        },
      });
    }

    await ensurePayment({
      userId: seller.id,
      listingId: firstListing.id,
      subscriptionId: subscription.id,
      type: 'FEATURED',
      status: 'PAID',
      amount: 19.9,
      provider: 'LOCAL_SIMULATION',
      externalRef: 'FEATURED-DEMO-001',
      description: 'Destaque demo de 7 dias',
      durationDays: 7,
      paidAt: new Date(),
    });
  }

  console.log('Seed v5.0 concluído com sucesso.');
  console.log(`Admin: admin@automarket.local / admin123 (id ${admin.id})`);
  console.log(`Usuário: vendedor@automarket.local / user123 (id ${seller.id})`);
  console.log(`Loja Premium: premium@automarket.local / user123 (id ${premiumSeller.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
