const prisma = require('./prisma');

let lastMaintenanceAt = 0;
let currentRun = null;
const MAINTENANCE_WINDOW_MS = 60 * 1000;

function addDays(baseDate = new Date(), days = 30) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function getListingDurationForSubscription(subscription) {
  const slug = subscription?.plan?.slug || 'particular';
  if (slug === 'premium') return 60;
  if (slug === 'lojista') return 45;
  return 30;
}

async function runMarketplaceMaintenance(force = false) {
  if (!force && Date.now() - lastMaintenanceAt < MAINTENANCE_WINDOW_MS) return;
  if (currentRun) return currentRun;

  currentRun = (async () => {
    const now = new Date();

    await prisma.listing.updateMany({
      where: { isFeatured: true, featuredUntil: { lt: now } },
      data: { isFeatured: false, featuredUntil: null },
    }).catch(() => null);

    await prisma.listing.updateMany({
      where: {
        status: { in: ['APPROVED', 'PENDING'] },
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED', isFeatured: false, featuredUntil: null },
    }).catch(() => null);

    await prisma.payment.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    }).catch(() => null);

    await prisma.subscription.updateMany({
      where: {
        status: { in: ['ACTIVE', 'ACTIVATING', 'PENDING_PAYMENT', 'PAST_DUE'] },
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    }).catch(() => null);

    lastMaintenanceAt = Date.now();
  })().finally(() => {
    currentRun = null;
  });

  return currentRun;
}

async function getCurrentSubscription(userId) {
  await runMarketplaceMaintenance();
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'ACTIVATING', 'PAST_DUE'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { plan: true },
    orderBy: { startedAt: 'desc' },
  });
}

async function getListingLimitForUser(userId) {
  const subscription = await getCurrentSubscription(userId);
  return { subscription, listingLimit: subscription?.plan?.listingLimit ?? 2 };
}

module.exports = {
  addDays,
  getListingDurationForSubscription,
  runMarketplaceMaintenance,
  getCurrentSubscription,
  getListingLimitForUser,
};
