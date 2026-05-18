# Clario 🧾

> Split expenses with friends. Your receipts stay yours — stored in your own Google Drive or Dropbox. Free forever, open source, built by AI.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built with AI](https://img.shields.io/badge/Built%20with-Claude%20AI-blueviolet)](https://claude.ai)
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E)](https://supabase.com)

---

## What is this?

Clario is a Splitwise-style expense tracker where **you own your data**. Receipts are stored in your own Google Drive — not on our servers.

- No subscription. No ads. No receipt storage fees.
- One-command install for non-technical users (Windows, Mac, Linux)
- One-command deploy for self-hosters
- Fully open source — contribute or fork freely
- Built using [Structured Prompt Driven Development (SPDD)](https://github.com/gszhangwei/open-spdd)

---

## Quick start

### For end users (Windows / Mac / Linux)

```bash
npx clario
```

That's it. Opens the app in your browser, walks you through connecting your Google account.

### For developers

```bash
git clone https://github.com/YOUR_USERNAME/clario
cd clario
cp .env.example .env        # fill in your Supabase keys
npm install
npm run dev
```

### Deploy your own instance (free)

```bash
npm run deploy
```

Deploys to Vercel (frontend) + Supabase (backend) — both have generous free tiers. Runs indefinitely at $0/month for small groups.

---

## How receipts work

Your receipts never touch our server. When you attach a receipt:

1. You pick a file from your device
2. The app uploads it directly to **your** Google Drive (using your OAuth token)
3. Only the Drive link is saved in the database
4. Group members click the link — Google serves the file directly

Your data stays in your Google account. Revoke access anytime.

---

## Tech stack

| Layer | Tool | Why |
|---|---|---|
| Frontend | Next.js 14 + React | App Router, server components |
| Backend | Supabase (Postgres + Auth + Realtime) | Free tier, open source |
| Receipt storage | Google Drive API | User owns their data |
| Styling | Tailwind CSS + shadcn/ui | Fast, accessible |
| Desktop wrapper | Electron (optional) | One-click install for non-devs |
| Refactoring | Knip + ESLint + Biome | AI-assisted quality |
| Dev methodology | [SPDD](https://github.com/gszhangwei/open-spdd) | Structured AI development |

---

## Contributing

This project is built with AI assistance using SPDD. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/spdd/](docs/spdd/) for how to contribute using Claude or any AI assistant.

Every feature starts as a prompt template in `docs/spdd/commands/`. AI does the scaffolding, humans review.

---

## Self-hosting

See [docs/self-hosting.md](docs/self-hosting.md) for full instructions. The short version:

1. Create a free [Supabase](https://supabase.com) project
2. Create a free [Google Cloud](https://console.cloud.google.com) project (for Drive API)
3. Create a free [Vercel](https://vercel.com) account
4. Run `npm run deploy`

Total monthly cost: **$0** for groups under ~500 users.

---

## License

MIT — use it, fork it, build on it.
