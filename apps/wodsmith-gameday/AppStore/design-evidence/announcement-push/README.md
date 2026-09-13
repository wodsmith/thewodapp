# Announcement notification evidence

Captured September 12, 2026 on an isolated iPhone 16e simulator running iOS 26.2. All notification content and athlete records are fictional.

- `lock-screen.png`: notification injected through `simctl push`, presented by iOS after notification permission was granted.
- `announcement-open.png`: tapping the notification from the Lock Screen opened the exact `announcement-1` fixture and its body in the native announcement view.
- `cold-launch-sign-in.png`: after terminating the app, tapping the same notification launched the non-demo app and retained the destination while requiring sign-in. No private content appeared.

The first tap attempt exposed an existing async notification-delegate completion returning on a background thread, crashing UIKit state restoration. The callback now completes on the main actor. The repeat warm and cold tap tests both succeeded.

These screenshots prove simulator presentation, response handling, and navigation. They do not prove APNs provider delivery. No production announcement or athlete notification was sent.
