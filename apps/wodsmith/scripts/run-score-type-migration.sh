#!/bin/bash

# Score Type Migration Script
# This script populates scoreType for existing workouts based on their scheme
# Usage: ./scripts/run-score-type-migration.sh [--local|--staging|--remote]

set -e  # Exit on error

# Default to local
ENV="local"
DB_NAME=""

# Parse arguments
if [ "$1" == "--remote" ]; then
    ENV="remote"
    DB_NAME=$(node scripts/get-db-name.mjs)
    echo "🌍 Running migration on PRODUCTION database"
elif [ "$1" == "--staging" ]; then
    ENV="staging"
    DB_NAME="wodsmith-db-staging"
    echo "🧪 Running migration on STAGING database"
elif [ "$1" == "--local" ]; then
    ENV="local"
    DB_NAME=$(node scripts/get-db-name.mjs)
    echo "🏠 Running migration on LOCAL database"
else
    echo "🏠 Running migration on LOCAL database (default)"
    DB_NAME=$(node scripts/get-db-name.mjs)
fi

echo "📊 Using database: $DB_NAME"
echo "🚀 Starting scoreType migration..."

# Function to execute SQL command
execute_sql() {
    local sql="$1"
    local description="$2"

    if [ "$ENV" == "remote" ] || [ "$ENV" == "staging" ]; then
        npx wrangler d1 execute "$DB_NAME" --remote --command="$sql"
    else
        npx wrangler d1 execute "$DB_NAME" --local --command="$sql"
    fi

    if [ $? -eq 0 ]; then
        echo "✅ $description"
    else
        echo "❌ Failed: $description"
        return 1
    fi
}

NOW=$(date -u +"%Y-%m-%d %H:%M:%S")

echo ""
echo "Migrating workouts by scheme..."

# time → min
execute_sql "UPDATE workouts
SET score_type = 'min',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'time' AND score_type IS NULL" "Migrated 'time' workouts → min"

# time-with-cap → min
execute_sql "UPDATE workouts
SET score_type = 'min',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'time-with-cap' AND score_type IS NULL" "Migrated 'time-with-cap' workouts → min"

# pass-fail → sum
execute_sql "UPDATE workouts
SET score_type = 'sum',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'pass-fail' AND score_type IS NULL" "Migrated 'pass-fail' workouts → sum"

# rounds-reps → max
execute_sql "UPDATE workouts
SET score_type = 'max',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'rounds-reps' AND score_type IS NULL" "Migrated 'rounds-reps' workouts → max"

# reps → max
execute_sql "UPDATE workouts
SET score_type = 'max',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'reps' AND score_type IS NULL" "Migrated 'reps' workouts → max"

# emom → min
execute_sql "UPDATE workouts
SET score_type = 'min',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'emom' AND score_type IS NULL" "Migrated 'emom' workouts → min"

# load → max
execute_sql "UPDATE workouts
SET score_type = 'max',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'load' AND score_type IS NULL" "Migrated 'load' workouts → max"

# calories → max
execute_sql "UPDATE workouts
SET score_type = 'max',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'calories' AND score_type IS NULL" "Migrated 'calories' workouts → max"

# meters → max
execute_sql "UPDATE workouts
SET score_type = 'max',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'meters' AND score_type IS NULL" "Migrated 'meters' workouts → max"

# feet → max
execute_sql "UPDATE workouts
SET score_type = 'max',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'feet' AND score_type IS NULL" "Migrated 'feet' workouts → max"

# points → max
execute_sql "UPDATE workouts
SET score_type = 'max',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE scheme = 'points' AND score_type IS NULL" "Migrated 'points' workouts → max"

echo ""
echo "Verifying migration..."

# Check for any remaining NULL scoreTypes
if [ "$ENV" == "remote" ] || [ "$ENV" == "staging" ]; then
    npx wrangler d1 execute "$DB_NAME" --remote --command="SELECT COUNT(*) as remaining_null FROM workouts WHERE score_type IS NULL"
else
    npx wrangler d1 execute "$DB_NAME" --local --command="SELECT COUNT(*) as remaining_null FROM workouts WHERE score_type IS NULL"
fi

echo ""
echo "✅ Score type migration completed successfully!"

if [ "$ENV" == "remote" ]; then
    echo ""
    echo "⚠️  IMPORTANT: You've just migrated the PRODUCTION database!"
    echo "Please verify your application is working correctly."
elif [ "$ENV" == "staging" ]; then
    echo ""
    echo "🧪 STAGING migration complete. Please test your application on staging before proceeding to production."
fi
