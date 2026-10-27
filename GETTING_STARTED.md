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
cp packages/api/.env.example packages/api/.env
# Set CLARIO_USER_ID (your local identity) and optionally LEDGER_FILE
```

## 4. Start dev

```bash
npm install

# Web app (Next.js)
npm run dev

# API server (MCP + OpenAPI)
npm run dev --workspace=packages/api
```

Clario is local-first: there is no database to provision and nothing to deploy.
See README.md for details.
