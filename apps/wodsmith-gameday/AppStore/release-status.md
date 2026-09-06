# Release status

The native app is in implementation and validation. It has not been uploaded or submitted for review.

## Verified

- Xcode 26.2 simulator build succeeds for app and Live Activity extension.
- A device archive is signed and passes strict recursive signature validation. Xcode exported an App Store IPA using Cloud Managed Apple Distribution and explicit app/extension store profiles. Local artifacts: `/tmp/GameDaySigned.xcarchive` and `/tmp/GameDayAppStoreExport/GameDay.ipa`. No upload occurred.
- Native division standards are verified in portrait and landscape. Their default selection and offline round trip pass a native test.
- Seven native domain/resource tests and three UI tests passed on iPhone 17 Pro, iOS 26.2.
- Seven Game Day API tests passed, covering credential rejection, public discovery, active team registrations, unpublished competitions, and published schedule/announcement boundaries, division standards, and session revocation.
- WODsmith TypeScript check and full production client/server build passed. The local build used the saved project’s generated Alchemy config, relocated into this ignored worktree configuration.
- A real simulator Live Activity appeared in Dynamic Island.
- The requested dual-agent Impeccable review is complete, with fixes confirmed in light/dark appearance and an XCTest reachability check at the largest accessibility text size. See `design-review.md`.
- App Store Connect now lists WODsmith Game Day, Apple ID `6809070191`, version 1.0, in Prepare for Submission under WODSMITH LLC. App record creation is verified; the Developer Program agreement banner still remains.

## Required before submission

- Complete remaining release accessibility checks: VoiceOver, landscape, RTL, and unusually long organizer content.
- Deploy the new WODsmith API and public support/privacy pages; the production API currently returns 404.
- Verify real athlete login, teammate assignments, profile editing, refresh/offline recovery, and notifications against deployed data.
- Complete the App Store draft’s screenshots, metadata, privacy answers, and review details.
- Upload the distribution build after live-server validation and wait for Apple processing.
- Capture final screenshots at Apple’s supported iPhone screenshot sizes, and complete metadata, privacy, age-rating, and review details.
- Provide a working review account with a published competition and assigned heats.
- Resolve Apple’s updated Developer Program License Agreement. App Store Connect currently says the Account Holder must accept it before updating existing apps or submitting new ones. No agreement has been accepted by this task.

No backend deployment, App Store upload, or review submission has occurred.
