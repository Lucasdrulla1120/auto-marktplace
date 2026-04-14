function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(status) {
  const allowed = ['PENDING', 'APPROVED', 'REJECTED'];
  return allowed.includes(status) ? status : 'PENDING';
}

function sanitizeImages(images = []) {
  return images.slice(0, 15).map((image, index) => ({
    imageUrl: image.imageUrl,
    isPrimary: !!image.isPrimary,
    sortOrder: index,
  }));
}

function choosePrimary(images = []) {
  if (!images.length) return [];
  let hasPrimary = images.some((img) => img.isPrimary);
  return images.map((img, index) => ({
    ...img,
    isPrimary: hasPrimary ? !!img.isPrimary : index === 0,
    sortOrder: index,
  }));
}

module.exports = {
  toNumber,
  normalizeStatus,
  sanitizeImages,
  choosePrimary,
};
