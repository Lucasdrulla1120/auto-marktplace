const { createClient } = require('@supabase/supabase-js');

let client = null;

function hasSupabaseStorageConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET);
}

function getSupabaseAdmin() {
  if (!hasSupabaseStorageConfig()) {
    throw new Error('Supabase Storage não configurado no backend.');
  }
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

module.exports = {
  hasSupabaseStorageConfig,
  getSupabaseAdmin,
};
