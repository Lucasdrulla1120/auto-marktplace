function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(status) {
  const allowed = ['PENDING', 'APPROVED', 'REJECTED'];
  return allowed.includes(status) ? status : 'PENDING';
}

function choosePrimary(images = []) {
  if (!images.length) return [];
  const hasPrimary = images.some((img) => img.isPrimary);
  return images.map((img, index) => ({
    ...img,
    isPrimary: hasPrimary ? !!img.isPrimary : index === 0,
    sortOrder: index,
  }));
}

function sanitizeString(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizePhone(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function isHttpUrl(value = '') {
  return /^https?:\/\//i.test(String(value || ''));
}

function isBase64Image(value = '') {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(value || ''));
}

function estimateImageBytes(imageUrl = '') {
  const value = String(imageUrl || '');
  if (isBase64Image(value)) {
    const base64 = value.split(',')[1] || '';
    return Math.ceil((base64.length * 3) / 4);
  }
  return 0;
}

function validateImagesPayload(images = []) {
  if (!Array.isArray(images) || images.length === 0) return 'Adicione pelo menos uma foto.';
  if (images.length > 15) return 'O limite é de 15 fotos por anúncio.';

  const totalBytes = images.reduce((acc, item) => acc + estimateImageBytes(item.imageUrl), 0);

  for (const image of images) {
    const imageUrl = String(image?.imageUrl || '').trim();
    if (!imageUrl) return 'Todas as fotos precisam ter um endereço válido.';
    if (!isHttpUrl(imageUrl) && !isBase64Image(imageUrl)) {
      return 'Use imagens em URL pública ou em base64 data:image.';
    }
    const bytes = estimateImageBytes(imageUrl);
    if (bytes > 3 * 1024 * 1024) {
      return 'Cada foto deve ter no máximo aproximadamente 3 MB após otimização.';
    }
  }

  if (totalBytes > 10 * 1024 * 1024) {
    return 'O total das fotos ficou muito pesado. Envie imagens mais leves.';
  }

  return null;
}

function normalizePage(value, fallback = 1) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : fallback;
}

function normalizePerPage(value, fallback = 12, max = 48) {
  const perPage = Number.parseInt(value, 10);
  if (!Number.isFinite(perPage) || perPage <= 0) return fallback;
  return Math.min(perPage, max);
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'item';
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function passwordValidationError(value = '') {
  const password = String(value || '');
  if (password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  return null;
}

function sanitizeOptionalUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return null;
  return isHttpUrl(url) ? url : null;
}

function calculateListingQualityScore(data = {}, imageCount = 0, seller = {}) {
  let score = 0;
  const title = sanitizeString(data.title || '', 140);
  const description = sanitizeString(data.description || '', 5000);

  if (title.length >= 18) score += 12;
  else if (title.length >= 10) score += 8;

  if (description.length >= 280) score += 22;
  else if (description.length >= 160) score += 16;
  else if (description.length >= 80) score += 10;

  if (data.price > 0) score += 8;
  if (data.brand) score += 6;
  if (data.model) score += 6;
  if (data.year >= 1900) score += 6;
  if (data.km >= 0) score += 5;
  if (data.transmission) score += 4;
  if (data.fuel) score += 4;
  if (data.color) score += 3;
  if (data.city) score += 5;
  if (data.neighborhood) score += 4;
  if (normalizePhone(data.phone).length >= 10) score += 5;

  if (imageCount >= 10) score += 14;
  else if (imageCount >= 6) score += 11;
  else if (imageCount >= 3) score += 8;
  else if (imageCount >= 1) score += 4;

  if (seller.storeIsActive) score += 4;
  if (seller.storeIsVerified) score += 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = {
  toNumber,
  normalizeStatus,
  choosePrimary,
  sanitizeString,
  normalizePhone,
  validateImagesPayload,
  normalizePage,
  normalizePerPage,
  slugify,
  isValidEmail,
  passwordValidationError,
  sanitizeOptionalUrl,
  calculateListingQualityScore,
};
