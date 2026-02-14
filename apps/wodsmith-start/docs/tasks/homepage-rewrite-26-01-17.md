# PRD — WODsmith Compete (and Series)

- **Date**: 2026-01-17
- **Owner**: WODsmith
- **Status**: Draft
- **Primary bet**: Win by fixing the *backend operational nightmare* of comps (not by “taking payments”) and by making scoring/appeals transparent enough that athletes trust results.

---

## 1) Updated evaluation of the current landing page (with real client-chat context)

The current page is aesthetically strong and strategically weak.

### What it currently communicates
- “Tools Built for Functional Fitness”
- “One Platform, Two Powerful Tools”
- Vague feature buckets (flexible scoring, team management, responsive design)

### What your market actually cares about (from chats)
You’re not selling “tools.” You’re selling **trust on game day** and **ops sanity**:

- **Athletes**: “Don’t screw me with typos/opaque scoring/appeals.” “Tell me my heat without hunting paper.” “Show me *my division* instantly.”
- **Organizers**: “Volunteer & judge scheduling that isn’t spreadsheets.” “Heat updates pushed to phones.” “Score verification before the board.”
- **Series organizers**: “70+ gyms, one config, global leaderboard.” “Reliability is #1.”

### The copy crime (why this won’t convert)
Right now you’re writing like you’re afraid to pick a villain.

- “Tools built for functional fitness” is what *every* vendor says. It’s category soup.
- “One platform, two powerful tools” is your org chart, not the customer’s outcome.
- The page describes “features” but never proves **trust** (transparent scoring/appeals) or **ops relief** (volunteers/judges/heats/verification).

### Positioning recommendation (based on what buyers said)
Lead with **Compete** (and series) as the flagship wedge:

- **Primary promise**: “Run a comp athletes trust—without spreadsheet ops.”
- **Core differentiators**:
  - Transparent tie-breaker math + audit trail (“show me the math”)
  - Digital appeals that are trackable and explained
  - Score verification before leaderboard (reduce typo drama)
  - Heat discovery + push notifications (1hr/30m/10m)
  - Volunteer/judge scheduling by credential + rotation patterns
  - Series mode: one config → 70+ gyms + global leaderboard
  - Reliability as a first-class feature

### Landing-page translation (requirements)
- Replace generic feature buckets with **recognizable moments**:
  - “Scores verified before they hit the leaderboard (no more ‘I got typed as 8th’).”
  - “Athletes see only *their* division’s heats—instantly.”
  - “Push alerts: ‘You’re up in 60/30/10.’”
  - “Tie-breakers are transparent: show the math, show the rule, show the audit.”
  - “Appeals are digital, trackable, and explained.”
  - “Volunteers scheduled, judges assigned by cert, rotations auto-built.”
- Add proof nuggets early:
  - “Built with comp organizers running multi-location series.”
  - Quote/endorsement placeholders: Basile (Verdant), Jon (All Valley Open), Will (Fortitude).
- Remove filler:
  - “Responsive design” is not a buying reason. Delete.

---

## 2) Problem statement

Functional fitness competitions routinely melt down for reasons that are *predictable* and currently *unhandled* by mainstream platforms:

- Results aren’t trusted (opaque tie-breakers, inconsistent appeals, typos that decide podiums).
- Athletes can’t easily find what matters (their heats/workouts/division) and miss updates.
- Organizers run critical backend operations on spreadsheets/printed sheets/Google Docs.
- Series operators (multi-location) have no unified tooling and require extreme coordination.
- Reliability is existential: if the platform goes down on game day, the event is damaged.

WODsmith will win by treating competitions as **operations + trust**, not “payment + leaderboard.”

---

## 3) Target users & primary jobs-to-be-done

### Athlete (example: Isaac, Mountain West)
- **JTBD**: “Help me compete without admin chaos—and trust that results are correct.”

### Organizer / Gym owner (examples: Basile — Verdant, Jon — All Valley)
- **JTBD**: “Run a smooth event with limited staff/volunteers and minimal drama.”

### Series organizer (example: Will — Fortitude)
- **JTBD**: “Run the same competition across many venues with one source of truth.”

### Secondary users
- Judges (need simple scoring UX + role clarity)
- Scorecard runners (need a recognized workflow)
- Head judge / floor manager (needs real-time visibility + override controls)

---

## 4) User pain inventory (verbatim-to-requirements)

### Athlete pains
- **Opaque scoring**: “Randomly some appeals get approved… tie-breaker math is opaque.”
- **Appeals are broken**: paper forms → email → no explanation.
- **Typos decide outcomes**: placed 8th when actually 2nd; must catch errors immediately.
- **Heat discovery sucks**: huge dropdowns (e.g., 50+ divisions) to find your workout.
- **No notifications**: wants push alerts; currently relies on paper taped to walls.

### Organizer pains
- **Volunteer management doesn’t exist** (currently Google Docs + printed spreadsheets).
- **Judge scheduling is easier by hand**; can’t see credentials/certs/shift preferences/rotations.
- **Competitor tools are pricey relative to UX**; fee pain + mediocre ops support.
- **“Backend ops are the real problem.”** Payment is table stakes.

### Series pains
- **No multi-location tooling** for 70+ gyms simultaneously.
- **Reliability is #1**: downtime is unacceptable.

---

## 5) Goals & success metrics

### Business goals
- Acquire first cluster of paying organizers (starting with known warm leads).
- Become the default “serious ops” platform for functional fitness comps and series.

### Product goals (measurable)
- **Reduce score-entry errors**: < 0.5% of scored entries require correction after verification.
- **Appeals transparency**: 100% of appeal decisions include a recorded rationale and rule reference.
- **Heat notification reach**: > 80% of athletes enable notifications; > 95% delivery success.
- **Organizer time saved**: reduce volunteer/judge scheduling time by 50% vs spreadsheet baseline (self-reported + time-on-task).
- **Reliability**: 99.9%+ uptime during event windows; graceful degradation plan for venue connectivity issues.

---

## 6) Non-goals (for MVP)
- Becoming a general gym CRM or programming tool (don’t drift into “Train” as primary wedge).
- Building a full accounting/finance suite.
- Supporting every exotic scoring format on day one (start with the dominant formats, expand).

---

## 7) Product scope (capabilities)

### 7.1 Athlete experience (trust + clarity)
- Personalized view: **My division → my events → my heats** (no hunting dropdowns).
- Push notifications: “You’re up in 60/30/10” + change alerts (lane/heat moved).
- Transparent leaderboard:
  - Show tie-breaker logic and the computed values (“show me the math”).
  - Change log: when a score changed, why, who approved.
- Digital appeals:
  - Submission, evidence attachment (photo/video), status tracking.
  - Decision includes rule reference + explanation.
- “What do I need?” simulator (post-MVP unless very low effort):
  - Required placing/score to pass another athlete/team.

### 7.2 Judge / volunteer ops (make the spreadsheet die)
- Volunteer intake:
  - Availability (morning/afternoon), preferences, experience, credentials.
  - Credential capture (e.g., L2 cert), verification status.
- Scheduling:
  - Assign judges to heats; filter by credential + availability.
  - Rotation patterns; handle short staffing without chaos.
  - Explicit roles: judge, head judge, score entry, scorecard runner.
- Game-day operations:
  - Real-time heat updates that push to athlete phones.
  - Floor views for head judge/floor manager (what’s happening now/next).

### 7.3 Score capture + verification (no more “typed wrong” podium theft)
- Score entry UX optimized for speed and accuracy.
- Verification workflow:
  - Scorecard photos attached to entries.
  - Validation checks (ranges, formatting, duplicates, anomalies).
  - “Pending verification” state before leaderboard publishes (configurable).
- Audit trail:
  - Who entered, who verified, who edited, when, and why.

### 7.4 Organizer admin (configuration that doesn’t punish you)
- Event setup:
  - Divisions, teams/individuals, workouts, scoring rules, tie-breakers.
  - Heats, lanes, venue stations, schedule publishing.
- Communication:
  - Broadcast announcements and targeted division updates.

### 7.5 Series mode (multi-location)
- One config → cascades to all venues (controlled rollout + overrides).
- Venue management:
  - Assign gyms to locations; capacity; timezone; local schedule constraints.
- Global leaderboard:
  - Aggregated results across venues + per-venue breakdown.
- Map view (post-MVP unless needed for sales):
  - “Which cities are hosting this comp?”

### 7.6 Reliability & resilience (must-have)
- Event-day status page + incident comms.
- Graceful degradation plan:
  - If venue internet is unstable, allow local buffering/queued submissions (implementation-dependent).
- Load testing targets defined per event size (see Open Questions).

---

## 8) MVP definition (what we ship to win the first paying comps)

### MVP audience
Organizers running a single-location competition (with a clear expansion path to series).

### MVP must ship (because these are the “ouch” points)
- **Athlete “My Division” view** + heat discovery that doesn’t suck
- **Push notifications** (60/30/10 + change alerts)
- **Score entry + verification workflow**
  - Attach scorecard photo
  - Prevent leaderboard publish until verified (configurable)
- **Transparent tie-breaker display**
  - Show computed tie-break values and rule text reference
- **Digital appeals**
  - Submit → track → decision with explanation
- **Volunteer/judge scheduling basics**
  - Availability + credential field (e.g., L2)
  - Assign to heats + printable/exportable schedule
- **Reliability baseline**
  - Defined uptime target for event windows + monitoring + rollback plan

### MVP explicitly not required
- Full “simulator” (nice-to-have, sales-driven)
- Map view
- Deep multi-location series tooling (phase 2)

---

## 9) MVP user stories (acceptance criteria level)

### Athlete
- As an athlete, I can open the app and see **only my division’s** workouts/heats.
- As an athlete, I receive push alerts at **60/30/10 minutes** and when my heat changes.
- As an athlete, I can open a leaderboard entry and see **tie-breaker math** (inputs + computed values).
- As an athlete, I can submit an appeal digitally and see status + final explanation.

### Organizer
- As an organizer, I can configure tie-breakers and have them display consistently.
- As an organizer, I can prevent unverified scores from publishing to the leaderboard.
- As an organizer, I can schedule judges by availability and credential and export/share the schedule.
- As an organizer, I can see an audit log for score edits and appeal decisions.

### Judge / score entry
- As a judge, I can submit a score quickly with minimal typing and attach a scorecard photo.
- As a score verifier, I can review pending scores, compare to photo, and approve/reject with reason.

---

## 10) Data & permissions (high-level)

### Core entities
- Event, Venue, Division, Athlete/Team, Workout/Event (competition event), Heat, Lane
- ScoreEntry, ScorecardAsset, VerificationStatus, AuditLog
- Appeal, AppealEvidence, AppealDecision
- Volunteer, Credential, Availability, Assignment (role + heat)

### Roles/permissions
- Athlete (read own division schedule + leaderboard; submit appeal)
- Judge (submit scores for assigned heats)
- Score verifier (approve/reject scores; edit with audit trail)
- Organizer/admin (configure event; publish schedule; manage staff; override)

---

## 11) Integrations (optional / later unless required for sales)
- Payments provider (table stakes; not a differentiator)
- SMS fallback for notifications (if push adoption is low)
- Export to CSV/Google Sheets for transitional workflows (reduce switching cost)

---

## 12) Risks & mitigations

- **Reliability risk (existential)**: outages ruin events.
  - Mitigation: event-window SLOs, load testing, staged rollouts, incident playbook, status page.
- **Operational complexity risk**: volunteer/judge scheduling gets hairy fast.
  - Mitigation: ship “80% scheduling” MVP; allow manual overrides; export/print; iterate with real events.
- **Trust risk**: if tie-breaker math is wrong once, you’re dead.
  - Mitigation: rules engine tests, auditability, “show the math,” seeded fixtures from real competitions.
- **Adoption risk**: organizers won’t switch mid-season.
  - Mitigation: migration tooling + concierge onboarding; “run one small event first” pathway.

---

## 13) Open questions (need answers before final MVP scope freeze)
- **Event size targets**: max athletes/divisions/heats we must support in MVP? (e.g., WaterPalooza scale vs typical local comp)
- **Offline requirements**: do venues need offline-first scoring, or is “spotty internet buffering” enough?
- **Appeals policy**: what decisions require human approval? Any auto-approval cases?
- **Notification channels**: push only, or push + SMS/email? What’s the fallback expectation?
- **Pricing**: will you compete on fee structure vs incumbents, or sell on ops/trust regardless of fees?
- **Series timeline**: how soon do we need multi-location to close Will/Fortitude-style deals?

---

## 14) Rollout plan (suggested)

### Phase 0 — Prototype + proof (now)
- Demo flows: athlete “my division,” heat alerts, score verification, tie-breaker transparency, digital appeals, basic scheduling.

### Phase 1 — MVP for first paying event
- Ship MVP must-haves.
- Run one real event end-to-end; capture failures; patch fast.

### Phase 2 — Series foundation
- One config → many venues.
- Global leaderboard + basic venue management.

---

## 15) Landing page PRD (what the homepage must do)

### Primary conversion
Organizer clicks **“Book a demo”** or **“Run your next comp on WODsmith”** (depending on sales motion).

### Secondary conversion
Athlete joins event / installs / enables notifications (only if it supports organizer conversion, not distracts).

### Above-the-fold requirements
- One sentence promise that names the villain:
  - Spreadsheet ops
  - Typos
  - Opaque tie-breakers
  - Paper heat sheets
- Proof nugget visible without scrolling (quote, customer logo, or “built with X organizers”).
- CTA with low ambiguity (“Book a demo” / “Start an event”) and friction clarifier (trial/no card/etc—if true).

### Section outline (minimum)
1. **Hero**: “Run a comp athletes trust—without spreadsheet ops.”
2. **Pain strip**: 4 bullets, written like real quotes (typos, appeals, heat chaos, volunteer spreadsheets).
3. **Two audiences**:
   - Athlete: heat notifications + my division view + tie-breaker transparency
   - Organizer: scheduling + verification + audit log
4. **How it prevents disasters**: verification + audit + transparent scoring + digital appeals.
5. **Volunteer/judge scheduling**: credential-based assignment + rotations + short-staff handling.
6. **Series teaser** (if selling): one config → many gyms + global leaderboard.
7. **Reliability**: uptime promise + “what happens if…” (operational trust).
8. **Proof**: quotes + “first paying customer” story + “if you need funding…” line (use responsibly).
9. **FAQ**: migration, pricing/fees, support, offline, appeals policy, notifications.
10. **Final CTA**: repeat primary CTA with a specific promise.

### Copy rules (so you don’t drift back into generic)
- Ban these phrases unless followed by proof:
  - “powerful tools,” “platform,” “efficient,” “robust,” “seamless,” “flexible”
- Every feature line must map to a comp-day moment:
  - “score typed wrong” → “verification before publish”
  - “dropdown hell” → “my division auto-filter”
  - “paper appeals” → “digital + explained”
  - “no volunteer tool” → “credential-based scheduling”

