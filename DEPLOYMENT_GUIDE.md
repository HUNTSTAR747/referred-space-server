# 🚀 Complete Deployment Guide - Referred.space Backend

## Phase 1: Set Up Supabase (5 minutes)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up / log in
4. Click "New project"
5. Fill in:
   - Name: `referred-space`
   - Database Password: (save this!)
   - Region: Choose closest to you
6. Click "Create new project" (takes ~2 minutes)

### Step 2: Run Database Setup
1. In your Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click "New query"
3. Copy the **entire** `supabase-schema.sql` file
4. Paste it into the editor
5. Click "Run" (bottom right)
6. You should see "Success. No rows returned"

### Step 3: Get Your Credentials
1. Go to **Project Settings** → **API**
2. Copy these values (you'll need them):
   - `Project URL` → this is your `SUPABASE_URL`
   - `service_role key` (click "Reveal") → this is your `SUPABASE_SERVICE_KEY`

---

## Phase 2: Set Up Instagram OAuth (10 minutes)

### Step 1: Create Meta Developer Account
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Log in with your Facebook/Instagram account
3. Click "Get Started"
4. Complete verification (may require phone number)

### Step 2: Create Instagram App
1. Click "My Apps" → "Create App"
2. Select **"Consumer"** as app type
3. Fill in:
   - App name: `Referred Space`
   - Contact email: your email
4. Click "Create App"

### Step 3: Add Instagram Product
1. In your app dashboard, scroll to "Add Products"
2. Find **"Instagram Basic Display"**
3. Click "Set Up"

### Step 4: Configure Instagram Settings
1. Click "Basic Display" → "Create New App"
2. Fill in these fields:

**Valid OAuth Redirect URIs:**
```
https://referred.space/oauth/callback
http://localhost:3000/oauth/callback
```

**Deauthorize Callback URL:**
```
https://referred.space/oauth/deauth
```

**Data Deletion Request URL:**
```
https://referred.space/oauth/delete
```

3. Click "Save Changes"

### Step 5: Get Your Credentials
1. Scroll to top of page
2. Copy:
   - **Instagram App ID** → this is your `IG_CLIENT_ID`
   - **Instagram App Secret** → this is your `IG_CLIENT_SECRET`

---

## Phase 3: Deploy to Vercel (5 minutes)

### Step 1: Create GitHub Repository
1. Go to [github.com](https://github.com/new)
2. Create new repository: `referred-space-server`
3. Make it **private** (recommended)
4. Don't initialize with anything
5. Click "Create repository"

### Step 2: Upload Your Code
In your terminal (or GitHub Desktop):

```bash
# Navigate to your project folder
cd referred-space-server

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Connect to GitHub (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/referred-space-server.git

# Push
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Click "Deploy"

### Step 4: Add Environment Variables
1. Once deployed, go to your project dashboard
2. Click "Settings" → "Environment Variables"
3. Add each of these (click "Add" for each one):

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
IG_CLIENT_ID=your_instagram_app_id
IG_CLIENT_SECRET=your_instagram_app_secret
REDIRECT_URI=https://your-project.vercel.app/oauth/callback
SESSION_SECRET=use_a_random_string_here_at_least_32_chars
ALLOWED_ORIGIN=*
NODE_ENV=production
```

**To generate SESSION_SECRET:** Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Redeploy
1. Go to "Deployments" tab
2. Click the 3 dots on latest deployment
3. Click "Redeploy"
4. Check "Use existing build cache" is OFF
5. Click "Redeploy"

---

## Phase 4: Connect Custom Domain (Optional)

### If you own referred.space:

1. In Vercel, go to your project → "Settings" → "Domains"
2. Add `referred.space`
3. Vercel will give you DNS records
4. Go to your domain registrar (Namecheap, GoDaddy, etc.)
5. Add the DNS records Vercel provides
6. Wait ~10 minutes for propagation

### Update Instagram Redirect URI:
1. Go back to Meta Developers
2. Update OAuth Redirect URI to: `https://referred.space/oauth/callback`
3. Update `REDIRECT_URI` in Vercel environment variables

---

## ✅ Testing Your Deployment

### Test 1: Check Server Health
Visit: `https://your-project.vercel.app/`

You should see:
```json
{
  "status": "OK",
  "service": "Referred.space API",
  "version": "1.0.0"
}
```

### Test 2: Add a Test Code
1. Save the `admin-panel.html` file to your computer
2. Open it in a browser
3. Change `API_URL` to your Vercel URL
4. Fill in:
   - Domain: `gymshark.com`
   - Codes: `TEST10`
   - Creators: `@testcreator`
5. Click "Add Codes"
6. Should see: ✅ Success!

### Test 3: Check if Code Exists
Use a tool like [Postman](https://postman.com) or curl:

```bash
curl -X POST https://your-project.vercel.app/api/check-codes \
  -H "Content-Type: application/json" \
  -d '{"domain":"gymshark.com"}'
```

Should return:
```json
{
  "hasCodes": true,
  "codes": [...]
}
```

### Test 4: Instagram OAuth
Visit: `https://your-project.vercel.app/oauth/instagram`

You should be redirected to Instagram login.

---

## 🔒 Security Checklist

- [ ] `SUPABASE_SERVICE_KEY` is the **service_role** key (not anon key)
- [ ] Instagram App is in **Development Mode** initially
- [ ] Environment variables are saved in Vercel (not in code)
- [ ] `.env` file is in `.gitignore` (never commit secrets)
- [ ] Repository is private (if using GitHub)

---

## 🐛 Common Issues

### "Cannot connect to Supabase"
- Check `SUPABASE_URL` doesn't have trailing slash
- Verify you're using `service_role` key, not `anon` key
- Check Supabase project is running (not paused)

### "Instagram OAuth fails"
- Verify redirect URI exactly matches in Meta app settings
- Check `IG_CLIENT_ID` and `IG_CLIENT_SECRET` are correct
- Make sure Instagram app is in test mode with your account added as test user

### "CORS errors"
- Set `ALLOWED_ORIGIN=*` for development
- For production, set to your extension/domain

---

## 📊 Monitor Your Server

**Vercel Dashboard:**
- Real-time logs
- Error tracking
- Performance metrics

**Supabase Dashboard:**
- Database queries
- API usage
- Table inspector

---

## Next Steps

Once your server is live:
1. ✅ Test all endpoints work
2. ✅ Add some test codes
3. ✅ Test Instagram login
4. 🎯 Move to Phase 2: Build Chrome Extension

Need help? Check:
- Vercel deployment logs
- Supabase SQL editor for data
- Browser console for frontend errors