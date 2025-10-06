#!/bin/bash

# Scaling Migration Script
# This script sets up the global default scaling groups and migrates existing data
# Usage: ./scripts/run-scaling-migration.sh [--local|--staging|--remote]

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
echo "🚀 Starting scaling migration..."

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

# Function to check if a record exists
check_exists() {
    local sql="$1"
    local result

    if [ "$ENV" == "remote" ] || [ "$ENV" == "staging" ]; then
        result=$(npx wrangler d1 execute "$DB_NAME" --remote --command="$sql" 2>&1)
    else
        result=$(npx wrangler d1 execute "$DB_NAME" --local --command="$sql" 2>&1)
    fi

    # Check if the query returned any rows
    # First check for empty results array
    if echo "$result" | grep -q '"results": \[\]' ; then
        return 1  # No results
    # Then check if there's any "id" field in results (indicates data exists)
    elif echo "$result" | grep -q '"id":' ; then
        return 0  # Has results
    else
        return 1  # No results or error
    fi
}

# Constants
GLOBAL_DEFAULT_SCALING_GROUP_ID="sgrp_global_default"
NOW=$(date -u +"%Y-%m-%d %H:%M:%S")

echo ""
echo "Step 1: Creating global default scaling group..."

# Check if global default scaling group already exists
if check_exists "SELECT id FROM scaling_groups WHERE id = '${GLOBAL_DEFAULT_SCALING_GROUP_ID}' LIMIT 1"; then
    echo "⚠️  Global default scaling group already exists, skipping..."
else
    # Insert global default scaling group
    execute_sql "INSERT INTO scaling_groups (
        id, title, description, teamId, isDefault, isSystem, createdAt, updatedAt, updateCounter
    ) VALUES (
        '${GLOBAL_DEFAULT_SCALING_GROUP_ID}',
        'Standard Scaling',
        'Default Rx+, Rx, and Scaled levels for backward compatibility',
        NULL,
        1,
        1,
        '${NOW}',
        '${NOW}',
        0
    )" "Created global default scaling group"

    # Insert scaling levels
    execute_sql "INSERT INTO scaling_levels (
        id, scalingGroupId, label, position, createdAt, updatedAt, updateCounter
    ) VALUES
        ('slvl_global_rxplus', '${GLOBAL_DEFAULT_SCALING_GROUP_ID}', 'Rx+', 0, '${NOW}', '${NOW}', 0),
        ('slvl_global_rx', '${GLOBAL_DEFAULT_SCALING_GROUP_ID}', 'Rx', 1, '${NOW}', '${NOW}', 0),
        ('slvl_global_scaled', '${GLOBAL_DEFAULT_SCALING_GROUP_ID}', 'Scaled', 2, '${NOW}', '${NOW}', 0)
    " "Created scaling levels (Rx+, Rx, Scaled)"
fi

echo ""
echo "Step 2: Setting default scaling group for teams..."

# Update teams without a default scaling group
execute_sql "UPDATE team
SET defaultScalingGroupId = '${GLOBAL_DEFAULT_SCALING_GROUP_ID}',
    updatedAt = '${NOW}',
    updateCounter = updateCounter + 1
WHERE defaultScalingGroupId IS NULL" "Updated teams with default scaling group"

echo ""
echo "Step 3: Migrating existing results..."

# Check if scale column exists in results table
if [ "$ENV" == "remote" ] || [ "$ENV" == "staging" ]; then
    columns=$(npx wrangler d1 execute "$DB_NAME" --remote --command="PRAGMA table_info(results)" --json 2>/dev/null)
else
    columns=$(npx wrangler d1 execute "$DB_NAME" --local --command="PRAGMA table_info(results)" --json 2>/dev/null)
fi

if echo "$columns" | grep -q '"name":"scale"'; then
    echo "Found legacy 'scale' column, migrating results..."

    # Migrate Rx+ results (from scale column OR legacy scalingLevelId)
    execute_sql "UPDATE results
    SET scaling_level_id = 'slvl_global_rxplus',
        as_rx = 1,
        updatedAt = '${NOW}',
        updateCounter = updateCounter + 1
    WHERE (scale = 'rx+' OR scaling_level_id = 'rx+')
      AND (scaling_level_id IS NULL OR scaling_level_id IN ('rx+', 'rx', 'scaled'))
      AND scaling_level_id != 'slvl_global_rxplus'" "Migrated Rx+ results"

    # Migrate Rx results (from scale column OR legacy scalingLevelId)
    execute_sql "UPDATE results
    SET scaling_level_id = 'slvl_global_rx',
        as_rx = 1,
        updatedAt = '${NOW}',
        updateCounter = updateCounter + 1
    WHERE (scale = 'rx' OR scaling_level_id = 'rx')
      AND (scaling_level_id IS NULL OR scaling_level_id IN ('rx+', 'rx', 'scaled'))
      AND scaling_level_id != 'slvl_global_rx'" "Migrated Rx results"

    # Migrate Scaled results (from scale column OR legacy scalingLevelId)
    execute_sql "UPDATE results
    SET scaling_level_id = 'slvl_global_scaled',
        as_rx = 0,
        updatedAt = '${NOW}',
        updateCounter = updateCounter + 1
    WHERE (scale = 'scaled' OR scaling_level_id = 'scaled')
      AND (scaling_level_id IS NULL OR scaling_level_id IN ('rx+', 'rx', 'scaled'))
      AND scaling_level_id != 'slvl_global_scaled'" "Migrated Scaled results"
else
    echo "⚠️  No legacy 'scale' column found, skipping result migration"
fi

echo ""
echo "Step 4: Verifying migration..."

# Verification queries
echo "Checking scaling groups..."
if [ "$ENV" == "remote" ] || [ "$ENV" == "staging" ]; then
    npx wrangler d1 execute "$DB_NAME" --remote --command="SELECT id, title, isSystem FROM scaling_groups WHERE id = '${GLOBAL_DEFAULT_SCALING_GROUP_ID}'"
else
    npx wrangler d1 execute "$DB_NAME" --local --command="SELECT id, title, isSystem FROM scaling_groups WHERE id = '${GLOBAL_DEFAULT_SCALING_GROUP_ID}'"
fi

echo ""
echo "Checking scaling levels..."
if [ "$ENV" == "remote" ] || [ "$ENV" == "staging" ]; then
    npx wrangler d1 execute "$DB_NAME" --remote --command="SELECT id, label, position FROM scaling_levels WHERE scalingGroupId = '${GLOBAL_DEFAULT_SCALING_GROUP_ID}' ORDER BY position"
else
    npx wrangler d1 execute "$DB_NAME" --local --command="SELECT id, label, position FROM scaling_levels WHERE scalingGroupId = '${GLOBAL_DEFAULT_SCALING_GROUP_ID}' ORDER BY position"
fi

echo ""
echo "Checking teams with default scaling..."
if [ "$ENV" == "remote" ] || [ "$ENV" == "staging" ]; then
    npx wrangler d1 execute "$DB_NAME" --remote --command="SELECT COUNT(*) as count FROM team WHERE defaultScalingGroupId = '${GLOBAL_DEFAULT_SCALING_GROUP_ID}'"
else
    npx wrangler d1 execute "$DB_NAME" --local --command="SELECT COUNT(*) as count FROM team WHERE defaultScalingGroupId = '${GLOBAL_DEFAULT_SCALING_GROUP_ID}'"
fi

# Check for unmigrated results if scale column exists
if echo "$columns" | grep -q '"name":"scale"'; then
    echo ""
    echo "Checking for unmigrated results..."
    if [ "$ENV" == "remote" ] || [ "$ENV" == "staging" ]; then
        npx wrangler d1 execute "$DB_NAME" --remote --command="SELECT COUNT(*) as count FROM results WHERE scale IS NOT NULL AND scaling_level_id IS NULL"
    else
        npx wrangler d1 execute "$DB_NAME" --local --command="SELECT COUNT(*) as count FROM results WHERE scale IS NOT NULL AND scaling_level_id IS NULL"
    fi
fi

echo ""
echo "✅ Scaling migration completed successfully!"

if [ "$ENV" == "remote" ]; then
    echo ""
    echo "⚠️  IMPORTANT: You've just migrated the PRODUCTION database!"
    echo "Please verify your application is working correctly."
elif [ "$ENV" == "staging" ]; then
    echo ""
    echo "🧪 STAGING migration complete. Please test your application on staging before proceeding to production."
fi