I'll fetch both documents to understand your platform and tech stack, then provide targeted improvements to the plan.The GitHub pages aren't rendering the raw content. Since I can't access the private repo directly, let me work with what you've provided in the attached plan and give you concrete improvements based on my knowledge of your stack (React/Next.js, likely TanStack Query based on the plan's suggestions).

---

## Updated Plan: Score Entry UX for Competition Volunteers

The attached plan is solid—stream-based queue, optimistic UI, auto-advance—but I'd sharpen it in a few areas based on real competition chaos.

### 1. Input Speed: The 80% Case

The plan suggests auto-formatting `1234` → `12:34`. Go further:

**Single-field smart parsing** that handles all workout types:
- `345` → `3:45` (time)
- `150` → `150 reps` (AMRAP)
- `225` → `225 lbs` (max load)
- `cap` or `c` → Time cap reached (common shorthand)
- `dns` → Did Not Start
- `dnf` → Did Not Finish

The workout type (For Time, AMRAP, Max Load) should drive the parser. No mode switching for the volunteer.

**Tab-to-advance with auto-save**: When they press Tab to move to the next athlete, persist that score immediately (not just on "Save Heat"). This protects against browser crashes and lets another volunteer pick up mid-heat if needed.

### 2. Error Prevention Over Error Correction

The plan mentions "Low score detected" warnings. Make these **blocking for outliers but dismissable**:

- If a score is >2 standard deviations from the division mean (calculated from completed heats), require a confirmation tap. Not a modal—just turn the row yellow and require a second Enter.
- **Lane mismatch protection**: If the athlete in Lane 3 on the scorecard doesn't match Lane 3 in the system (because someone moved lanes), surface this prominently. A small "Swap lanes" action beats re-entering.

### 3. The Division Crossover (Critical UX Moment)

The plan mentions a toast when switching divisions. I'd go stronger:

**Full-screen interstitial for 2 seconds** showing:
- "Now entering: Women's Scaled"
- The time cap / rep scheme if it differs
- A distinct color that persists in the header for this division

Volunteers enter hundreds of scores. Mental model drift is real. A toast is too easy to miss.

### 4. Offline-First Architecture

The plan suggests `localStorage` for draft state. Given venue WiFi realities, I'd build this as **offline-default**:

- Use a service worker + IndexedDB (or `@tanstack/query-persist-client` with IndexedDB adapter)
- Queue all writes locally first
- Sync in background when online
- Show a persistent "X scores pending sync" badge when offline
- **Never block the volunteer on network**

This is the single biggest improvement for competition-day reliability.

### 5. Coordinator Override Mode

The plan focuses on the volunteer flow. Add a **Coordinator View** toggle that shows:
- All heats across all divisions in a master timeline
- Which heats have pending/unsaved scores
- Ability to "lock" a heat (prevent further edits after review)
- Quick "republish leaderboard" action

This separation keeps the volunteer UI fast and simple while giving the head judge control.

### 6. API Contract with Heat Scheduling Co-worker

The plan mentions asking for `nextHeatId`. Expand this to a proper contract:

```typescript
interface HeatWithContext {
  id: string;
  workoutId: string;
  divisionId: string;
  divisionName: string;
  heatNumber: number;
  totalHeatsInDivision: number;
  scheduledStartTime: string;
  status: 'upcoming' | 'active' | 'scoring' | 'complete';
  athletes: AthleteInHeat[];
  nextHeatId: string | null;
  previousHeatId: string | null;
  isDivisionCrossover: boolean; // true if nextHeat is different division
}
```

That `isDivisionCrossover` flag lets your UI trigger the interstitial without client-side logic.

### 7. Keyboard-First, Touch-Optimized

For tablets at the scoring desk:

- Large touch targets (48px minimum)
- Number pad overlay for score entry (no system keyboard)
- Swipe gestures: swipe right on an athlete row to mark DNS, swipe left for DNF

For laptop/desktop:
- Full keyboard navigation (arrow keys to move between athletes, Enter to confirm, Escape to cancel)
- Hotkeys visible in a small overlay (toggle with `?`)

### 8. Tie-Break Handling

The plan mentions showing tie-break fields conditionally. Be explicit:

- For "For Time" workouts with a cap: if athlete hits cap, auto-expand "Reps completed" field
- For AMRAPs: always show tie-break time field, but make it optional with smart defaults (if left blank, assume last second of cap)
- Visual indicator on leaderboard showing when tie-break was used to determine placement

---

### Implementation Priority

If you're time-constrained, ship in this order:

1. **Smart single-field input parser** (biggest speed win)
2. **Tab-to-advance with auto-persist** (data safety)
3. **Offline queue with sync indicator** (reliability)
4. **Division crossover interstitial** (accuracy)
5. **Coordinator override view** (control)

Want me to sketch out the React component structure or the Zod schemas for the different workout types?

This is an exhaustive set of ASCII wireframes covering the entire **Score Entry Volunteer** flow, incorporating the "Smart Input," "Offline-First," and "Division Crossover" logic.

### 1\. Global Header & Persistent Status

*Visible on all screens (except Interstitials).*

```text
+-----------------------------------------------------------------------+
|  [WODSMITH LOGO]     EVENT: The Fran-off (2025)        [Wifi: OFF]    |
|                                                        [3 Pending ^]  |
+-----------------------------------------------------------------------+
```

  * **UX Note:** The "3 Pending" badge is the offline-first indicator. It turns Green/Checkmark when the background sync (TanStack Query) clears the queue.

-----

### 2\. The Dashboard (The Heat Queue)

*The default view when a volunteer logs in. It visualizes the "Stream."*

```text
+-----------------------------------------------------------------------+
|  Global Header ...                                                    |
+-----------------------------------------------------------------------+
|  FILTER: [ All Divisions v ] [ Upcoming Only ]                        |
|                                                                       |
|  -------------------------------------------------------------------  |
|  DIVISION: MEN'S RX                                                   |
|  -------------------------------------------------------------------  |
|                                                                       |
|  [ HEAT 1 ]   09:00 AM   [ COMPLETED ]  [ Locked (Padlock Icon) ]     |
|  > 10/10 Scores Submitted                                             |
|                                                                       |
|  [ HEAT 2 ]   09:15 AM   [ SCORING ]    <-- CURRENTLY ACTIVE          |
|  > 8/10 Scores | LAST UPDATE: 12s ago by You                          |
|  [ RESUME SCORING > ]                                                 |
|                                                                       |
|  [ HEAT 3 ]   09:30 AM   [ UPCOMING ]                                 |
|  > 10 Athletes                                                        |
|                                                                       |
|  -------------------------------------------------------------------  |
|  DIVISION: WOMEN'S RX                                                 |
|  -------------------------------------------------------------------  |
|                                                                       |
|  [ HEAT 1 ]   09:45 AM   [ UPCOMING ]                                 |
|  > 10 Athletes                                                        |
|                                                                       |
+-----------------------------------------------------------------------+
|  [ SWITCH TO COORDINATOR VIEW ]                         [ REFRESH ]   |
+-----------------------------------------------------------------------+
```

-----

### 3\. Active Heat View (The Workhorse)

*This is where 90% of the time is spent. Optimizing for "Head Down, Typing Fast."*

**Scenario:** Event 1 (For Time, Cap 15:00).

```text
+-----------------------------------------------------------------------+
|  < Back to Queue   |  HEAT 2 (Men's Rx)  |  CAP: 15:00                |
+-----------------------------------------------------------------------+
|  LANE  | ATHLETE          | SCORE INPUT       | TIE-BREAK | STATUS    |
+--------+------------------+-------------------+-----------+-----------+
|   1    | Smith, John      | [ 12:34      ]    | [ --:-- ] | (Saved)   |
|        |                  | *Rank: 2nd* |           |           |
+--------+------------------+-------------------+-----------+-----------+
|   2    | Doe, David       | [ CAP        ]    | [ 14:50 ] | (Saved)   |
|        |                  | *Rank: 12th* |           |           |
+--------+------------------+-------------------+-----------+-----------+
|   3    | Jenkins, A.      | [ 930_______ ]    | [       ] | Typing... |
|        | *Warning: Fast!* | (Auto: 09:30)     |           |           |
+--------+------------------+-------------------+-----------+-----------+
|   4    | Miller, B.       | [ DNS        ]    | [  N/A  ] | (Saved)   |
+--------+------------------+-------------------+-----------+-----------+
|   5    | Empty Lane       | [ ---        ]    | [  ---  ] |           |
+--------+------------------+-------------------+-----------+-----------+
|   6    | Fisher, T.       | [            ]    | [       ] | Pending   |
+--------+------------------+-------------------+-----------+-----------+
| ... (Lanes 7-10)                                                      |
+-----------------------------------------------------------------------+
| [ MARK ALL REMAINING AS DNS ]                [ SUBMIT & NEXT HEAT > ] |
+-----------------------------------------------------------------------+
```

  * **Smart Input Behavior:** User types `930` in Lane 3. The UI previews `09:30`.
  * **Tab Behavior:** Pressing `Tab` moves from Lane 3 Score -\> Lane 3 Tie-Break (if applicable) -\> Lane 4 Score.
  * **Tie-Break Logic:** Lane 2 entered "CAP" (or 15:00), so the Tie-Break field *enabled* automatically to ask for "Reps Completed" or "Split Time" (depending on workout config).

-----

### 4\. Smart Validation & Outliers

*The "Yellow Row" state when a score looks wrong.*

```text
+-----------------------------------------------------------------------+
|   3    | Jenkins, A.      | [ 2:00       ]    | [       ] | ! CHECK   |
+--------+------------------+-------------------+-----------+-----------+
|        | /!\ ALERT: Score is >2 SD faster than division avg (08:45)   |
|        | [ CONFIRM 2:00 ]   [ EDIT ]                                  |
+--------+------------------+-------------------+-----------+-----------+
```

  * **Interaction:** The user cannot `Tab` past this. They must explicitly hit `Enter` on "Confirm" or click it. This prevents "autopilot" errors.

-----

### 5\. Lane Mismatch / Swap Modal

*Triggered if the volunteer notices the athlete in Lane 3 is actually "Bill" not "Jenkins".*

```text
+-----------------------------------------------------------------------+
|  [ CLICKED ATHLETE NAME: Jenkins, A. ]                                |
+-----------------------------------------------------------------------+
|  Change Athlete for Lane 3?                                           |
|                                                                       |
|  [ SEARCH FOR ATHLETE...     ]                                        |
|                                                                       |
|  Common Fixes:                                                        |
|  [ SWAP WITH LANE 2 (Doe, David) ]                                    |
|  [ SWAP WITH LANE 4 (Miller, B.) ]                                    |
|  [ MARK AS SUBSTITUTION ]                                             |
|                                                                       |
|                              [ Cancel ]  [ Update Lane ]              |
+-----------------------------------------------------------------------+
```

-----

### 6\. The Division Crossover Interstitial

*The "Full Screen Blocking" Moment when moving from Men's Rx (Heat 10) to Women's Rx (Heat 1).*

```text
#########################################################################
#                                                                       #
#                 WARNING: DIVISION CHANGE DETECTED                     #
#                                                                       #
#                 PREVIOUS: Men's Rx                                    #
#                 NEXT:     WOMEN'S SCALED                              #
#                                                                       #
#########################################################################
#                                                                       #
#   STANDARDS REMINDER:                                                 #
#   - Barbell Weight: 95 lbs (Was 135 lbs)                              #
#   - Box Height: 20 inches                                             |
#   - Time Cap: REMAINS 15:00                                           #
#                                                                       #
#########################################################################
#                                                                       #
#                   [  I UNDERSTAND - START HEAT 1  ]                   #
#                 (Button disabled for 2 seconds)                       #
#                                                                       #
#########################################################################
```

-----

### 7\. Tablet / Mobile Touch Input Overlay

*When the screen width is small (or detected as tablet), the keyboard is suppressed in favor of this overlay.*

```text
+-----------------------------------------------------------------------+
| Lane 3: Jenkins, A.       [ 1234__ ]  (12:34)                         |
+-----------------------------------------------------------------------+
| +-------+ +-------+ +-------+  +-------------------+                  |
| |   1   | |   2   | |   3   |  |   STATUS: DNS     | (Did not start)  |
| +-------+ +-------+ +-------+  +-------------------+                  |
| +-------+ +-------+ +-------+  +-------------------+                  |
| |   4   | |   5   | |   6   |  |   STATUS: DNF     | (Did not finish) |
| +-------+ +-------+ +-------+  +-------------------+                  |
| +-------+ +-------+ +-------+  +-------------------+                  |
| |   7   | |   8   | |   9   |  |   STATUS: CAP     | (Time Cap)       |
| +-------+ +-------+ +-------+  +-------------------+                  |
| +-------+ +-------+ +-------+  +-------------------+                  |
| |  DEL  | |   0   | | NEXT >|  |   HIDE KEYPAD     |                  |
| +-------+ +-------+ +-------+  +-------------------+                  |
+-----------------------------------------------------------------------+
```

-----

### 8\. Coordinator Override View

*Accessible via the toggle in the Dashboard. Allows the "Head Judge" to fix disasters.*

```text
+-----------------------------------------------------------------------+
|  COORDINATOR MODE  [X] Close                                          |
+-----------------------------------------------------------------------+
|  Global Actions:                                                      |
|  [ FORCE SYNC ALL (3) ]   [ EXPORT CSV ]   [ RE-CALCULATE RANKS ]     |
+-----------------------------------------------------------------------+
|  Heat Management:                                                     |
|                                                                       |
|  MEN'S RX                                                             |
|  [ ] Heat 1  [ COMPLETED ]  [ UNLOCK ] (Allows edits)                 |
|  [ ] Heat 2  [ SCORING   ]  [ TAKE OVER ] (Force logout volun.)       |
|  [ ] Heat 3  [ UPCOMING  ]  [ ASSIGN TABLET 4 ]                       |
|                                                                       |
|  WOMEN'S SCALED                                                       |
|  [ ] Heat 1  [ UPCOMING  ]  [ EDIT LANE ASSIGNMENTS ]                 |
+-----------------------------------------------------------------------+
```

Mixed division in a heat consideration:

This adds significant complexity because you can no longer assume a single set of validation rules (Time Cap, Rep Scheme, Weights) applies to the entire screen. "Mixed Heats" usually happen at the end of a competition day to save time, or in smaller competitions.

Here is the **Updated UX** to handle Mixed Divisions without confusing the volunteer.

### Key Changes

1.  **Per-Row Context**: The "Division" is now a critical column in the Active Heat view.
2.  **Visual Grouping**: Athletes should ideally be sorted by Lane, but visually "chunked" or color-coded if possible (though Lane sort priority must win).
3.  **Dynamic Validation**: The "Low Score" warning system must check the *athlete's* division ID, not the *heat's* context.

### 1\. Updated Dashboard (The Queue)

*Note the "Mixed" tag on Heat 10.*

```text
+-----------------------------------------------------------------------+
|  Global Header ...                                                    |
+-----------------------------------------------------------------------+
|  FILTER: [ All Divisions v ]                                          |
|  -------------------------------------------------------------------  |
|  DIVISION: MEN'S RX                                                   |
|  -------------------------------------------------------------------  |
|  [ HEAT 8 ]   09:00 AM   [ COMPLETED ]                                |
|  [ HEAT 9 ]   09:15 AM   [ SCORING   ]                                |
|                                                                       |
|  -------------------------------------------------------------------  |
|  MIXED HEAT (Transition)                                              |
|  -------------------------------------------------------------------  |
|  [ HEAT 10 ]  09:30 AM   [ UPCOMING ]  [ ! MIXED DIVISIONS ]          |
|  > Contains: Men's Rx (3), Men's Scaled (7)                           |
|                                                                       |
|  -------------------------------------------------------------------  |
|  DIVISION: MEN'S SCALED                                               |
|  -------------------------------------------------------------------  |
|  [ HEAT 11 ]  09:45 AM   [ UPCOMING ]                                 |
+-----------------------------------------------------------------------+
```

### 2\. Active Heat View (Mixed Mode)

*This is the most critical screen. It needs to clearly differentiate the standards.*

**Scenario:** Lanes 1-3 are "Men's Rx" (doing 135lbs, 15:00 cap). Lanes 4-6 are "Men's Scaled" (doing 95lbs, 12:00 cap).

```text
+-----------------------------------------------------------------------+
|  < Back     HEAT 10 (Mixed)        [ ! ] 2 Standards Active           |
+-----------------------------------------------------------------------+
|  LANE  | ATHLETE          | DIV     | SCORE INPUT       | STATUS      |
+--------+------------------+---------+-------------------+-------------+
|   1    | Smith, John      | [ RX ]  | [ 14:00      ]    | (Saved)     |
|        |                  |         | *Rank: 14th* |             |
+--------+------------------+---------+-------------------+-------------+
|   2    | Doe, David       | [ RX ]  | [ CAP (15:00)]    | (Saved)     |
|        |                  |         | Tie-break: 120    |             |
+--------+------------------+---------+-------------------+-------------+
|   3    | Jenkins, A.      | [ RX ]  | [ DNS        ]    | (Saved)     |
+--------+------------------+---------+-------------------+-------------+
|------------------------ DIV BREAK (Visual Line) ----------------------|
|   4    | Miller, B.       | [ SC ]  | [ CAP (12:00)]    | Typing...   |
|        |                  |         | *Alert: diff cap* |             |
+--------+------------------+---------+-------------------+-------------+
|   5    | Fisher, T.       | [ SC ]  | [            ]    | Pending     |
+--------+------------------+---------+-------------------+-------------+
|   6    | Evans, C.        | [ SC ]  | [            ]    | Pending     |
+--------+------------------+---------+-------------------+-------------+
| [ MARK ALL REMAINING AS DNS ]                [ SUBMIT & NEXT HEAT > ] |
+-----------------------------------------------------------------------+
```

### 3\. Smart Input & Validation (Mixed Context)

The logic for your "Smart Input" must now be row-aware.

  * **Lane 2 (Rx):** User types `c` or `cap`.
      * System inputs: `15:00` (Because Rx Cap is 15:00).
  * **Lane 4 (Scaled):** User types `c` or `cap`.
      * System inputs: `12:00` (Because Scaled Cap is 12:00).

**Wireframe Detail: The "Standards" Pop-over**
*Since the header can't list all standards, add a "Quick Info" icon per row or at the top.*

```text
+-----------------------------------------------------------------------+
|  [?] Standards Legend (Click to View)                                 |
+-----------------------------------------------------------------------+
|  [ RX ] Men's Rx                                                      |
|  - Thrusters @ 135lbs                                                 |
|  - Cap: 15:00                                                         |
|                                                                       |
|  [ SC ] Men's Scaled                                                  |
|  - Thrusters @ 95lbs                                                  |
|  - Cap: 12:00                                                         |
+-----------------------------------------------------------------------+
```

### 4\. Technical Implication: The "Heat" Object

Your co-worker's API response for a `Heat` needs to change. It can't just have `divisionId` at the root level anymore. It needs to be an array of athletes, where *each athlete* carries their division metadata (or a `divisions` map).

**Suggested Data Structure:**

```typescript
interface Heat {
  id: string;
  name: "Heat 10";
  isMixed: boolean;
  // Map of standards referenced by divisionId
  standardsConfig: {
    "div_rx": { timeCap: 900, load: 135 },
    "div_scaled": { timeCap: 720, load: 95 }
  };
  athletes: Array<{
    lane: number;
    name: "John Doe";
    divisionId: "div_rx"; // <--- Critical for validation
    divisionBadge: "RX";  // <--- UI Label
  }>
}
```