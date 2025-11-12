#!/bin/bash

# Fix all remaining static requireAdmin calls to use dynamic imports

FILE="src/app/(admin)/admin/_actions/entitlement-admin-actions.ts"

# Fix getTeamOverridesAction
sed -i '' 's/\t\tawait requireAdmin()/\t\tconst { requireAdmin } = await import("@\/utils\/auth")\n\t\tawait requireAdmin()/g' "$FILE"

# Fix removeEntitlementOverrideAction - add both requireAdmin and invalidateTeamMembersSessions
sed -i '' 's/\t\tconst admin = (await requireAdmin())!/\t\tconst { requireAdmin } = await import("@\/utils\/auth")\n\t\tconst { invalidateTeamMembersSessions } = await import("@\/utils\/kv-session")\n\n\t\tconst admin = (await requireAdmin())!/g' "$FILE"

# Fix getAllPlansAction, getAllFeaturesAction, getAllLimitsAction - standalone requireAdmin calls
# This is already handled by the first sed command

echo "Fixed all static requireAdmin calls"
