# Entitlements Admin UI

Site admin interface for managing team plans and entitlement overrides.

## Features

- View all teams with their current plans
- Change any team's plan (Free → Pro → Enterprise)
- Add/remove manual entitlement overrides for specific teams
- Automatic session cache invalidation when plans or overrides change

## Access

Navigate to `/admin/entitlements` from the admin dashboard.

## Remaining Setup

To complete this UI, install missing shadcn/ui components:

```bash
cd apps/wodsmith
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add radio-group
```

These commands will:
1. Add the `toast` component with `useToast` hook
2. Add the `radio-group` component for plan selection

Once installed, the admin UI will be fully functional.

## Files

- `page.tsx` - Main entitlements management page
- `_components/entitlements-management-client.tsx` - Client component with teams table
- `_components/change-plan-dialog.tsx` - Dialog for changing team plans
- `_components/entitlement-overrides-dialog.tsx` - Dialog for managing overrides
- `_actions/entitlement-admin-actions.ts` - Server actions for plan management

## Usage

### Change Team Plan
1. Click "Change Plan" next to any team
2. Select new plan (Free/Pro/Enterprise)
3. Optionally add reason for change
4. Submit - all team members' sessions are invalidated automatically

### Add Override
1. Click "Overrides" next to any team
2. Click "Add Override"
3. Select type (Feature or Limit)
4. Select key from dropdown
5. Set value and provide reason
6. Submit - team members' sessions are invalidated automatically

## Session Invalidation

When plans or overrides change:
- `updateTeamPlanAction` → calls `invalidateTeamMembersSessions()`
- `addEntitlementOverrideAction` → calls `invalidateTeamMembersSessions()`
- `removeEntitlementOverrideAction` → calls `invalidateTeamMembersSessions()`

This ensures all team members get updated entitlements on their next request.
