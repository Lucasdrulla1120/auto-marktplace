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
  return String(value || '').trim().slice(0, maxLength);
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

function normalizeImagePayload(images = []) {
  return choosePrimary(Array.isArray(images) ? images : []).map((image, index) => ({
    imageUrl: sanitizeString(image?.imageUrl, 2000),
    storageKey: sanitizeString(image?.storageKey, 500) || null,
    fileName: sanitizeString(image?.fileName, 255) || null,
    mimeType: sanitizeString(image?.mimeType, 120) || null,
    sizeBytes: Number.isFinite(Number(image?.sizeBytes)) ? Number(image.sizeBytes) : null,
    width: Number.isFinite(Number(image?.width)) ? Number(image.width) : null,
    height: Number.isFinite(Number(image?.height)) ? Number(image.height) : null,
    bucket: sanitizeString(image?.bucket, 120) || null,
    isPrimary: !!image?.isPrimary,
    sortOrder: index,
  }));
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

module.exports = {
  toNumber,
  normalizeStatus,
  choosePrimary,
  sanitizeString,
  normalizePhone,
  normalizeImagePayload,
  validateImagesPayload,
  normalizePage,
  normalizePerPage,
};
