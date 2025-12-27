#!/bin/bash
# Seed script that runs all SQL files in order
set -e

echo "=========================================="
echo "Starting database seed process..."
echo "=========================================="

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
echo ""

# Run base seed file
echo "[2/2] Running base seed (seed.sql)..."
if wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed.sql; then
    echo "Base seed completed"
else
    echo "Base seed failed" >&2
    exit 1
fi
echo ""

echo "=========================================="
echo "Database seeding completed successfully!"
echo "=========================================="
