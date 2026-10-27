# Clario 🧾

> Split expenses with friends. Your receipts stay yours. Free forever, open source, built by AI.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built with AI](https://img.shields.io/badge/Built%20with-Claude%20AI-blueviolet)](https://claude.ai)
![Local-first](https://img.shields.io/badge/Local--first-offline%20ready-2ea44f)
![Sync](https://img.shields.io/badge/Sync-CRDT%20(engine%20TBD)-orange)

---

## What is this?

Clario is a Splitwise-style expense tracker where **you own your data**. Your receipts stay yours — never locked into our servers.

- **Local-first** — your data lives on your device and works fully offline.
- No subscription. No ads. No receipt storage fees.
- One-command install for non-technical users (Windows, Mac, Linux)
- Fully open source — contribute or fork freely
- Built using [Structured Prompt Driven Development (SPDD)](https://github.com/gszhangwei/open-spdd)

---

## Quick start

### For end users (Windows / Mac / Linux)

```bash
npx clario
```

That's it. Opens the app in your browser. Your data stays on your device — no account required to start.

### For developers

```bash
git clone https://github.com/YOUR_USERNAME/clario
cd clario
npm install
npm run dev                 # runs locally, data stored on-device
```

### No server to deploy

Clario is local-first — it runs on your device with **no backend and no account**. Sharing a group across devices and people will come from CRDT-based sync; the engine and transport are deliberately undecided and sit behind a swappable persistence port.

---

## How receipts work

Receipts are yours. When you attach a receipt to an expense:

1. You pick a file from your device
2. It's attached to the expense so your group can see the proof of purchase
3. You keep ownership and control of the file — it's never locked into our servers
4. You can revoke access or remove it anytime

> The underlying storage mechanism is intentionally flexible and not yet fixed — the guarantee is that your receipts stay yours.

---

## Tech stack

| Layer | Tool | Why |
|---|---|---|
| Frontend | Next.js 14 + React | App Router, server components |
| Data & sync | Local-first store + CRDT sync (engine TBD) | Works offline, you own your data |
| Receipt storage | User-owned (mechanism TBD) | User owns their data |
| Styling | Tailwind CSS + shadcn/ui | Fast, accessible |
| Desktop wrapper | Electron (optional) | One-click install for non-devs |
| Refactoring | Knip + ESLint + Biome | AI-assisted quality |
| Dev methodology | [SPDD](https://github.com/gszhangwei/open-spdd) | Structured AI development |

---

## Contributing

This project is built with AI assistance using SPDD. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/spdd/](docs/spdd/) for how to contribute using Claude or any AI assistant.

Every feature starts as a prompt template in `docs/spdd/commands/`. AI does the scaffolding, humans review.

---

## License

MIT — use it, fork it, build on it.
