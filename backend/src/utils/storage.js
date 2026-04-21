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
    if (url.protocol !== 'https:') return false;
    const allowedHosts = getAllowedStorageHosts();
    if (allowedHosts.length > 0 && !allowedHosts.includes(url.hostname.toLowerCase())) {
      return false;
    }
    return /\/storage\/v1\/object\/public\//i.test(url.pathname);
  } catch {
    return false;
  }
}

module.exports = {
  isAllowedSupabasePublicUrl,
};
