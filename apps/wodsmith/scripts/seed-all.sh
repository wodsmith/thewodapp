#!/bin/bash
# Seed script that runs all SQL files in order
set -e

echo "=========================================="
echo "Starting database seed process..."
echo "=========================================="

# Get the database name
echo "[1/3] Getting database name..."
DB_NAME=$(node scripts/get-db-name.mjs)

# Trim whitespace and validate DB_NAME is non-empty
DB_NAME=$(echo "$DB_NAME" | xargs)
if [[ -z "$DB_NAME" ]]; then
    echo "❌ Error: DB_NAME is empty. Unable to determine database name from scripts/get-db-name.mjs" >&2
    exit 1
fi

echo "✓ Database name: $DB_NAME"
echo ""

# Run base seed file
echo "[2/3] Running base seed (seed.sql)..."
if wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed.sql; then
    echo "✓ Base seed completed"
else
    echo "❌ Base seed failed" >&2
    exit 1
fi
echo ""

# Run CrossFit Heroes seed (Part 1)
echo "[3/3] Running CrossFit Heroes seed (seed-crossfit-heroes.sql)..."
if wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed-crossfit-heroes.sql; then
    echo "✓ CrossFit Heroes seed completed"
else
    echo "❌ CrossFit Heroes seed failed" >&2
    exit 1
fi
echo ""

# # Run CrossFit Heroes seed (Part 2)
# echo "Running CrossFit Heroes seed (Part 2)..."
# wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed-crossfit-heroes-2.sql

# # Run CrossFit Heroes seed (Generated)
# echo "Running CrossFit Heroes seed (Generated)..."
# wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed-crossfit-heroes-generated.sql

# NOTE: Entitlements (features, limits, plans) are seeded in seed.sql now

echo "=========================================="
echo "✓ Database seeding completed successfully!"
echo "=========================================="