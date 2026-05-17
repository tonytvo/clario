# Self-hosting Clario

Clario is designed to run free forever using the free tiers of:

| Service | Free tier | Used for |
|---|---|---|
| [Supabase](https://supabase.com) | 500 MB DB, 50K users | Database + Auth |
| [Vercel](https://vercel.com) | Unlimited for hobby | Frontend hosting |
| Google Drive | 15 GB per user | Receipt files (user's own account) |

**Estimated monthly cost: $0** for groups under ~500 users.

---

## One-command deploy

```bash
npm run deploy
```

This interactive script handles everything. You'll need accounts on Supabase, Vercel, and Google Cloud (all free).

---

## Manual setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the Supabase dashboard → Settings → API → copy your URL and anon key
3. Enable Google as an auth provider:
   - Authentication → Providers → Google → Enable
   - Add your Google OAuth Client ID and Secret
4. Run migrations: `npm run db:migrate`

### 2. Google Cloud (for Drive API)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Google Drive API**
3. Create OAuth 2.0 credentials (Web application type)
4. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (for local dev)
5. Copy Client ID and Client Secret

### 3. Vercel

1. Create an account at [vercel.com](https://vercel.com)
2. The deploy script handles this — or import the repo manually in Vercel's UI
3. Add all environment variables from `.env.example` in Vercel's project settings

### 4. Environment variables

Copy `.env.example` to `.env` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## After deploy

1. Go to your Vercel URL
2. Sign in with Google
3. Create a group, invite your friends by email
4. Add expenses — receipts go to your Google Drive automatically

---

## Keeping costs at $0

- Supabase free tier pauses after 1 week of inactivity — upgrade to Pro ($25/mo) if you need always-on
- Vercel free tier has no inactivity pauses
- Google Drive quota is per user — each user's receipts count against their own 15 GB quota
- No Supabase Storage used — zero storage cost on our side
