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
