# App Store metadata

This copy describes the implemented native app. Upload only after production API verification and final simulator/device checks.

## Identity

- Name: WODsmith Game Day
- Subtitle: Your competition schedule
- Apple ID: 6809070191
- SKU: wodsmith-gameday-ios
- Bundle ID: com.wodsmith.gameday
- Version: 1.0
- Primary category: Sports
- Secondary category: Health & Fitness
- Copyright: 2026 WODSMITH LLC
- Price: Free
- Calculated age rating: 13+ in most regions; regional and older-OS exceptions apply
- Support URL: https://wodsmith.com/gameday/support/
- Privacy URL: https://wodsmith.com/gameday/privacy/
- Marketing URL: https://wodsmith.com
- Keywords: competition,fitness,athlete,heat,schedule,leaderboard,workout,reminder,functional

## Description

Your heats, your lane, and the competition around you.

WODsmith Game Day brings WODsmith competitions to iPhone. Sign in with the account you used to register and see your competitions, assigned heats, lane numbers, and venues. Open your next heat for its start time and a countdown, then follow the rest of your schedule.

Set an optional reminder before your heat, or start a Live Activity to keep the countdown on your Lock Screen and Dynamic Island. Reminders use your downloaded schedule, so open Game Day to pick up organizer changes.

Following a friend or watching from the sidelines? Browse competitions without an account. Search by competition or city, view published schedules and workouts, check standings by division, and read public organizer announcements.

Athletes can also view registration and check-in information, read announcements sent to them, and update their WODsmith profile.

Downloaded competition information remains readable during a temporary connection loss. WODsmith and your competition organizer remain the source of schedule and result updates.

## Promotional text

Find your next heat, check your lane, and follow your competition from iPhone. Athletes get a personal schedule; spectators can browse without signing in.

## Reviewer notes

Spectator browsing does not require an account. Athlete sign-in uses an existing verified WODsmith email/password account. A verified live review account has been created and its login is saved in App Store Connect. Its competition registration and assigned heats still await approval of the small production review event; fictional Debug fixtures are not a reviewer login.

To test local notifications, sign in, open Profile → Heat reminders, grant notification permission, and choose a lead time. A future assigned heat must start after that lead time for a reminder to be scheduled. The app must open to download changes.

To test a Live Activity, open a registered competition or My day and select Show on Lock Screen for a heat starting within eight hours. The widget extension renders the heat, lane, venue, and countdown. This version does not use server-driven APNs updates.

## Privacy declarations

The draft declares Name, Email Address, and User ID as linked to the account, used for App Functionality and Product Personalization, with no tracking. Other Diagnostic Data is linked to the account and used for App Functionality, with no tracking.

The native binary contains no analytics or advertising SDK. WODsmith’s server uses Sentry for errors/traces and operational logging with PostHog. Diagnostics include request paths, response status, and timing; account identifiers may be attached by server context. Default PII collection in Sentry is disabled, but this is not a guarantee of anonymization, so the disclosure does not claim that diagnostics are unlinked.

Registration, heat assignments, and results are downloaded from existing WODsmith records. This app does not upload fitness measurements, scores, payment information, photos, or device contacts. Competition searches and notification preferences remain local. The native app sends account credentials, profile-name changes, and API requests.

Reference: [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/). Recheck disclosures if the native app gains score submission, analytics, push registration, or other data-upload features.

## Age and content declarations

The saved questionnaire includes organizer-generated content, health/wellness topics, and frequent contests because competition rankings are central to the app. It declares no gambling, simulated gambling, loot boxes, advertising, messaging, social media, unrestricted web browser, or mature-content features. Apple calculated 13+ in most regions and excludes Afghanistan and Morocco based on these answers.

Game Day is declared not a regulated medical device. Organizer content is covered by the WODsmith Terms of Service's non-exclusive worldwide license to use, display, and distribute uploaded content in connection with the service. Mac and Vision Pro distribution are disabled for this iPhone release.
