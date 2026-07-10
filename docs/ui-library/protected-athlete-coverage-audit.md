# Protected Athlete Coverage Audit

This audit records exact-revision browser evidence for a bounded authenticated WODsmith Start slice spanning the dashboard, workouts, logs, programming, and personal settings.

## Scope and provenance

The slice assigns 35 scenarios to 15 visual records: three dashboard scenarios, 14 workout scenarios, four log scenarios, four programming scenarios, and ten settings scenarios. Thirty-three are verified and two are blocked.

The original 31 non-athlete-settings observations were captured on 2026-07-10 from commit `6df6cfbae0fcab6eb30bb3a5f698f7c1d11dad19`. The two athlete-settings scenarios were recaptured after the form-context fix at commit `5f91a983afa459acd20eb11f893ff601616d9c4b`. Both runs used `agent-browser 0.26.0`, Node 24, `VITE_E2E=true`, local KV/R2 bindings, and a newly created disposable MySQL database bound only to `127.0.0.1:33317/wodsmith_e2e`.

The manifest contains 33 captures and 147 hash-pinned artifacts: accessibility and scrubbed DOM snapshots plus console and network logs for every verified scenario, one permission redirect trace, and 14 representative screenshots. Form values, authentication cookies, request headers, credentials, and URL query values from network requests are not serialized.

## Dashboard and permission behavior

The owner fixture verified the dashboard in desktop/light and mobile/dark. Both showed the truthful empty scheduled-workout state. The mobile page measured 392 px of content in a 390 px viewport, so the observed two-pixel horizontal overflow needs responsive follow-up.

The seeded athlete without workout-tracking entitlement authenticated successfully and was redirected from `/dashboard` to `/`. This verifies that route's `beforeLoad` permission behavior, not a general contract for every selected child route.

Several workout, log, and programming child routes do not declare the workout-tracking guard used by their index routes. Their authenticated rendering must not be cited as proof that the entitlement is enforced consistently across the feature.

## Workouts and logs

The workouts collection verified the seeded Fran, Murph, and Cindy records in row and card presentations. A no-match search verified the filtered empty state. Detail, create, edit, and schedule pages rendered in both responsive theme variants without submitting forms or mutating data.

Detail, edit, and schedule each verified their explicit `e2e_missing_workout` not-found state. The workout log verified its empty recent-results and calendar presentation, while `/log/new?workoutId=e2e_workout_fran` verified the preselected result form without submission.

These records remain route-specific. `WorkoutForm` already provides the correct app-level create/edit abstraction; workout metadata, schedules, scoring, and log calendars remain domain UI.

## Programming

The two programming-browse scenarios are blocked with `FIXTURE_STATE_MISMATCH`. The required base seed exposes the public `Girls` programming track, so the audited empty state cannot be captured without altering the existing fixture. No empty output is claimed.

Programming subscriptions truthfully rendered the global empty-subscription state in desktop/light and mobile/dark. No subscribe or unsubscribe action was performed.

## Settings

Overview, appearance, and sessions rendered in both responsive theme variants and remain library candidates for a presentation-only settings header, section composition, and responsive settings navigation.

Profile settings still renders the root `Something went wrong` boundary, with console evidence identifying `useFormField should be used within <FormField>` from `FormLabel`.

Athlete settings now renders its populated form in desktop/light and mobile/dark. The desktop capture verifies the default imperial height and weight controls; the mobile capture switches locally to metric without submitting and verifies the metric controls. Both variants expose labels and descriptions, match their requested themes, avoid horizontal overflow, report no console errors, and make no network request with status 400 or higher. The domain form remains route-specific.

## Cross-page candidates

The repeated dashed and plain empty presentations support generalizing the existing organizer empty-state abstraction into a shared, children-driven `EmptyState`. Page headers with optional eyebrow, description, back control, and actions are another candidate after heading semantics are reconciled.

Filtered collection controls, explicit not-found presentation, and settings section cards show useful repetition, but their search state, recovery navigation, and domain actions must remain app-owned. No route controller, authentication logic, mutation, calendar, or domain form belongs in the shared package.

## Coverage result

After this slice, the plan contains 327 scenarios: 142 verified, 26 blocked, and 159 pending. The evidence is local, revision-pinned output and does not claim equivalence with the deployed production application.
