# PropDAO Authentication - Quick Start

## 5-Minute Setup

### Step 1: Get Supabase Credentials (2 min)
1. Go to [supabase.com](https://app.supabase.com)
2. Create a new project or use existing
3. Go to **Settings > API**
4. Copy your **URL** and **Anon Key**

### Step 2: Update .env.local (1 min)
Edit `C:\Users\pand2\propdao-auth\.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key-here
```

### Step 3: Enable Google OAuth (2 min)
1. In Supabase, go to **Authentication > Providers > Google**
2. Toggle "Enabled" to ON
3. Leave Client ID/Secret blank for now (or add Google OAuth credentials)

### Step 4: Run It!
```bash
cd C:\Users\pand2\propdao-auth
npm run dev
```

Visit `http://localhost:3000` and sign in!

## What You Get

✅ Sign-in page with Google OAuth  
✅ Protected dashboard  
✅ Auto-create user accounts  
✅ Beautiful PropDAO design  
✅ Toast notifications  
✅ Session persistence  

## Database Tables to Create

Go to Supabase **SQL Editor** and run `SETUP.md` SQL section.

## Next: Configure Google OAuth Properly

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials (Web app)
3. Set redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Add Client ID & Secret to Supabase Google provider

## Files Overview

| File | Purpose |
|------|---------|
| `app/signin/page.tsx` | Sign-in page |
| `app/dashboard/page.tsx` | Dashboard (protected) |
| `src/lib/supabase.ts` | Supabase client |
| `src/lib/auth.ts` | Auth functions |
| `middleware.ts` | Protect routes |
| `tailwind.config.ts` | PropDAO colors |

## Troubleshooting

**Sign-in button does nothing?**
- Check `.env.local` has correct values
- Restart dev server
- Check browser console for errors

**Redirected to signin after signing in?**
- Google OAuth might not be enabled in Supabase
- Check redirect URI matches your domain

**"Missing environment variables"?**
- Update `.env.local` and restart dev server

## Ready for Phase 2?

Once testing works:
- [ ] Create challenges marketplace page
- [ ] Add payment integration
- [ ] Build challenge launcher
