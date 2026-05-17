#!/usr/bin/env node
/**
 * Clario one-command deploy
 * Usage: npm run deploy
 *
 * What it does:
 *   1. Checks prerequisites (Vercel CLI, Supabase CLI)
 *   2. Guides you through env var setup if first run
 *   3. Pushes DB migrations to Supabase
 *   4. Deploys frontend to Vercel
 *
 * Both Vercel and Supabase have free tiers.
 * This setup costs $0/month for small groups.
 */

import { execSync, spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

function run(cmd, opts = {}) {
  console.log(`\n→ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function checkCLI(name, installCmd) {
  try {
    execSync(`${name} --version`, { stdio: "pipe" });
    console.log(`✓ ${name} found`);
  } catch {
    console.log(`✗ ${name} not found. Installing...`);
    execSync(installCmd, { stdio: "inherit" });
  }
}

async function main() {
  console.log("\n🧾 Clario deploy\n");
  console.log("This will deploy your Clario instance for free using:");
  console.log("  • Supabase  (database + auth)");
  console.log("  • Vercel    (frontend hosting)\n");

  // ── Prerequisites ──────────────────────────────────────────
  console.log("Checking prerequisites...");
  checkCLI("supabase", "npm install -g supabase");
  checkCLI("vercel", "npm install -g vercel");

  // ── Env check ─────────────────────────────────────────────
  if (!existsSync(".env")) {
    console.log("\n⚠️  No .env file found. Let's set it up.");
    console.log("\nYou'll need:");
    console.log("  1. A free Supabase project → https://supabase.com");
    console.log("  2. A free Google Cloud project → https://console.cloud.google.com");
    console.log("     (Enable Drive API + create OAuth credentials)");
    console.log("  3. A free Vercel account → https://vercel.com\n");

    const supabaseUrl = await ask("Supabase project URL: ");
    const supabaseAnon = await ask("Supabase anon key: ");
    const supabaseService = await ask("Supabase service role key: ");
    const googleClientId = await ask("Google client ID: ");
    const googleClientSecret = await ask("Google client secret: ");

    const envContent = `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnon}
SUPABASE_SERVICE_ROLE_KEY=${supabaseService}
NEXT_PUBLIC_GOOGLE_CLIENT_ID=${googleClientId}
GOOGLE_CLIENT_SECRET=${googleClientSecret}
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
`;
    require("fs").writeFileSync(".env", envContent);
    console.log("✓ .env created");
  }

  // ── DB migrations ─────────────────────────────────────────
  console.log("\n📦 Pushing database migrations...");
  run("supabase db push");
  console.log("✓ Database schema ready");

  // ── Vercel deploy ─────────────────────────────────────────
  console.log("\n🚀 Deploying to Vercel...");
  run("vercel --prod", { cwd: "apps/web" });

  console.log("\n✅ Clario deployed!\n");
  console.log("Next steps:");
  console.log("  • Set NEXT_PUBLIC_APP_URL to your Vercel URL in Supabase Auth settings");
  console.log("  • Add your Vercel URL to Google OAuth allowed redirect URIs");
  console.log("  • Share the URL with your group\n");

  rl.close();
}

main().catch((err) => {
  console.error("\n❌ Deploy failed:", err.message);
  process.exit(1);
});
