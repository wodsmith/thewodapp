# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Plan: Top-level "Review" nav item + index page for video submissions

## Context

Video submission review currently only lives at `/compete/organizer/$competitionId/events/$eventId/submissions` — buried under individual events with no top-level nav entry. Organizers need a "Review" link in the sidebar and an index page showing all events with submission counts, window status, and review progress at a glance.

## Changes

### 1. Add "Review" to sidebar nav (onli...

### Prompt 2

commit your work

### Prompt 3

installHook.js:1 Error: target: wodsmith-db.-.primary: vttablet: rpc error: code = NotFound desc = Unknown column 'video_submissions.reviewed_at' in 'where clause' (errno 1054) (sqlstate 42S22) (CallerID: dbsq8pa19orldgzd043p): Sql: "select track_workout_id, count(*) from video_submissions where video_submissions.track_workout_id in ::vtg1 and video_submissions.reviewed_at is not null group by video_submissions.track_workout_id", BindVars: {REDACTED}
    at Object.deserialize (ShallowErrorPlugin...

