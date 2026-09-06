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

Spectator browsing does not require an account. Athlete sign-in uses an existing verified WODsmith email/password account. A live review account registered in a published competition with assigned heats must be supplied before submission; fictional Debug fixtures are not a reviewer login.

To test local notifications, sign in, open Profile → Heat reminders, grant notification permission, and choose a lead time. A future assigned heat must start after that lead time for a reminder to be scheduled. The app must open to download changes.

To test a Live Activity, open a registered competition or My day and select Show on Lock Screen for a heat starting within eight hours. The widget extension renders the heat, lane, venue, and countdown. This version does not use server-driven APNs updates.

## Privacy answers to verify

Name, email address, and user ID are used for account/profile functionality and linked to the account, with no tracking. Native reminder preferences remain on the device. The native app includes no third-party analytics or ad SDK. Confirm WODsmith hosting/log retention and the submitted privacy questionnaire against the final production implementation before saving Apple’s privacy answers.
