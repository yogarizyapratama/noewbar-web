#!/usr/bin/env node
/**
 * Noewbar CS Pro - Unified Service Orchestrator
 *
 * Runs all 3 required services concurrently in a single terminal process:
 *   1. WhatsMeow WhatsApp Gateway Daemon (Go binary on port 8088)
 *   2. Noewbar Maintenance Scheduler / BullMQ Worker (TypeScript worker)
 *   3. Next.js Web Application (port 3001)
 *
 * Features:
 *   - Auto-kill stale zombie processes on ports 8088 & 3001 before starting
 *   - Color-coded prefixes for easy inspection
 *   - Graceful unified shutdown (Ctrl+C cleanly terminates all 3 child processes)
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Color codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";
const RED = "\x1b[31m";

function log(prefix: string, color: string, message: string) {
  const time = new Date().toLocaleTimeString("id-ID", { hour12: false });
  console.log(`${color}${BOLD}[${time}] ${prefix}${RESET} ${message}`);
}

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env");
  const envVars: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return envVars;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    envVars[m[1]] = value;
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
  return envVars;
}

function freePort(port: number) {
  try {
    const pids = execSync(`lsof -ti :${port}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (pids) {
      log("system", YELLOW, `Membersihkan port :${port} (menghentikan PID ${pids.replace(/\n/g, ", ")})...`);
      for (const pid of pids.split(/\s+/)) {
        try {
          process.kill(Number(pid), "SIGTERM");
        } catch {}
      }
    }
  } catch {}
}

const children: ChildProcess[] = [];

function setupStream(child: ChildProcess, prefix: string, color: string) {
  child.stdout?.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${color}${prefix}${RESET} ${line}`);
      }
    }
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${color}${prefix}${RESET} ${RED}${line}${RESET}`);
      }
    }
  });
}

async function main() {
  console.log(`\n${BOLD}${GREEN}================================================================${RESET}`);
  console.log(`${BOLD}${GREEN}   NOEWBAR CS PRO - ALL-IN-ONE UNIFIED RUNNER${RESET}`);
  console.log(`${BOLD}${GREEN}================================================================${RESET}\n`);

  loadEnv();

  // Free ports from previous runs
  freePort(8088);
  freePort(3001);

  // 1. WhatsMeow WhatsApp Daemon
  const daemonDir = path.resolve(process.cwd(), "gateway-whatsmeow");
  const daemonBin = path.join(daemonDir, "whatsmeow-daemon");

  if (!fs.existsSync(daemonBin)) {
    log("whatsmeow", RED, `Binary tidak ditemukan di ${daemonBin}! Mengompilasi...`);
    try {
      execSync("go build -o whatsmeow-daemon main.go", { cwd: daemonDir, stdio: "inherit" });
      log("whatsmeow", GREEN, "Kompilasi whatsmeow-daemon berhasil.");
    } catch {
      log("whatsmeow", RED, "Gagal mengompilasi whatsmeow-daemon. Pastikan Go terinstal.");
    }
  }

  if (fs.existsSync(daemonBin)) {
    log("whatsmeow", GREEN, "Menjalankan WhatsMeow Gateway Daemon di port :8088...");
    const daemonProc = spawn("./whatsmeow-daemon", [], {
      cwd: daemonDir,
      env: {
        ...process.env,
        PORT: "8088",
        WHATSMEOW_SECRET: process.env.WHATSMEOW_SECRET || "whatsmeow-seco-internal-key",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(daemonProc);
    setupStream(daemonProc, "[whatsmeow]", CYAN);
  }

  // Delay 1s agar daemon siap listen
  await new Promise((r) => setTimeout(r, 1000));

  // 2. Scheduler & BullMQ Worker
  log("scheduler", MAGENTA, "Menjalankan Scheduler Maintenance & Worker...");
  const schedulerProc = spawn("npx", ["tsx", "scripts/scheduler.ts"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(schedulerProc);
  setupStream(schedulerProc, "[scheduler]", MAGENTA);

  // 3. Next.js Web App
  log("web-app", BLUE, "Menjalankan Next.js Web App di http://localhost:3001...");
  const isProd = process.argv.includes("--prod");
  const nextArgs = isProd ? [".next/standalone/server.js"] : ["next", "dev", "-p", "3001"];

  const nextProc = spawn(isProd ? "node" : "npx", nextArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(nextProc);
  setupStream(nextProc, "[web-app]  ", BLUE);

  // Handle Shutdown
  let isShuttingDown = false;
  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n\n${YELLOW}${BOLD}[noewbar] Menerima ${signal}. Menghentikan seluruh layanan dengan aman...${RESET}`);

    for (const child of children) {
      try {
        child.kill("SIGTERM");
      } catch {}
    }

    setTimeout(() => {
      for (const child of children) {
        try {
          child.kill("SIGKILL");
        } catch {}
      }
      freePort(8088);
      freePort(3001);
      process.exit(0);
    }, 1500);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));
}

main().catch((err) => {
  console.error("Fatal error starting services:", err);
  process.exit(1);
});
