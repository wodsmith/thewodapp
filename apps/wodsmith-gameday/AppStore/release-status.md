# Release status

The native app is in implementation and validation. It has not been uploaded or submitted for review.

## Verified

- Xcode 26.2 simulator build succeeds for app and Live Activity extension.
- The current device archive, including the privacy disclosures, ordered reminder/Live Activity updates, and contrast improvements, is signed and passes strict recursive signature validation. Xcode exported an App Store IPA using Cloud Managed Apple Distribution and explicit app/extension store profiles. Local artifacts: `/tmp/GameDayReview.xcarchive` and `/tmp/GameDayReviewExport/GameDay.ipa`. No upload occurred. These supersede the earlier signed/exported artifacts.
- Native division standards are verified in portrait and landscape. Their default selection and offline round trip pass a native test.
- Eleven native domain/resource tests passed on iPhone 14 Plus, iOS 26.2, including three suspended-notification scheduling races. Two largest-text UI flows and the real Live Activity start/end flow passed. The three Apple accessibility audits pass with four narrowly scoped, visually reviewed iOS 26.2 exceptions documented in `design-review.md`. The original athlete navigation and portrait/landscape workout flows passed in the earlier validation.
- Eight Game Day API tests passed, covering credential rejection, public discovery, active team registrations, unpublished competitions, and published schedule/announcement boundaries, division standards, and session revocation.
- Full monorepo lint and type checks, Game Day API tests, and the production client/server build passed. The local build used the saved project’s generated Alchemy config, relocated into this ignored worktree configuration.
- A real simulator Live Activity appeared in Dynamic Island.
- The requested dual-agent Impeccable review is complete, with fixes confirmed in light/dark appearance and an XCTest reachability check at the largest accessibility text size. See `design-review.md`.
- App Store Connect now lists WODsmith Game Day, Apple ID `6809070191`, version 1.0, in Prepare for Submission under WODSMITH LLC. The description, promotional text, keywords, support/marketing URLs, copyright, subtitle, and Sports/Health & Fitness categories are saved. App record creation is verified; the Developer Program agreement banner still remains.
- Privacy responses for Name, Email Address, User ID, and Other Diagnostic Data are saved with purposes, account linkage, and no tracking. The final privacy Publish attestation has not been accepted; responses remain unpublished.
- Age-rating responses are saved: organizer-generated content and wellness topics are present, contests are frequent, and the app has no gambling, messaging, social feed, unrestricted browser, ads, or mature content features. Apple calculated 13+ in most regions (12+ on older operating systems, with regional exceptions) and excludes Afghanistan and Morocco. The app is declared not a regulated medical device. Content rights are declared using WODsmith's existing user-content license in its Terms of Service.
- Free pricing and availability on release were confirmed for all 175 selectable regions and future regions, subject to Apple's age-rating restrictions. Mac and Vision Pro distribution are disabled for the iPhone-focused launch.
- Five unretouched 1284 × 2778 native screenshots were uploaded to the English (U.S.) iPhone 6.5-inch set. After reloading, Apple showed all five in the intended order: My day, competitions, workout, leaderboard, reminders. The images use fictional competition data and are stored in `AppStore/screenshots/`; they do not establish live-server correctness.

## Production and review preparation

PR [#672](https://github.com/wodsmith/thewodapp/pull/672) merged after required checks passed. Production deployment [34005256436](https://github.com/wodsmith/thewodapp/actions/runs/34005256436) succeeded for merge commit `bb562197a20209d3e929ecdc263cefdb060d35de`.

The authorized Apple test account exists as an ordinary verified user, with only its personal team membership. Native URLSession authentication succeeds. Review contact and login credentials are saved in App Store Connect; credentials stay outside source control. All five current screenshots are saved in the intended order, including the three refreshed images.

The first production native-client check found a decimal-string workout sort position where the native response requires an integer. The follow-up fix returns the one-based position in the already sorted published workout list and adds a production-shaped regression fixture. Full live verification must pass after that fix is deployed.

## Required before submission

- Deploy the workout-order contract fix and rerun native-client production verification, including profile update/restoration and session revocation.
- Supply assigned heats for the review account. Automatic approval review rejected a broad persistent production fixture. A smaller unlisted event with three fictional workouts/heats, one registration, sample results, and one in-app announcement awaits explicit user approval. Only the account and required personal team/membership have been created.
- Verify athlete assignments, refresh/offline recovery, and reminders against the approved live event.
- Publish the prepared App Privacy responses after the required attestation confirmation.
- Resolve Apple's updated Developer Program License Agreement. No agreement has been accepted by this task.
- Upload the signed distribution build, wait for processing, select it, complete reviewer notes, and submit.

Full VoiceOver traversal, RTL, and unusually long organizer content have not been certified by the bounded design checks. Backend deployment has occurred; App Store build upload and review submission have not.
