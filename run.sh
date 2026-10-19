#!/usr/bin/env bash
# Noewbar CS Pro - Unified Runner
# Menjalankan Next.js, WhatsMeow WhatsApp Daemon, dan Scheduler secara bersamaan.

set -e
cd "$(dirname "$0")"

echo "🚀 Menjalankan seluruh layanan Noewbar CS Pro..."
npx tsx scripts/run-all.ts "$@"
