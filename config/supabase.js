const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Para operaciones públicas
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Para operaciones administrativas

// Cliente público (para la mayoría de operaciones)
const supabase = createClient(supabaseUrl, supabaseKey);

// Cliente administrativo (para operaciones que requieren permisos especiales)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'ecopoints_images';

module.exports = {
  supabase,
  supabaseAdmin,
  BUCKET_NAME
};