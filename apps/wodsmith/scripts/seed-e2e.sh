#!/bin/bash
# E2E Test Database Seed Script
# Shorthand for running the TypeScript setup script
set -e

echo "🧪 Running E2E database setup..."

# Run the TypeScript setup script
pnpm tsx scripts/setup-e2e-db.ts

echo "✅ E2E database ready for testing!"
