import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const storageBucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'marketplace-media';
const apiBaseUrl = import.meta.env.VITE_API_URL || '';

let client = null;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey && apiBaseUrl);
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado. Preencha VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_API_URL.');
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'arquivo';
}

function fileToImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

async function compressImage(file, { maxWidth = 1600, maxHeight = 1200, quality = 0.82 } = {}) {
  const mime = String(file.type || '').toLowerCase();
  if (!mime.startsWith('image/') || /gif|svg/.test(mime)) {
    const buffer = await file.arrayBuffer();
    return {
      fileToUpload: new File([buffer], file.name, { type: file.type || 'application/octet-stream' }),
      contentType: file.type || 'application/octet-stream',
      width: null,
      height: null,
    };
  }

  const source = await fileToImageElement(file);
  const ratio = Math.min(1, maxWidth / source.width, maxHeight / source.height);
  const width = Math.max(1, Math.round(source.width * ratio));
  const height = Math.max(1, Math.round(source.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) return resolve(result);
      return reject(new Error('Não foi possível otimizar a imagem.'));
    }, 'image/webp', quality);
  });

  const nextName = `${slugify(file.name.replace(/\.[a-z0-9]+$/i, ''))}.webp`;
  return {
    fileToUpload: new File([blob], nextName, { type: 'image/webp' }),
    contentType: 'image/webp',
    width,
    height,
  };
}

async function requestSignedUpload({ token, folder, fileName, contentType, fileSize, listingId = null }) {
  const response = await fetch(`${apiBaseUrl}/storage/sign-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ folder, fileName, contentType, fileSize, listingId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Não foi possível preparar o upload no Supabase.');
  }
  return data;
}

export async function uploadImageToSupabase(file, { token, folder = 'listings', listingId = null } = {}) {
  if (!token) throw new Error('Sessão inválida para upload. Faça login novamente.');
  const supabase = getSupabaseClient();
  const optimized = await compressImage(file, folder === 'stores' ? { maxWidth: 2000, maxHeight: 1200, quality: 0.84 } : { maxWidth: 1600, maxHeight: 1200, quality: 0.82 });

  const signed = await requestSignedUpload({
    token,
    folder,
    fileName: optimized.fileToUpload.name,
    contentType: optimized.contentType,
    fileSize: optimized.fileToUpload.size,
    listingId,
  });

  const { error } = await supabase.storage
    .from(storageBucket)
    .uploadToSignedUrl(signed.path, signed.token, optimized.fileToUpload, {
      contentType: optimized.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Falha ao enviar a imagem para o Supabase Storage.');
  }

  return {
    imageUrl: signed.publicUrl,
    storageKey: signed.path,
    fileName: optimized.fileToUpload.name,
    mimeType: optimized.contentType,
    sizeBytes: optimized.fileToUpload.size,
    width: optimized.width,
    height: optimized.height,
    bucket: storageBucket,
  };
}
