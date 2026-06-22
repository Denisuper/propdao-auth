# PropDAO Authentication System - Setup Guide

## Overview

This is a Next.js 15 authentication system for PropDAO with Google OAuth integration, built with TypeScript, Tailwind CSS, and Supabase.

## Tech Stack

- **Frontend**: Next.js 15 + TypeScript + React 19
- **Authentication**: Supabase Auth (Google OAuth)
- **Database**: Supabase PostgreSQL
- **Styling**: Tailwind CSS v4
- **Notifications**: Sonner (toast)

## Project Structure

```
propdao-auth/
├── app/
│   ├── layout.tsx          # Root layout with toast provider
│   ├── page.tsx            # Redirect to signin
│   ├── globals.css         # Global styles with PropDAO colors
│   ├── signin/
│   │   └── page.tsx        # Google OAuth signin page
│   ├── dashboard/
│   │   └── page.tsx        # Protected dashboard page
│   └── auth/
│       └── callback/
│           └── route.ts    # Supabase OAuth callback
├── src/
│   ├── components/
│   │   ├── GoogleAuthButton.tsx   # Google signin button with loading state
│   │   ├── SignInForm.tsx         # Signin form layout
│   │   └── DashboardLayout.tsx    # Dashboard layout with header
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client config
│   │   └── auth.ts         # Auth utility functions
│   └── types/
│       └── database.ts     # Supabase database types
├── middleware.ts           # Protected route middleware
├── .env.local             # Environment variables (LOCAL - DO NOT COMMIT)
├── .env.example           # Example environment variables
└── tailwind.config.ts     # Tailwind config with PropDAO colors
```

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details and create
4. Wait for project to initialize
5. Go to Settings > API to get your credentials:
   - **NEXT_PUBLIC_SUPABASE_URL**: Copy from "API URL"
   - **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Copy from "anon" key

### 2. Configure Google OAuth in Supabase

1. In Supabase dashboard, go to **Authentication > Providers**
2. Click on "Google"
3. Set "Enabled" to ON
4. You'll need Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable the Google+ API
   - Create OAuth 2.0 credentials (Web application)
   - Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret into Supabase Google provider settings
5. Save changes

### 3. Create Database Tables in Supabase

Go to **SQL Editor** and run:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Challenges table
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  duration INTEGER NOT NULL,
  price DECIMAL NOT NULL,
  description TEXT NOT NULL,
  rules TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- User challenges (purchases)
CREATE TABLE user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id),
  purchase_date TIMESTAMP DEFAULT now(),
  status TEXT DEFAULT 'active',
  terminal_username TEXT,
  terminal_password_hash TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can only update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Anyone can read challenges
CREATE POLICY "Anyone can read challenges" ON challenges
  FOR SELECT USING (true);

-- Users can read their own purchases
CREATE POLICY "Users can read own challenges" ON user_challenges
  FOR SELECT USING (auth.uid() = user_id);
```

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env.local` (already created)
2. Update the values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 5. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 6. Run Development Server

```bash
npm run dev
# or
pnpm dev
```

Visit `http://localhost:3000` - you'll be redirected to `/signin`

## Features Implemented

✅ **Sign-in Page**
- Google OAuth button with clean design
- Loading state during authentication
- Error handling with toast notifications
- Olive green (#6B8E23) CTA button
- Responsive mobile + desktop design

✅ **Dashboard Page (Protected)**
- User welcome message with avatar
- Display purchased challenges (if any)
- Empty state message with CTA to browse challenges
- Sign out button
- Loading state while fetching user data
- Auto-create user on first login

✅ **Authentication**
- Supabase Auth with Google OAuth
- Session persistence (user stays logged in)
- Automatic user record creation for first-time users
- Secure callback handling

✅ **Protected Routes**
- Middleware checks auth before accessing `/dashboard`
- Unauthenticated users redirected to `/signin`
- Session validation on every request

✅ **Design**
- PropDAO color palette (olive green, beige, etc.)
- Responsive design (mobile + desktop)
- Toast notifications for success/errors
- Form validation and error messages
- Loading states on buttons

## Color Palette

- **Primary (Olive Green)**: #6B8E23
- **Secondary (Beige)**: #F5F5DC
- **Text Primary**: #2C3E1F
- **Text Secondary**: #8B8B7A
- **Borders**: #D4D4C0
- **Background**: #FAFAF7

## Authentication Flow

1. User visits app → redirected to `/signin`
2. User clicks "Sign in with Google"
3. Redirected to Google OAuth consent screen
4. After approval → redirected to `/auth/callback`
5. Session exchanged and user redirected to `/dashboard`
6. On `/dashboard`:
   - Check if user exists in `users` table
   - If not, create user record with email and avatar
   - Fetch user's purchased challenges
   - Display dashboard with user info

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGc...` |

## Testing the Application

### Sign-in Flow
1. Go to `http://localhost:3000`
2. Click "Sign in with Google"
3. Use your Google account to sign in
4. You should be redirected to `/dashboard`
5. Your email should be displayed in the header

### Dashboard
- View your user information
- See "No challenges yet" message if no challenges purchased
- Click "Sign out" to log out

### Testing Protected Routes
- Try accessing `/dashboard` without being logged in
- You should be redirected to `/signin`

## Development

### Creating New Pages
Use the same pattern for creating new pages:
```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title - PropDAO',
}

export default function Page() {
  return (
    // Your page content
  )
}
```

### Adding Components
Create new components in `src/components/` and use client component directive if needed:
```tsx
'use client'

export function MyComponent() {
  // Your component
}
```

### Database Queries
Use the Supabase client from `src/lib/supabase.ts`:
```tsx
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase
  .from('table_name')
  .select('*')
```

## Deployment to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

## Common Issues

### "NEXT_PUBLIC_SUPABASE_URL is missing"
- Check that `.env.local` has the correct values
- Restart dev server after updating `.env.local`

### Sign-in not working
- Verify Google OAuth is enabled in Supabase
- Check that redirect URI matches: `https://your-domain.com/auth/callback`
- Verify Client ID and Secret in Supabase settings

### Dashboard redirect loop
- Clear browser cookies and cache
- Check that Supabase session is being set
- Verify middleware is correctly configured

## Next Steps

### Phase 2: Challenge Marketplace
- [ ] Browse available challenges
- [ ] Purchase challenges with payment integration
- [ ] Launch challenge environment

### Phase 3: Leaderboards
- [ ] Track challenge completion times
- [ ] Display rankings
- [ ] Team leaderboards

### Phase 4: Admin Dashboard
- [ ] Manage challenges
- [ ] View user analytics
- [ ] Configure rewards

## Support

For questions or issues:
1. Check Supabase documentation: https://supabase.com/docs
2. Check Next.js documentation: https://nextjs.org/docs
3. Open an issue in the project repository
