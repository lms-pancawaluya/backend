// src/config/supabase.js

const { createClient } = require('@supabase/supabase-js')

// Pakai service key untuk backend
// Service key punya akses penuh ke storage
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

module.exports = supabase