#!/bin/bash
# Seed script that runs all SQL files in order
set -e

# Get the database name
DB_NAME=$(node scripts/get-db-name.mjs)

# Trim whitespace and validate DB_NAME is non-empty
DB_NAME=$(echo "$DB_NAME" | xargs)
if [[ -z "$DB_NAME" ]]; then
    echo "Error: DB_NAME is empty. Unable to determine database name from scripts/get-db-name.mjs" >&2
    exit 1
fi

echo "Seeding database: $DB_NAME"

# Run base seed file
echo "Running base seed..."
wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed.sql

# Run CrossFit Heroes seed (Part 1)
echo "Running CrossFit Heroes seed (Part 1)..."
wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed-crossfit-heroes.sql

# # Run CrossFit Heroes seed (Part 2)
# echo "Running CrossFit Heroes seed (Part 2)..."
# wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed-crossfit-heroes-2.sql

# # Run CrossFit Heroes seed (Generated)
# echo "Running CrossFit Heroes seed (Generated)..."
# wrangler d1 execute "$DB_NAME" --local --file ./scripts/seed-crossfit-heroes-generated.sql

# Run entitlements seed (features, limits, plans)
echo "Running entitlements seed..."
pnpm tsx scripts/seed-entitlements.ts

echo "Database seeding completed successfully!"