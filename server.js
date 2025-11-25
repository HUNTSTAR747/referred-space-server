import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import session from 'express-session';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔧 Starting server...');
console.log('📍 Port:', process.env.PORT || 3000);
console.log('🗄️  Supabase URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('🔑 Service Key:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Test Supabase connection
(async () => {
  try {
    const { data, error } = await supabase.from('stores').select('count').limit(1);
    if (error) {
      console.log('⚠️  Supabase connection issue:', error.message);
    } else {
      console.log('✅ Supabase connected successfully');
    }
  } catch (err) {
    console.log('⚠️  Supabase test failed:', err.message);
  }
})();

// Middleware - CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGIN 
  ? process.env.ALLOWED_ORIGIN.split(',').map(origin => origin.trim())
  : ['*'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins if * is set
    if (allowedOrigins.includes('*')) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ==========================================

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const adminKey = req.headers['x-admin-key'];
  
  // Get your admin key from environment variable
  const ADMIN_KEY = process.env.ADMIN_KEY;
  
  if (!ADMIN_KEY) {
    console.error('❌ ADMIN_KEY not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  const providedKey = authHeader?.replace('Bearer ', '') || adminKey;
  
  if (providedKey === ADMIN_KEY) {
    console.log('✅ Admin authenticated');
    next();
  } else {
    console.log('❌ Unauthorized admin access attempt');
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// ==========================================
// AUTH ROUTES - Email/Password
// ==========================================

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, message: 'Check your email to confirm' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

app.post('/api/auth/logout', async (req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Logged out successfully' });
});

// ==========================================
// INSTAGRAM OAUTH
// ==========================================

app.get('/oauth/instagram', (req, res) => {
  const clientId = process.env.IG_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Instagram OAuth not configured' });
  }
  const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${process.env.REDIRECT_URI}&scope=user_profile,user_media&response_type=code`;
  res.redirect(authUrl);
});

app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const tokenResponse = await axios.post('https://api.instagram.com/oauth/access_token', 
      new URLSearchParams({
        client_id: process.env.IG_CLIENT_ID,
        client_secret: process.env.IG_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: process.env.REDIRECT_URI,
        code
      })
    );

    const { access_token, user_id } = tokenResponse.data;

    const profileResponse = await axios.get(
      `https://graph.instagram.com/me?fields=id,username&access_token=${access_token}`
    );

    const { username, id } = profileResponse.data;

    const { data: creator, error } = await supabase
      .from('creators')
      .upsert({
        instagram_id: id,
        instagram_handle: username,
        access_token: access_token,
        updated_at: new Date().toISOString()
      }, { onConflict: 'instagram_id' })
      .select()
      .single();

    if (error) throw error;

    req.session.creatorId = creator.id;
    req.session.instagramHandle = username;

    res.redirect('/oauth/success');
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/oauth/success', (req, res) => {
  res.send(`
    <html>
      <head><title>Connected!</title></head>
      <body style="font-family: system-ui; max-width: 600px; margin: 100px auto; text-align: center;">
        <h1>✅ Instagram Connected!</h1>
        <p>Handle: @${req.session.instagramHandle || 'Unknown'}</p>
        <p>You can now manage your discount codes.</p>
      </body>
    </html>
  `);
});

// ==========================================
// ADMIN ROUTES (PROTECTED)
// ==========================================

app.post('/admin/store-codes', authenticateAdmin, async (req, res) => {
  console.log('📝 Received store-codes request:', req.body);
  const { domain, codes, creators } = req.body;

  try {
    // Insert store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .upsert({ domain }, { onConflict: 'domain' })
      .select()
      .single();

    if (storeError) throw storeError;
    console.log('✅ Store created/found:', store.domain);

    // Insert codes
    const codeInserts = codes.map(code => ({
      store_id: store.id,
      code: code,
      is_verified: false
    }));

    const { error: codesError } = await supabase
      .from('discount_codes')
      .upsert(codeInserts, { onConflict: 'store_id,code' });

    if (codesError) throw codesError;
    console.log('✅ Codes inserted:', codes);

    // Link creators to codes
    if (creators && creators.length > 0) {
      for (const creator of creators) {
        const { data: creatorData } = await supabase
          .from('creators')
          .select('id')
          .eq('instagram_handle', creator.handle)
          .single();

        if (creatorData) {
          for (const code of codes) {
            const { data: codeData } = await supabase
              .from('discount_codes')
              .select('id')
              .eq('store_id', store.id)
              .eq('code', code)
              .single();

            if (codeData) {
              await supabase
                .from('creator_codes')
                .upsert({
                  creator_id: creatorData.id,
                  code_id: codeData.id
                }, { onConflict: 'creator_id,code_id' });
            }
          }
        }
      }
    }

    res.json({ success: true, store, message: 'Codes added successfully' });
  } catch (error) {
    console.error('❌ Error storing codes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/store-codes', authenticateAdmin, async (req, res) => {
  console.log('📋 Fetching all stores and codes');
  
  try {
    const { data: stores, error } = await supabase
      .from('stores')
      .select(`
        id,
        domain,
        created_at,
        updated_at,
        discount_codes (
          code,
          is_verified,
          success_count
        )
      `)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const formattedStores = stores.map(store => ({
      id: store.id,
      domain: store.domain,
      codes: store.discount_codes,
      updated_at: store.updated_at
    }));

    res.json({ stores: formattedStores });
  } catch (error) {
    console.error('❌ Error fetching stores:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PUBLIC API
// ==========================================

app.post('/api/check-codes', async (req, res) => {
  const { domain } = req.body;
  console.log('🔍 Checking codes for:', domain);

  try {
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('domain', domain)
      .single();

    if (!store) {
      console.log('❌ No store found for:', domain);
      return res.json({ hasCodes: false });
    }

    const { data: codes, error } = await supabase
      .from('discount_codes')
      .select(`
        id,
        code,
        is_verified,
        success_count,
        creator_codes (
          creators (
            instagram_handle
          )
        )
      `)
      .eq('store_id', store.id);

    if (error) throw error;

    const formattedCodes = codes.map(c => ({
      code: c.code,
      verified: c.is_verified,
      successCount: c.success_count || 0,
      creators: c.creator_codes.map(cc => cc.creators.instagram_handle)
    }));

    console.log('✅ Found codes:', formattedCodes.length);
    res.json({
      hasCodes: codes.length > 0,
      codes: formattedCodes
    });
  } catch (error) {
    console.error('❌ Error checking codes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/report-code', async (req, res) => {
  const { domain, code, success } = req.body;

  try {
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('domain', domain)
      .single();

    if (!store) return res.status(404).json({ error: 'Store not found' });

    const { data: discountCode } = await supabase
      .from('discount_codes')
      .select('id, success_count, fail_count')
      .eq('store_id', store.id)
      .eq('code', code)
      .single();

    if (!discountCode) return res.status(404).json({ error: 'Code not found' });

    const updateField = success ? 'success_count' : 'fail_count';
    const currentCount = discountCode[updateField] || 0;

    const { error } = await supabase
      .from('discount_codes')
      .update({ 
        [updateField]: currentCount + 1,
        is_verified: success ? true : discountCode.is_verified 
      })
      .eq('id', discountCode.id);

    if (error) throw error;

    res.json({ success: true, message: 'Report recorded' });
  } catch (error) {
    console.error('Error reporting code:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Referred.space API',
    version: '1.0.0'
  });
});

console.log('✅ Routes configured');

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('=================================');
  console.log('🚀 Server running on port', PORT);
  console.log('🌐 Visit: http://localhost:' + PORT);
  console.log('=================================');
  console.log('');
});