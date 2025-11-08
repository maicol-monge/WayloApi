const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // necesario para subir a bucket privado
const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'waylo.images';

const supabase = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

module.exports = { supabase, supabaseAdmin, BUCKET_NAME };