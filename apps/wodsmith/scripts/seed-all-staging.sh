#!/bin/bash
# Seed script for staging that runs all SQL files in order
set -euo pipefail

DB_NAME="wodsmith-db-staging"

# Validate prerequisites
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler is not installed or not on PATH" >&2
    exit 1
fi

# Validate required SQL files exist
if [[ ! -f "./scripts/seed.sql" ]]; then
    echo "Error: Required seed file ./scripts/seed.sql not found" >&2
    exit 1
fi

if [[ ! -f "./scripts/seed-crossfit-heroes.sql" ]]; then
    echo "Error: Required seed file ./scripts/seed-crossfit-heroes.sql not found" >&2
    exit 1
fi

# Validate DB_NAME is non-empty
if [[ -z "${DB_NAME// }" ]]; then
    echo "Error: DB_NAME is empty or contains only whitespace" >&2
    exit 1
fi

# Interactive confirmation
echo "WARNING: This will completely wipe and reseed the staging database: $DB_NAME"
echo "This action is destructive and cannot be undone."
echo -n "To proceed, type the exact database name '$DB_NAME': "
read -r user_input

if [[ "$user_input" != "$DB_NAME" ]]; then
    echo "Error: Database name confirmation failed. Seeding aborted." >&2
    exit 1
fi

echo "Seeding staging database: $DB_NAME"

# Run base seed file
echo "Running base seed..."
wrangler d1 execute "$DB_NAME" --remote --file ./scripts/seed.sql

# Run CrossFit Heroes seed (Part 1) 
echo "Running CrossFit Heroes seed (Part 1)..."
wrangler d1 execute "$DB_NAME" --remote --file ./scripts/seed-crossfit-heroes.sql

echo "Staging database seeding completed successfully!"