# Release status

WODsmith Game Day 1.0 (build 1) was submitted on September 6, 2026 UTC. App Store Connect confirms Waiting for Review. The native app and backend are deployed; Apple approval and public availability remain pending.

## Verified

- Xcode 26.2 simulator build succeeds for app and Live Activity extension.
- The current device archive, including the privacy disclosures, ordered reminder/Live Activity updates, and contrast improvements, is signed and passes strict recursive signature validation. Xcode exported an App Store IPA using Cloud Managed Apple Distribution and explicit app/extension store profiles. Local artifacts: `/tmp/GameDayStore.xcarchive` and `/tmp/GameDayStoreExport/GameDay.ipa`. The corrected build was uploaded through Xcode and processed successfully. These supersede the earlier signed/exported artifacts.
- Native division standards are verified in portrait and landscape. Their default selection and offline round trip pass a native test.
- Eleven native domain/resource tests passed on iPhone 14 Plus, iOS 26.2, including three suspended-notification scheduling races. Two largest-text UI flows and the real Live Activity start/end flow passed. The three Apple accessibility audits pass with four narrowly scoped, visually reviewed iOS 26.2 exceptions documented in `design-review.md`. The original athlete navigation and portrait/landscape workout flows passed in the earlier validation.
- Eight Game Day API tests passed, covering credential rejection, public discovery, active team registrations, unpublished competitions, and published schedule/announcement boundaries, division standards, and session revocation.
- Full monorepo lint and type checks, Game Day API tests, and the production client/server build passed. The local build used the saved project’s generated Alchemy config, relocated into this ignored worktree configuration.
- A real simulator Live Activity appeared in Dynamic Island.
- The requested dual-agent Impeccable review is complete, with fixes confirmed in light/dark appearance and an XCTest reachability check at the largest accessibility text size. See `design-review.md`.
- App Store Connect now lists WODsmith Game Day, Apple ID `6809070191`, version 1.0, in Waiting for Review under WODSMITH LLC. The description, promotional text, keywords, support/marketing URLs, copyright, subtitle, and Sports/Health & Fitness categories are saved. App record creation is verified. Apple accepted the completed submission without additional metadata or agreement blockers.
- Privacy responses for Name, Email Address, User ID, and Other Diagnostic Data are saved with purposes, account linkage, and no tracking. The user explicitly authorized the privacy attestation; the responses are published.
- Age-rating responses are saved: organizer-generated content and wellness topics are present, contests are frequent, and the app has no gambling, messaging, social feed, unrestricted browser, ads, or mature content features. Apple calculated 13+ in most regions (12+ on older operating systems, with regional exceptions) and excludes Afghanistan and Morocco. The app is declared not a regulated medical device. Content rights are declared using WODsmith's existing user-content license in its Terms of Service.
- Free pricing and availability on release were confirmed for all 175 selectable regions and future regions, subject to Apple's age-rating restrictions. Mac and Vision Pro distribution are disabled for the iPhone-focused launch.
- Five unretouched 1284 × 2778 native screenshots were uploaded to the English (U.S.) iPhone 6.5-inch set. After reloading, Apple showed all five in the intended order: My day, competitions, workout, leaderboard, reminders. The images use fictional competition data and are stored in `AppStore/screenshots/`; they do not establish live-server correctness.

## Production and review preparation

PR [#672](https://github.com/wodsmith/thewodapp/pull/672) merged after required checks passed. Production deployment [34005256436](https://github.com/wodsmith/thewodapp/actions/runs/34005256436) succeeded for merge commit `bb562197a20209d3e929ecdc263cefdb060d35de`.

The authorized Apple test account is an ordinary verified user with its personal team and the approved review-event athlete membership. Native URLSession authentication succeeds. Review contact and login credentials are saved in App Store Connect; credentials stay outside source control. All five current screenshots are saved in the intended order, including the three refreshed images.

The first production native-client check found a decimal-string workout sort position where the native response requires an integer. The follow-up fix returns the one-based position in the already sorted published workout list and adds a production-shaped regression fixture. The deployed fix passed the complete native-client verification below.

Apple's distribution validation rejected the earlier icon's alpha channel. The existing anvil artwork is now opaque RGB over white. The corrected `/tmp/GameDayStore.xcarchive` and `/tmp/GameDayStoreExport/GameDay.ipa` are signed/exported, pass strict recursive signature validation, and Apple Organizer reports: GameDay 1.0 (1) successfully passed all validation checks. The older review archive must not be uploaded.

The response/icon fixes merged in [PR #674](https://github.com/wodsmith/thewodapp/pull/674), merge commit `ee7bdbecd94c95608c937a877a4224d081decde4`. Production deployment [34006778876](https://github.com/wodsmith/thewodapp/actions/runs/34006778876) succeeded for that exact merge commit.

Live diagnostics also exposed three missing nullable benchmark columns expected by main's existing leaderboard. PlanetScale [deploy request #40](https://app.planetscale.com/wodsmith/wodsmith-db/deploy-requests/40) added those columns and matching indexes on `track_workouts` and `scores`. The normal schema deployment completed with a revert window; no athlete records were edited. Both existing and native leaderboard routes now return successfully for three published competitions (41, 27, and 5 entries). Privacy and support URLs return HTTP 200.

The unmodified native API client passed against production: four public competitions; authenticated home with the expected test user and no registrations; all four detail and leaderboard responses (41, 27, 5, and 32 standings); profile update and restoration; and session revocation followed by HTTP 401. This initial verification preceded the approved review event; the athlete verification below now covers its assignments and reminders.

Apple processed build `888f8f4f-e04f-4459-adde-d86ceb6f2676`, version 1.0 (1), and TestFlight shows Ready to Submit. The build is saved on the App Store version. After publishing App Privacy responses, Add for Review passed and final Submit for Review succeeded.

## Apple review event verification

The user approved the small fixture. It was created transactionally on September 6, 2026 UTC: one unlisted published competition, three private workouts with Individual RX standards, three published lane-4 heat assignments, one registration, three fictional scores, and one in-app announcement. No emails were sent and no real athlete records were changed.

The event is `comp_apple_review_gameday_2026`, slug `gameday-app-review-2026`. Its three fixed heat times are September 5 at 9:27 PM, September 6 at 8:52 PM, and September 12 at 8:52 PM, 2026, America/Denver. Reviewer notes list these times and the contact procedure if a different upcoming heat is needed. These are three fixed heats, not a repeating schedule.

The unmodified native API client verifies one registered competition, three assigned heats, and one standings entry. Additional checks verify lane 4 on all assignments, three division standards, one announcement, an offline schedule encode/decode round trip, and three correctly timed reminder plans using a 15-minute lead in the verification harness. Anonymous discovery excludes the unlisted event; anonymous detail omits registrations and assignments.

The simulator signed in against production and displayed the registered competition and personal next-heat countdown. The Live Activity started successfully. In a separate device-delivery test, the simulator preference was changed to 30 minutes. A real local notification delivered for Engine Room with that 30-minute lead, lane 4, and Practice floor while the app was backgrounded. This delivery used the actual server assignment, not Debug demo data.

Apple reviewer instructions, contact, credentials, and build 1 are included in the submitted version. The final App Privacy accuracy/compliance attestation was accepted with the user’s explicit authorization.

## Submission receipt

Apple confirmed **1 Item Submitted** and **1.0 Waiting for Review** on September 6, 2026 UTC (September 5, 9:38 PM MDT). The [review submission](https://appstoreconnect.apple.com/apps/6809070191/distribution/reviewsubmissions/details/44ac7f00-1370-4611-aeb3-780c82ed897f) is `44ac7f00-1370-4611-aeb3-780c82ed897f`. Automatic release after approval is selected. Submission is complete; approval is not yet granted.

The final service-provider privacy clarification merged in [PR #676](https://github.com/wodsmith/thewodapp/pull/676), commit `e7d2338134d42f8446ebfd94e56e0b742b509704`. Production deployment [34009157855](https://github.com/wodsmith/thewodapp/actions/runs/34009157855) succeeded. The updated public policy was opened and its equivalent-protection clause verified before publishing App Privacy and submitting.

The final requirement check covered working public privacy/support links and contact methods, retention/deletion choices, service-provider protection, in-app Help access, the matching native privacy manifest and App Store disclosures, reviewer credentials, screenshots, age/content declarations, and the selected validated build. The native app uses existing WODsmith sign-in and offers no account-creation or third-party login flow. Review guidance: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), particularly 1.5, 2.1, 4.8, and 5.1.1.

Full VoiceOver traversal, RTL, and unusually long organizer content have not been certified by the bounded design checks. Apple may request changes during review; passing submission validation is not a guarantee of approval.

## Version 1.1 build 2 — uploaded

On September 12, 2026, the combined athlete/spectator release was signed, archived, uploaded, processed by Apple, and saved on the 1.1 App Store draft. It includes the borderless icon and Lock Screen-first listing. The version has not yet been submitted for review.

Release branch: `zac/gameday-1-1-release`; PR https://github.com/wodsmith/thewodapp/pull/700 at commit `97d463425`. Archive: `/tmp/GameDay-1.1-2.xcarchive`; upload log: `/tmp/gameday-release-upload.log`. Apple reported Upload succeeded and exposed build 2 (1.1), which was selected and saved.

All repository pre-push lint and type checks passed with Node 24 and lockfile-pinned dependencies. Combined Game Day API tests pass 9/9; native unit tests pass. The spectator task also passed signed-out relaunch/unfollow/division flows, athlete navigation, and largest-text UI checks.

Next: wait for PR checks, review any findings, merge and deploy the compatible public participant/assignment API through the production workflow, verify anonymous published assignments, then complete Add for Review and Submit for Review in App Store Connect. Do not re-upload build 2. Existing review credentials remain saved privately.

## Version 1.1 build 4 — review corrections

Builds 2 and 3 are superseded and must not be submitted. Build 4 adds saved unlisted discovery recovery, canonical slug caching, 404 cache eviction, and participant fallback status/retry. Archive and upload build 4 from the final reviewed code, select it, then submit only after PR #700 is merged and the production API is verified.

The earlier 193 type diagnostics came from the spectator task's shared dependency setup. A fresh frozen-lockfile install with Node 24 resolved that environment mismatch; full pre-push lint/type checks and PR CI type checks passed on 62df9d921.

## Version 1.1 build 5 — final athlete polish

Build 5 supersedes builds 2–4 and adds personal-only lane labels and deduplicated registered/spectating discovery. This is the final submission candidate; earlier uploaded builds must not be submitted.

## Announcement push follow-up — 1.2 build 6 preparation

On September 12, 2026, App Store Connect still showed 1.1 Prepare for Submission, build 5 selected (`bd02ac14-3ddf-4966-87a6-0f4ed8c7cb12`), with the Lock Screen screenshot first. This task did not alter that version, build selection, reviewer credentials, or submission.

Follow-up source is 1.2 build 6. Native simulator compilation and lifecycle tests pass; notification-injection evidence covers a warm tap to the exact announcement and a signed-out cold launch. See `design-evidence/announcement-push/README.md`.

Apple Developer identifier `G29VQNGV94` (`com.wodsmith.gameday`) currently has Push Notifications unchecked. An APNs signing key is not configured in the inspected WODsmith development configuration. The attempted 1.2 build 6 archive failed: the existing wildcard provisioning profile lacks both Push Notifications and `aps-environment`. Real provider delivery and upload remain blocked. Do not upload or submit this follow-up until those checks and backend rollout are complete.

Before follow-up submission: retain 1.1 build 5, finish the current release separately, apply the push schema migration, configure and verify APNs using an explicitly approved test device/account, and include linked Device ID usage for App Functionality in Apple privacy disclosures. Production deployment still requires separate explicit authorization; this task did not deploy production.

Automatic approval review rejected enabling Push Notifications on the Apple identifier, requiring specific authorization for that capability change. No capability, profile, key, or App Store submission was changed. GitHub PR #705 contains the gated implementation and migration; rollout authorization and Apple capability/key setup remain external prerequisites.

PR #705 review corrections and full CI passed on `a2005ea6d`. Automatic approval review then rejected the PR merge because it could not find trusted explicit user authorization to mutate the shared target branch. The PR remains open pending that authorization; no alternate merge path was attempted. A subsequent main update required preserving both entries in the documentation index.


## Combined announcement release takeover

The user requested including announcement push in the next review build. The combined candidate is now 1.1 build 6, replacing the earlier separate 1.2 plan. Build 5 remains selected until a signed replacement is uploaded. PR #705's migration collision with main was resolved by regenerating identical push SQL as `0011_gameday_push.sql` after training plans.

PR #700 is merged at `9c2e640ca57fe25b33adc3c6b8e99da07f2ece01`. Its build 5 upload and prior native/API verification remain valid. Production rollout has not been authorized through automatic approval review. Apple Push capability, APNs credentials, the production schema rollout, real-device delivery verification, and accurate Device ID disclosures remain prerequisites for submitting build 6.


## Build 6 uploaded and selected

On September 12, 2026 MDT, the user explicitly approved Apple push signing, APNs configuration, the production migration, and backend deployment. PR #705 merged as `ef46c635df4ab0c6500ea3d18edbc010ec56c38a`; all final CI checks passed.

Apple Push Notifications is enabled for `com.wodsmith.gameday`. The production-only, topic-specific APNs key `Y4H2B873S9` was created. The private key is not in this repository. Automatic approval review separately rejected uploading that key to GitHub Actions because the repository credential destination needs explicit approval; that request is pending. No secret upload was executed.

Archive `/tmp/GameDay-1.1-6.xcarchive` succeeded; upload log `/tmp/gameday-build6-upload.log` reports Upload succeeded. Apple processed build 6 and it was selected and saved on the 1.1 draft. Build 5 is superseded. Review submission is not complete.

PlanetScale CLI is authenticated only to other organizations, and the WODsmith browser session expired. A sign-in request is pending. Migration 0011 and production rollout have not run. Real APNs delivery and Device ID privacy disclosure remain unverified. A paired iPhone 13 Pro Max is available for a controlled delivery test after setup.


## Production rollout and Apple metadata

The user explicitly approved the GitHub Actions secret destination and the necessary database changes to main. APNs credentials are stored in the private Actions secrets of `wodsmith/thewodapp`; no key material is committed.

PlanetScale deploy request 47 applied the two push tables to production main. Deploy request 48 applied missing committed-schema prerequisites detected by the deployment guard: benchmark tables, training plans, volunteer signup intents, users.auth_generation, waiver signature name, session composition state, and the NULL-safe score key/index. The preflight duplicate-score-group count was zero. A complete column comparison against snapshot 0011 then reported no missing columns. Request 47 was finalized to unblock the queue; request 48 retains its normal revert window.

WODsmith production workflow `34736262879`, attempt 2, deployed successfully from `657a6b0d7900c972cd7e2b65f80647a8ca2279c0`. The first attempt stopped safely at the missing-schema guard. Live verification: home and leaderboard HTTP 200; unauthenticated device registration HTTP 401; public competition had 41 participants, 21 heats, 123 public assignments, and no personal assignments. The updated privacy policy is live. Crew rollout `34736949475` was started afterward.

Apple's Device ID disclosure is published: linked to the user, App Functionality, no tracking. Build 6 (`b53d414a-a8a1-430e-8d09-ba781887eebf`) and announcement description/reviewer notes were saved and verified after reload. The previous selection had not persisted; this later server reload confirms build 6.

An Apple HTTP/2 probe using the production key and a synthetic invalid token returned HTTP 400 BadDeviceToken, without contacting a real device. Real notification delivery remains pending. Internal TestFlight group `ffe2e5e8-989f-4be0-8299-29676b5167c5` contains build 6; adding owner `zac@wodsmith.com` was rejected by automatic approval review pending explicit recipient/group authorization. Do not bypass that rejection. Review submission remains pending verification.


## Ready to submit after device verification

Crew production workflow `34736949475` completed successfully. Both organizer backends are deployed. The Apple Add for Review validation passed for version 1.1 build 6, creating a draft submission with one item Ready to Submit. Final Submit for Review has not been clicked.

Production had zero registered push devices at the last checkpoint. The user subsequently explicitly approved adding `zac@wodsmith.com` to Game Day release verification. The invitation succeeded: Apple shows one tester with status Invited and one build. The remaining user steps are installing build 6, signing in, enabling announcement alerts, and readiness for one controlled notification to that account only.


## Physical device delivery correction

The owner installed build 6 and registered a production push device. Their sent announcement queued a delivery but failed before APNs because Cloudflare rejects fetch redirect mode error. An isolated remote Worker reproduced the exception; manual mode reached Apple successfully. The backend fix retains redirect protection and adds regression coverage. Real delivery and final review submission remain pending deployment.
