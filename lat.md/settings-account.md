# Account Settings

Settings restore device preferences, expose entitled navigation, and display team actions according to the server's current permissions.

## Appearance Preference

Appearance and navigation theme selectors share the `theme` local-storage key and SSR cookie. Reloading any route restores the selected light or dark preference.

[[apps/wodsmith-start/src/lib/theme.ts#getTheme]] resolves browser preferences and [[apps/wodsmith-start/src/lib/theme.ts#saveTheme]] saves the cookie, local storage, and root class together. The root pre-paint script follows this contract; both navigation toggles use the same helpers. See [[architecture#Architecture#Tech Stack#SSR Theme Hydration]].

## Programming Navigation

The Settings layout passes its inherited workout-tracking entitlement to the sidebar so Programming is discoverable for entitled users.

Navigation visibility does not replace the destination route's entitlement checks.

## Team Actions and Invitation Recovery

Team details expose separate invite, role-change, and member-removal capabilities derived by the same server permission helper used to authorize mutations.

[[apps/wodsmith-start/src/server-fns/team-settings-fns.ts#getTeamBySlugFn]] returns these capabilities after its dashboard access check. Custom roles and the site-admin bypass are preserved. Personal teams hide all member-management actions; owner rows retain their protections on desktop and mobile.

Invitation reads only run when inviting is allowed. Failed reads show a retryable alert while leaving team details available; successful empty results remain distinct. Retrying invalidates route data and recalculates capabilities. Mutation endpoints still enforce their existing authorization checks.

## Team Naming and Accessible Controls

Team names are display labels and may be shared. Generated slugs provide unique team URLs; create-form guidance describes this distinction.

Back links have a “Back to teams” accessible name. Pending-invitation cancellation identifies the invited email, and the desktop remove action has an explicit name.

## Regression Coverage

[[settings-account-tests#Settings Account Tests]] verifies reload persistence, route entitlement wiring, granular action visibility, invitation recovery, server authorization, copy, and control names.
