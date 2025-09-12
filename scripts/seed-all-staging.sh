#!/bin/bash
# Seed script for staging that runs all SQL files in order
set -e

DB_NAME="wodsmith-db-staging"

echo "Seeding staging database: $DB_NAME"

# Run base seed file
echo "Running base seed..."
wrangler d1 execute "$DB_NAME" --remote --file ./scripts/seed.sql

# Run CrossFit Heroes seed (Part 1) 
echo "Running CrossFit Heroes seed (Part 1)..."
wrangler d1 execute "$DB_NAME" --remote --file ./scripts/seed-crossfit-heroes.sql

echo "Staging database seeding completed successfully!"