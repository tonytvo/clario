# Getting started

## 1. Unzip and init git

```bash
unzip clario.zip
cd clario
git init
git add .
git commit -m "chore: initial scaffold"
```

## 2. Create your GitHub repo and push

```bash
gh repo create clario --public
git remote add origin https://github.com/YOUR_USERNAME/clario.git
git push -u origin main
```

## 3. Fill in environment variables

```bash
cp .env.example .env
cp packages/api/.env.example packages/api/.env
# Edit both .env files with your Supabase + Google credentials
```

## 4. Run the DB migrations

```bash
npm install
npm run db:migrate
```

## 5. Start dev

```bash
# Web app (Next.js)
npm run dev

# API server (MCP + OpenAPI)
npm run dev --workspace=packages/api
```

## 6. Deploy everything for free

```bash
npm run deploy
```

See README.md and docs/self-hosting.md for full details.
