# PropDAO Authentication & Dashboard

A modern authentication system for PropDAO built with Next.js 15, TypeScript, Supabase, and Tailwind CSS.

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- Supabase account (free tier available)
- Google OAuth credentials (for sign-in)

### 2. Get Credentials
1. Create a Supabase project at [supabase.com](https://app.supabase.com)
2. Get your **NEXT_PUBLIC_SUPABASE_URL** and **NEXT_PUBLIC_SUPABASE_ANON_KEY** from Settings > API

### 3. Configure Environment
Update `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Install & Run
```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute setup guide
- **[SETUP.md](./SETUP.md)** - Complete setup with database schema
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Features & architecture overview

## ✨ Features

✅ Google OAuth sign-in  
✅ Protected dashboard routes  
✅ Auto-create user accounts  
✅ Session persistence  
✅ Responsive design (mobile + desktop)  
✅ Toast notifications  
✅ TypeScript strict mode  
✅ Database integration ready  

## 🎨 Design

- **Primary Color**: Olive Green (#6B8E23)
- **Secondary Color**: Beige (#F5F5DC)
- **Modern, Clean UI** with PropDAO branding

## 📁 Key Files

```
src/
├── components/     # React components
├── lib/           # Utility functions
└── types/         # TypeScript types
app/
├── signin/        # Sign-in page
├── dashboard/     # Protected dashboard
└── auth/callback/ # OAuth callback
```

## 🔐 Authentication Flow

1. User visits app → redirected to sign-in
2. Click "Sign in with Google"
3. Approve Google OAuth
4. Auto-create account if first-time user
5. Redirected to protected dashboard
6. Session persists across page refreshes

## 📦 Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Auth**: Supabase Auth (Google OAuth)
- **Database**: Supabase PostgreSQL
- **Styling**: Tailwind CSS v4
- **Notifications**: Sonner

## 🚀 Deployment

### Deploy to Vercel

1. Push to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

```bash
npm run build
npm run start
```

## 📋 Checklist

Before going live:
- [ ] Set up Supabase project
- [ ] Configure Google OAuth
- [ ] Create database tables (see SETUP.md)
- [ ] Add environment variables
- [ ] Test sign-in flow
- [ ] Test dashboard access
- [ ] Deploy to Vercel

## 🛠️ Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Project Structure

```
propdao-auth/
├── app/                    # Next.js app directory
│   ├── auth/callback/      # OAuth callback handler
│   ├── signin/             # Sign-in page
│   ├── dashboard/          # Protected dashboard
│   └── layout.tsx          # Root layout
├── src/
│   ├── components/         # React components
│   ├── lib/                # Utility functions
│   └── types/              # TypeScript types
├── middleware.ts           # Route protection
├── tailwind.config.ts      # Tailwind configuration
└── .env.local             # Environment variables
```

## 🔒 Security

- ✅ Protected routes with middleware
- ✅ Session validation on every request
- ✅ TypeScript strict mode
- ✅ Supabase Row Level Security (RLS)
- ✅ No sensitive data in client code

## 🐛 Troubleshooting

**Issue**: "NEXT_PUBLIC_SUPABASE_URL is missing"
- **Solution**: Update `.env.local` and restart dev server

**Issue**: Sign-in button does nothing
- **Solution**: Check Google OAuth is enabled in Supabase Settings > Providers

**Issue**: Redirected to signin after signing in
- **Solution**: Verify OAuth redirect URI matches your domain in Supabase

See [SETUP.md](./SETUP.md) for more troubleshooting.

## 📚 Next Steps

- **Phase 2**: Challenge marketplace (browse, purchase, launch)
- **Phase 3**: Leaderboards and rankings
- **Phase 4**: Team collaboration

## 📝 Notes

- This is a **Next.js 15** project using the App Router
- Database schema must be created manually in Supabase (see SETUP.md)
- Google OAuth requires additional configuration (see SETUP.md)

## 🤝 Support

For help:
1. Check [SETUP.md](./SETUP.md) troubleshooting section
2. Review [Supabase docs](https://supabase.com/docs)
3. Check [Next.js docs](https://nextjs.org/docs)

---

**Status**: ✅ Ready for configuration and testing

**Last Updated**: June 15, 2026
