#!/usr/bin/env node
/**
 * Clario launcher
 * This is what runs when someone does: npx clario
 *
 * Works on Windows, Mac, Linux.
 * No technical knowledge required.
 *
 * What it does:
 *   1. Checks for Node.js (prompts to install if missing)
 *   2. Downloads the latest Clario web app
 *   3. Installs dependencies quietly
 *   4. Starts the server
 *   5. Opens the browser automatically
 */

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import { createServer } from "http";

const APP_DIR = join(homedir(), ".clario");
const REPO_URL = "https://github.com/YOUR_USERNAME/clario";
const PORT = 3421;

function open(url) {
  const cmd = platform() === "win32" ? "start" :
               platform() === "darwin" ? "open" : "xdg-open";
  try { execSync(`${cmd} ${url}`); } catch {}
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const s = createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => { s.close(); resolve(true); });
    s.listen(port);
  });
}

async function main() {
  console.log("\n🧾 Clario\n");

  // ── First run: clone the repo ──────────────────────────────
  if (!existsSync(APP_DIR)) {
    console.log("First run! Downloading Clario...");
    mkdirSync(APP_DIR, { recursive: true });
    execSync(`git clone ${REPO_URL} ${APP_DIR}`, { stdio: "inherit" });
    console.log("Installing dependencies (this takes ~30 seconds)...");
    execSync("npm install --silent", { cwd: APP_DIR, stdio: "inherit" });
  } else {
    // Subsequent runs: pull latest
    console.log("Checking for updates...");
    try {
      execSync("git pull --ff-only", { cwd: APP_DIR, stdio: "pipe" });
    } catch {
      // Offline or no updates — continue with local version
    }
  }

  // ── Start the app ──────────────────────────────────────────
  const portFree = await isPortFree(PORT);
  if (!portFree) {
    console.log(`Clario is already running → http://localhost:${PORT}`);
    open(`http://localhost:${PORT}`);
    return;
  }

  console.log("Starting Clario...");
  const proc = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: join(APP_DIR, "apps/web"),
    stdio: "pipe",
    env: { ...process.env },
  });

  // Wait for Next.js to be ready
  proc.stdout.on("data", (data) => {
    const text = data.toString();
    if (text.includes("Ready") || text.includes("started server")) {
      const url = `http://localhost:${PORT}`;
      console.log(`\n✅ Clario is running at ${url}\n`);
      console.log("Opening in your browser...");
      open(url);
    }
  });

  proc.stderr.on("data", (data) => {
    const text = data.toString();
    if (!text.includes("ExperimentalWarning")) {
      process.stderr.write(data);
    }
  });

  // Keep running until user presses Ctrl+C
  console.log("\nPress Ctrl+C to stop.\n");
  process.on("SIGINT", () => {
    proc.kill();
    console.log("\nClario stopped. See you next time!");
    process.exit(0);
  });

  proc.on("exit", (code) => {
    if (code !== 0) {
      console.error("Clario exited unexpectedly. Try running again.");
    }
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("\nFailed to start Clario:", err.message);
  console.error("Try: npx clario@latest");
  process.exit(1);
});
