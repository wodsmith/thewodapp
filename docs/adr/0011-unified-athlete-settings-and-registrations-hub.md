---
status: proposed
date: 2026-04-16
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0011: Unified Athlete Settings and Registrations Hub in Compete

## Context and Problem Statement

Compete athletes currently have to context-switch between two different "settings" surfaces to manage themselves, and neither of them is complete from an athlete's perspective:

1. **`/_protected/settings/*`** — the original app-level settings (built for workout programming / team owners). It's the *only* place where an athlete can:
   - Edit their account name and avatar (`/settings/profile`)
   - Manage passkeys (`/settings/security`)
   - See and revoke active sessions (`/settings/sessions`)
   - Manage teams they belong to (`/settings/teams`)
   - Trigger a password change (links out to `/forgot-password`)
   - Sign out
   It lives under a `SettingsSidebar` that also shows "Programming" — a concept that doesn't apply to athletes.
2. **`/compete/athlete/*`** — the compete-product athlete hub. It has:
   - `/compete/athlete/` — read-only profile view (stats, competitive history card, benchmarks, sponsors, social)
   - `/compete/athlete/edit` — athlete-competition fields (`gender`, `dateOfBirth`, `affiliateName`, height/weight, benchmarks, social URLs, cover image)
   - `/compete/athlete/invoices` — past purchases
   - `/compete/athlete/sponsors` — sponsor CRUD
   There is no account settings, no security, no sessions, no sign-out entry point, and no first-class "my competitions / my registrations" page. The compete header just links the user icon to `/compete/athlete`.

The consequence is a split experience. Athletes who only ever live in `/compete/*` don't know that `/settings/*` exists, and the compete edit page only touches athlete-profile fields (JSON blob + a few direct columns) — it cannot change `firstName`, `lastName`, `email`, or `avatar`. The edit page also confusingly co-mingles `affiliateName` (a user column) with benchmark PRs, so an athlete editing "their affiliate" has to scroll past 10+ benchmark inputs.

Additionally, the `CompetitiveHistory` card on `/compete/athlete/` is the *only* place athletes can see what competitions they're registered for. It's buried as the third section of a long profile page, has no filtering (upcoming vs. past), and each registration only links to `/compete/$slug` — there's no shortcut to the registration-details page (`/compete/$slug/teams/$registrationId`) where waivers, affiliate edits, and team members are managed.

Related code:

- `src/routes/_protected/settings.tsx` — settings shell + `SettingsSidebar`
- `src/routes/_protected/settings/{profile,security,sessions,teams,programming}/index.tsx` — app settings pages
- `src/components/settings/settings-sidebar.tsx` — shared sidebar, mixes athlete + programming items
- `src/routes/compete/athlete/index.tsx` — profile view (inc. `CompetitiveHistory`)
- `src/routes/compete/athlete/edit/index.tsx` — athlete-profile form
- `src/routes/compete/athlete/{invoices,sponsors}/index.tsx` — subpages
- `src/server-fns/athlete-profile-fns.ts` — `getAthleteProfileDataFn`, `getAthleteEditDataFn`, `updateAthleteExtendedProfileFn`
- `src/server-fns/profile-fns.ts` — `getUserProfileFn`, `updateUserProfileFn`
- `src/server-fns/passkey-fns.ts`, `session-fns.ts`, `team-settings-fns.ts` — reused by settings pages
- `src/components/compete-nav.tsx` / `compete-mobile-nav.tsx` — compete header; user icon links straight to `/compete/athlete`

## Decision Drivers

- An athlete should manage *everything* about their account from inside `/compete/*` without being bounced to an unrelated shell.
- The compete shell should remain athlete-first: no "Programming" nav items, no workout-owner terminology.
- Shared server functions (profile, passkeys, sessions, teams) must not be duplicated — a single backend, two front-end shells.
- Registration list deserves a dedicated, filterable page (upcoming / past / canceled), not a card buried on the profile page.
- Don't break the existing `/settings/*` surface. Workout-programming users and team admins still rely on it.
- Keep the JSON `athleteProfile` blob vs. direct user columns (`firstName`, `lastName`, `avatar`, `email`, `gender`, `dateOfBirth`, `affiliateName`) split as it is today — re-homing data is out of scope.
- Split the current `/compete/athlete/edit` mega-form so account identity (name/avatar) is not mixed with competition-profile fields (benchmarks, PRs).

## Considered Options

- **Option A: Link compete nav to `/settings/*`.** Add a "Settings" item to the compete dropdown that deep-links into `/_protected/settings/profile`. No new routes, minimal code. Athletes leave the compete shell visually.
- **Option B: Duplicate `/settings/*` under `/compete/athlete/settings/*`.** Copy each settings page into compete, redirecting the originals. Gives an athlete-first IA but doubles the page surface area and forces every future change to land twice.
- **Option C: Extract shared "settings panel" components, mount them under both shells (chosen).** Pull the body of each `/settings/*/index.tsx` into `src/components/settings/panels/*` (or similar), then compose:
  - The existing `/_protected/settings/*` routes render the same panels inside the app's `SettingsSidebar`.
  - New `/compete/athlete/settings/*` routes render the same panels inside a compete-themed sidebar (`CompeteAthleteSettingsSidebar`) that lives under `/compete/athlete/settings.tsx`. Add a dedicated `/compete/athlete/competitions` (or `/compete/athlete/registrations`) page that lists registrations with upcoming / past filters.
- **Option D: Collapse `/settings/*` into compete and retire the app shell.** Strong ergonomic win for athletes, but `/settings/programming` and `/settings/teams` serve programming and team-admin users who may not be competing. Rejected as too invasive for this change.

## Decision Outcome

Chosen option: **Option C: Extract shared settings panel components and mount under a compete-athlete settings shell, plus a dedicated registrations page.**

Option A is rejected because the whole point of the change is to keep athletes inside the compete shell — bouncing out to `/settings/*` preserves the current split and leaves the non-athlete "Programming" item in their face.

Option B is rejected because duplicating every settings page doubles the maintenance cost for pure cosmetic sidebar reskinning. Any future change to, say, passkey management would need to land twice or diverge.

Option D is rejected because programming-only and team-admin users still need `/settings/*`. We don't want to force those personas through a compete-athlete IA.

Splitting the current `/compete/athlete/edit` mega-form also falls out of Option C: the account-identity panel (name, email display, avatar) moves to `/compete/athlete/settings/profile` and is backed by `getUserProfileFn`/`updateUserProfileFn`; the athlete-competition panel (gender, DOB, affiliate, height/weight, benchmarks, social, cover image) stays at `/compete/athlete/edit` (or is renamed `/compete/athlete/settings/athlete-profile` — see non-goals) and continues to use `getAthleteEditDataFn`/`updateAthleteExtendedProfileFn`.

### Consequences

- Good, because athletes stop being bounced out of the compete shell to change their name, avatar, passkey, or to sign out.
- Good, because both shells share one implementation per panel; a fix to e.g. passkey revocation lands once.
- Good, because the compete header can gain a coherent "Settings / My Competitions / Sign out" menu anchored at `/compete/athlete/*`.
- Good, because the new registrations page gives athletes a real home for "where am I registered?" instead of a card buried mid-profile.
- Good, because splitting the edit form separates "who I am" (name, email, avatar) from "my athletic profile" (benchmarks, PRs, affiliate), which matches the mental model.
- Neutral, because `/settings/*` stays as-is. Programming and team-owner users see no change.
- Neutral, because the user icon in `compete-nav.tsx` becomes a dropdown menu instead of a direct link to `/compete/athlete`.
- Bad, because we introduce a second sidebar (`CompeteAthleteSettingsSidebar`) that must be kept visually consistent with `SettingsSidebar`; drift is possible.
- Bad, because routes at `/compete/athlete/settings/profile` and `/settings/profile` will both exist and render the same body — mildly confusing in analytics until `/settings/*` is eventually deprecated for athletes.

### Non-Goals

- **Data migration of `athleteProfile` JSON columns to typed columns.** The JSON blob stays as-is. This ADR is about UX and routing, not schema.
- **Changing passkey, session, or team-settings backends.** The existing server functions (`passkey-fns.ts`, `session-fns.ts`, `team-settings-fns.ts`) are reused unchanged.
- **Retiring `/settings/*`.** It continues to serve programming / team-admin users. A later ADR can revisit if/when those users are fully covered elsewhere.
- **Password management rework.** "Change password" continues to link to `/forgot-password`.
- **Renaming or re-homing the existing `/compete/athlete/edit` route.** The current URL can keep working (with a link from `/compete/athlete/settings`), or be replaced with `/compete/athlete/settings/athlete-profile` in a follow-up; this ADR doesn't force the rename.
- **Notifications / email preferences.** Not surfaced in either settings today; out of scope.
- **Team switching UX on compete.** The compete shell doesn't currently use `nav-team-switcher`; that's a separate product decision.

## Implementation Plan

### Route Tree

```
/compete/athlete/                      (existing: profile view)
/compete/athlete/edit                  (existing: athlete competition profile form)
/compete/athlete/invoices              (existing)
/compete/athlete/invoices/$purchaseId  (existing)
/compete/athlete/sponsors              (existing)
/compete/athlete/competitions          (NEW: my registrations, filterable)
/compete/athlete/settings              (NEW: shell with CompeteAthleteSettingsSidebar)
  └── /settings                        (NEW index: redirect to ./settings/profile)
  └── /settings/profile                (NEW: account identity — name, avatar, email)
  └── /settings/security               (NEW: passkeys)
  └── /settings/sessions               (NEW: active sessions)
  └── /settings/teams                  (NEW: memberships — reuses getUserTeamsFn)
```

The `/_protected/settings/*` routes remain unchanged and continue to render their existing pages. Both shells render the *same* panel components.

### Shared Panel Components

Pull the body of each existing settings page into reusable components:

- `src/components/settings/panels/profile-panel.tsx` — from `src/routes/_protected/settings/profile/index.tsx`
- `src/components/settings/panels/security-panel.tsx` — from `src/routes/_protected/settings/security/index.tsx`
- `src/components/settings/panels/sessions-panel.tsx` — from `src/routes/_protected/settings/sessions/index.tsx`
- `src/components/settings/panels/teams-panel.tsx` — from `src/routes/_protected/settings/teams/index.tsx`

Each panel:

- Takes its data via props (loaders stay on the route).
- Uses the existing server functions (`getUserProfileFn`, `updateUserProfileFn`, `getUserPasskeysFn`, `deletePasskeyFn`, `getUserSessionsFn`, `revokeSessionFn`, `getUserTeamsFn`) unchanged.
- Is pure UI — no routing decisions inside the panel.

Each existing `/_protected/settings/{profile,security,sessions,teams}/index.tsx` route shrinks to "load data, render `<Panel data={...} />`", matching what the new compete routes do.

### Compete Settings Shell

**`src/routes/compete/athlete/settings.tsx`** (new layout route):

```tsx
export const Route = createFileRoute("/compete/athlete/settings")({
  component: AthleteSettingsLayout,
})

function AthleteSettingsLayout() {
  return (
    <div className="mx-auto flex max-w-screen-xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Account Settings</h1>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
        <aside className="lg:w-56">
          <CompeteAthleteSettingsSidebar />
        </aside>
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
```

**`src/routes/compete/athlete/settings/index.tsx`** — redirect to `./profile`.

**`src/components/compete/athlete-settings-sidebar.tsx`** (new):

- Items: Profile, Security, Sessions, Teams, Athlete Profile (→ `/compete/athlete/edit`), Change Password (→ `/forgot-password`), Sign out (dialog).
- **No** "Programming" entry — athletes don't see it.
- Uses the same `buttonVariants` + active-route styling as `SettingsSidebar` so visual drift stays low.

### Registrations Page

**`src/routes/compete/athlete/competitions/index.tsx`** (new):

- Loader calls a new `getAthleteRegistrationsFn()` server function that returns the same shape already produced by `getAthleteProfileDataFn` as `competitionHistory`, plus a `status: "upcoming" | "past" | "canceled"` discriminator derived from `competition.endDate` and `registration.status`.
- UI: tabs or a segmented control for Upcoming / Past / All, a table row per registration with:
  - competition name → `/compete/$slug`
  - division badge
  - registration details link → `/compete/$slug/teams/$registrationId` (waivers, affiliate edits, team members)
  - date range (reuse `isSameUTCDay`)
  - payment status (if exposed by the server fn — existing `competitionRegistrationsTable.stripeSessionId` / join with purchases if needed)

The existing `CompetitiveHistory` block on `/compete/athlete/` stays (or can be trimmed to "Upcoming: N · Past: M · View all →") but the new page is the authoritative list.

### Nav Changes

**`src/components/compete-nav.tsx`** — replace the single user-icon `<a href="/compete/athlete">` with a dropdown menu:

- Profile (`/compete/athlete`)
- My Competitions (`/compete/athlete/competitions`)
- Invoices (`/compete/athlete/invoices`)
- Athlete Profile (`/compete/athlete/edit`)
- Account Settings (`/compete/athlete/settings`)
- separator
- Sign out (existing `LogoutButton` logic)

**`src/components/compete-mobile-nav.tsx`** — mirror the same entries.

### Edit Form Split (optional in this ADR, recommended)

Move the account-identity inputs (`firstName`, `lastName`, avatar URL) *out* of `/compete/athlete/edit` and into the new profile panel at `/compete/athlete/settings/profile`. The athlete-competition form at `/compete/athlete/edit` then scopes down to: gender, DOB, affiliate, height/weight, benchmarks/PRs, social, cover image.

Both forms submit to their existing server functions:

- `updateUserProfileFn({ firstName, lastName, avatar })`
- `updateAthleteExtendedProfileFn({ ...AthleteProfileFormValues })`

### Affected Paths

- Added: `src/routes/compete/athlete/settings.tsx`
- Added: `src/routes/compete/athlete/settings/{index,profile,security,sessions,teams}/index.tsx`
- Added: `src/routes/compete/athlete/competitions/index.tsx`
- Added: `src/components/compete/athlete-settings-sidebar.tsx`
- Added: `src/components/settings/panels/{profile,security,sessions,teams}-panel.tsx`
- Added: `src/server-fns/athlete-profile-fns.ts` — new `getAthleteRegistrationsFn` (or extend existing `getAthleteProfileDataFn` output)
- Modified: `src/routes/_protected/settings/{profile,security,sessions,teams}/index.tsx` — switch to rendering shared panels
- Modified: `src/components/compete-nav.tsx`, `src/components/compete-mobile-nav.tsx` — dropdown + new items
- Modified: `src/routes/compete/athlete/index.tsx` — trim `CompetitiveHistory` to a summary + link to `/compete/athlete/competitions`
- Modified: `src/routes/compete/athlete/edit/index.tsx` — remove account-identity fields (name/avatar)
- Modified: `lat.md/organizer-dashboard.md` or new `lat.md/athlete-hub.md` — document the athlete IA (settings shell, registrations page)
- Unchanged: `src/components/settings/settings-sidebar.tsx` (still used by the programming/app shell)
- Unchanged: `src/server-fns/{profile,passkey,session,team-settings}-fns.ts`

### Patterns to Follow

- Server functions with TanStack Start: `createServerFn` with zod validation (`src/server-fns/*`).
- Route loaders return shaped data; panels consume via props — no direct `useServerFn` inside panels that need to be shared.
- Reuse `requireVerifiedEmail` / `getSessionFromCookie` helpers; don't re-roll auth gates on the compete shell.
- Use `Link` from `@tanstack/react-router` throughout (no raw `<a href>` for internal routes, unlike the current compete-nav user icon).
- Use existing shadcn primitives (`Card`, `Button`, `Dialog`, `DropdownMenu`).

### Patterns to Avoid

- Don't duplicate server functions — every settings action goes through the existing `*-fns.ts` module.
- Don't fork `SettingsSidebar` into compete; build a compete-specific sidebar that *composes* the same `buttonVariants` / active-route helpers.
- Don't re-home `athleteProfile` JSON data in this change. If we want typed columns, that's a schema ADR.
- Don't introduce a new auth flow (e.g., embedded password change) — keep the current `/forgot-password` link.
- Don't mix "Programming" into the compete sidebar, even if the user has programming access on the side.

## Verification

- [ ] A signed-in athlete can reach `/compete/athlete/settings/profile` from a dropdown on the compete nav and edit `firstName`, `lastName`, and avatar without leaving the compete shell.
- [ ] Passkey add/remove from `/compete/athlete/settings/security` works and mirrors `/settings/security` exactly (same server functions, same validation).
- [ ] Session list and revoke from `/compete/athlete/settings/sessions` mirrors `/settings/sessions`.
- [ ] Team list from `/compete/athlete/settings/teams` mirrors `/settings/teams`.
- [ ] `/compete/athlete/settings` (index) redirects to `/compete/athlete/settings/profile`.
- [ ] `/compete/athlete/competitions` lists all competitions the user is registered for, grouped/filterable into Upcoming vs. Past.
- [ ] Each registration row links to `/compete/$slug/teams/$registrationId` (details) *and* to `/compete/$slug` (event page).
- [ ] Compete header user-icon opens a menu containing Profile, My Competitions, Invoices, Athlete Profile, Account Settings, Sign out.
- [ ] Compete mobile nav shows the same entries.
- [ ] `/settings/*` still works for programming-product users: no regressions on `/settings/profile`, `/settings/security`, `/settings/sessions`, `/settings/teams`, `/settings/programming`.
- [ ] Editing a name at `/compete/athlete/settings/profile` is reflected on `/settings/profile` on next load (same backing store).
- [ ] `CompetitiveHistory` on `/compete/athlete/` is trimmed to a summary + "View all →" link (or stays, but is no longer the primary nav target for registrations).
- [ ] Athlete edit page at `/compete/athlete/edit` no longer contains `firstName`, `lastName`, or avatar inputs (those live in the settings profile panel).
- [ ] `lat check` passes after `lat.md/` updates.

## More Information

- `src/routes/_protected/settings.tsx` — app shell (unchanged)
- `src/routes/compete/athlete/index.tsx` — current profile view
- `src/routes/compete/athlete/edit/index.tsx` — current athlete-profile mega-form
- `src/components/compete-nav.tsx` — current compete header with direct-link user icon
- ADR-0001 — TanStack Start migration (foundation for the route tree used here)
