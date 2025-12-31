#!/bin/bash
# Seed script that runs all SQL files in order
# Uses Alchemy's generated wrangler config at .alchemy/local/wrangler.jsonc
set -e

WRANGLER_CONFIG=".alchemy/local/wrangler.jsonc"

echo "=========================================="
echo "Starting database seed process..."
echo "=========================================="

# Check if Alchemy local config exists
if [[ ! -f "$WRANGLER_CONFIG" ]]; then
    echo "Error: Alchemy local config not found at $WRANGLER_CONFIG" >&2
    echo "Run 'pnpm db:setup-local' first to create the local environment" >&2
    exit 1
fi

# Get the database name
echo "[1/2] Getting database name..."
DB_NAME=$(node scripts/get-db-name.mjs)

# Trim whitespace and validate DB_NAME is non-empty
DB_NAME=$(echo "$DB_NAME" | xargs)
if [[ -z "$DB_NAME" ]]; then
    echo "Error: DB_NAME is empty. Unable to determine database name from scripts/get-db-name.mjs" >&2
    exit 1
fi

echo "Database name: $DB_NAME"
echo "Config: $WRANGLER_CONFIG"
echo ""

# Run base seed file
echo "[2/2] Running base seed (seed.sql)..."
if wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed.sql -c "$WRANGLER_CONFIG"; then
    echo "Base seed completed"
else
    echo "Base seed failed" >&2
    exit 1
fi
echo ""

echo "=========================================="
echo "Database seeding completed successfully!"
echo "=========================================="
