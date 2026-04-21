const express = require('express');
const crypto = require('crypto');
const { authRequired } = require('../middleware/auth');
const { hasSupabaseStorageConfig, getPublicStorageUrl } = require('../utils/storage');

const router = express.Router();

function sanitizeSegment(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'arquivo';
}

function buildStoragePath({ folder, userId, fileName, listingId = null }) {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  const base = sanitizeSegment(String(fileName || '').replace(/\.[^.]+$/, ''));
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const parts = [folder, `user-${userId}`];
  if (listingId) parts.push(`listing-${listingId}`);
  parts.push(`${yyyy}-${mm}`);
  parts.push(`${crypto.randomUUID()}-${base}.${ext || 'bin'}`);
  return parts.join('/');
}

async function createSignedUploadUrl({ bucket, path }) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const response = await fetch(`${base}/storage/v1/object/upload/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Não foi possível gerar URL assinada para upload.');
  }
  return payload;
}

router.post('/sign-upload', authRequired, async (req, res) => {
  try {
    if (!hasSupabaseStorageConfig()) {
      return res.status(503).json({ message: 'Supabase Storage não configurado no backend.' });
    }

    const allowedFolders = ['listings', 'stores'];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const folder = allowedFolders.includes(String(req.body.folder || '')) ? String(req.body.folder) : 'listings';
    const contentType = String(req.body.contentType || '').toLowerCase();
    const fileName = String(req.body.fileName || '').trim();
    const fileSize = Number(req.body.fileSize || 0);
    const listingId = req.body.listingId ? Number(req.body.listingId) : null;

    if (!fileName) return res.status(400).json({ message: 'Arquivo inválido.' });
    if (!allowedMimeTypes.includes(contentType)) {
      return res.status(400).json({ message: 'Formato não permitido. Use JPG, PNG ou WEBP.' });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 6 * 1024 * 1024) {
      return res.status(400).json({ message: 'A imagem deve ter no máximo 6 MB após otimização.' });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'marketplace-media';
    const path = buildStoragePath({ folder, userId: req.user.id, fileName, listingId });
    const signed = await createSignedUploadUrl({ bucket, path });

    return res.json({
      bucket,
      path,
      token: signed.token,
      publicUrl: getPublicStorageUrl(bucket, path),
      expiresInSeconds: 7200,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Erro ao preparar upload.' });
  }
});

module.exports = router;
