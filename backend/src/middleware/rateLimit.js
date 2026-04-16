const buckets = new Map();

function getClientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.connection?.remoteAddress || 'unknown';
}

function cleanupBucket(key, now) {
  const entry = buckets.get(key);
  if (!entry) return null;
  if (entry.resetAt <= now) {
    buckets.delete(key);
    return null;
  }
  return entry;
}

function rateLimit({ windowMs = 60_000, max = 20, message = 'Muitas requisições. Tente novamente em instantes.' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const clientKey = `${req.method}:${req.baseUrl || ''}:${req.path}:${getClientKey(req)}`;
    let entry = cleanupBucket(clientKey, now);
    if (!entry) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(clientKey, entry);
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(max - entry.count, 0)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return res.status(429).json({ message });
    }

    return next();
  };
}

module.exports = { rateLimit };
