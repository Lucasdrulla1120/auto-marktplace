function normalizeSupabasePublicUrl(value = '') {
  return String(value || '').trim();
}

function getAllowedStorageHosts() {
  return String(process.env.SUPABASE_ALLOWED_HOSTS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedSupabasePublicUrl(value = '') {
  const raw = normalizeSupabasePublicUrl(value);
  if (!raw) return false;

  try {
    const url = new URL(raw);
    if (!/^https?:$/i.test(url.protocol)) return false;
    const allowedHosts = getAllowedStorageHosts();
    if (allowedHosts.length > 0 && !allowedHosts.includes(url.hostname.toLowerCase())) {
      return false;
    }
    return /\/storage\/v1\/object\/public\//i.test(url.pathname);
  } catch {
    return false;
  }
}

function hasSupabaseStorageConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET);
}

function getPublicStorageUrl(bucket, path) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

module.exports = {
  isAllowedSupabasePublicUrl,
  hasSupabaseStorageConfig,
  getPublicStorageUrl,
};
