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

function getStorageObjectPathFromPublicUrl(value = '') {
  const raw = normalizeSupabasePublicUrl(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i);
    if (!match) return null;
    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

async function removeStorageObjects(items = []) {
  const entries = (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return { bucket: process.env.SUPABASE_STORAGE_BUCKET || 'marketplace-media', path: item };
      }
      const bucket = String(item.bucket || process.env.SUPABASE_STORAGE_BUCKET || 'marketplace-media');
      const path = String(item.path || '').trim();
      return path ? { bucket, path } : null;
    })
    .filter(Boolean);

  if (!entries.length || !hasSupabaseStorageConfig()) return { removed: 0 };

  const grouped = entries.reduce((acc, entry) => {
    const key = entry.bucket;
    acc[key] = acc[key] || [];
    if (!acc[key].includes(entry.path)) acc[key].push(entry.path);
    return acc;
  }, {});

  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');

  for (const [bucket, paths] of Object.entries(grouped)) {
    const response = await fetch(`${base}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: paths }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || payload.error || 'Não foi possível remover imagens do Supabase Storage.');
    }
  }

  return { removed: entries.length };
}

module.exports = {
  isAllowedSupabasePublicUrl,
  hasSupabaseStorageConfig,
  getPublicStorageUrl,
  getStorageObjectPathFromPublicUrl,
  removeStorageObjects,
};
