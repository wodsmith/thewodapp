# Release status

The native app is in implementation and validation. It has not been uploaded or submitted for review.

## Verified

- Xcode 26.2 simulator build succeeds for app and Live Activity extension.
- The current device archive, including the privacy disclosures, ordered reminder/Live Activity updates, and contrast improvements, is signed and passes strict recursive signature validation. Xcode exported an App Store IPA using Cloud Managed Apple Distribution and explicit app/extension store profiles. Local artifacts: `/tmp/GameDayFinal.xcarchive` and `/tmp/GameDayFinalExport/GameDay.ipa`. No upload occurred. These supersede the earlier signed/exported artifacts.
- Native division standards are verified in portrait and landscape. Their default selection and offline round trip pass a native test.
- Ten native domain/resource tests passed on iPhone 14 Plus, iOS 26.2, including three suspended-notification scheduling races. Two largest-text UI flows and the real Live Activity start/end flow passed. The three Apple accessibility audits pass with four narrowly scoped, visually reviewed iOS 26.2 exceptions documented in `design-review.md`. The original athlete navigation and portrait/landscape workout flows passed in the earlier validation.
- Seven Game Day API tests passed, covering credential rejection, public discovery, active team registrations, unpublished competitions, and published schedule/announcement boundaries, division standards, and session revocation.
- Full monorepo lint and type checks, Game Day API tests, and the production client/server build passed. The local build used the saved project’s generated Alchemy config, relocated into this ignored worktree configuration.
- A real simulator Live Activity appeared in Dynamic Island.
- The requested dual-agent Impeccable review is complete, with fixes confirmed in light/dark appearance and an XCTest reachability check at the largest accessibility text size. See `design-review.md`.
- App Store Connect now lists WODsmith Game Day, Apple ID `6809070191`, version 1.0, in Prepare for Submission under WODSMITH LLC. The description, promotional text, keywords, support/marketing URLs, copyright, subtitle, and Sports/Health & Fitness categories are saved. App record creation is verified; the Developer Program agreement banner still remains.
- Privacy responses for Name, Email Address, User ID, and Other Diagnostic Data are saved with purposes, account linkage, and no tracking. The final privacy Publish attestation has not been accepted; responses remain unpublished.
- Age-rating responses are saved: organizer-generated content and wellness topics are present, contests are frequent, and the app has no gambling, messaging, social feed, unrestricted browser, ads, or mature content features. Apple calculated 13+ in most regions (12+ on older operating systems, with regional exceptions) and excludes Afghanistan and Morocco. The app is declared not a regulated medical device. Content rights are declared using WODsmith's existing user-content license in its Terms of Service.
- Free pricing and availability on release were confirmed for all 175 selectable regions and future regions, subject to Apple's age-rating restrictions. Mac and Vision Pro distribution are disabled for the iPhone-focused launch.
- Five unretouched 1284 × 2778 native screenshots were uploaded to the English (U.S.) iPhone 6.5-inch set. After reloading, Apple showed all five in the intended order: My day, competitions, workout, leaderboard, reminders. The images use fictional competition data and are stored in `AppStore/screenshots/`; they do not establish live-server correctness.

## Required before submission

- Replace the three affected App Store screenshots (My day, discovery, reminders) with the refreshed local captures. They are visually checked and ready in `AppStore/screenshots/6.5-inch/`; the saved five-image draft predates these small visual changes. Complete the missing contact fields so Apple can save the updated draft.
- Deploy the new WODsmith API and public support/privacy pages; the production API currently returns 404.
- Verify real athlete login, teammate assignments, profile editing, refresh/offline recovery, and notifications against deployed data.
- Complete the App Store draft's privacy publication and review details. The user authorized reusing Dial Your Espresso's review contact. Its saved name is Zachary Jones, but phone and email are blank in both the read-only listing and edit dialog. The name is entered in Game Day's current form; Apple refuses to save it until phone and email are supplied. A request for those two missing values is pending. No Espresso review information was modified.
- Upload the distribution build after live-server validation and wait for Apple processing.
- Provide a working review account with a published competition and assigned heats.
- Resolve Apple’s updated Developer Program License Agreement. App Store Connect currently says the Account Holder must accept it before updating existing apps or submitting new ones. No agreement has been accepted by this task.

Full VoiceOver traversal, RTL, and unusually long organizer content have not been certified by the bounded design checks. No backend deployment, App Store upload, or review submission has occurred.

## Source release gate

The implementation starts at commit `00a4c9b89`; privacy, concurrency, and accessibility follow-through is in `35e5d34b4`. These and the refreshed screenshot assets are on local branch `zac/native-game-day`, based on main at `129445f74`. The GitHub push was rejected by automatic approval review because explicit authorization to send source/history to `github.com/wodsmith/thewodapp` is required. A user approval request is pending; do not retry the push or use an alternate transport until authorized.

The initial pre-push lint failure was caused by missing worktree dependencies. Restoring links to the saved project’s installed packages resolved it. The full repository lint and type-check commands subsequently passed. No hook was bypassed.
