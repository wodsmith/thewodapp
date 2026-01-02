# Organizer Scoring Configuration Guide

This guide explains how to configure competition scoring in the organizer dashboard.

## Overview

The scoring configuration determines how athletes are ranked and awarded points during your competition. You can access these settings from **Organizer Dashboard → Settings → Scoring Configuration**.

## Scoring Algorithms

### Traditional Scoring (Default)

The most common scoring method. Athletes receive points based on placement:

- **First Place**: 100 points (configurable)
- **Each subsequent place**: Decreases by a fixed step (default: 5 points)

**Example with step = 5:**
| Place | Points |
|-------|--------|
| 1st   | 100    |
| 2nd   | 95     |
| 3rd   | 90     |
| 4th   | 85     |
| ...   | ...    |

**When to use:** Most competitions, especially those with many events where consistent placement-based scoring is desired.

**Configuration:**
- **Step**: How many points to decrease per place (1-20)
- Higher step = more dramatic point differences between places

---

### P-Score (Performance-Based)

Rewards athletes based on their *margin of victory*, not just placement. An athlete who wins by a large margin earns significantly more points than a narrow victory.

**How it works:**
- First place = 100 points
- Median performer (top half) = 50 points
- Below median = negative points possible

**Key features:**
- Rewards dominant performances
- Negative scores are normal (athletes below median)
- Final overall scores can be negative

**When to use:** Competitions that want to reward dominant performances and have a wider gap between top performers and the field.

**Configuration:**
- **Allow negative scores**: Toggle whether sub-median athletes can have negative event scores
- **Median calculation**: Use "Top Half" (recommended) or "All competitors"

---

### Custom Scoring

Start from a template and customize points for specific placements.

**Templates available:**
| Template | Description |
|----------|-------------|
| Traditional | Standard step-based (100, 95, 90...) |
| P-Score | Performance-based template |
| Winner Takes More | Front-loaded (100, 85, 75, 67...) |

**Customization:**
1. Select a base template
2. Click "Edit Points Table..."
3. Override specific place values
4. Custom values are highlighted for easy identification
5. Use "Reset" to revert individual places or "Reset All" for the entire table

---

## Tiebreaker Configuration

When athletes have the same total points, tiebreakers determine final rankings.

### Primary Tiebreaker: Countback (Recommended)

Compares the number of top placements:
1. Who has more **1st places**?
2. If tied, who has more **2nd places**?
3. Continue until the tie is broken

### Secondary Tiebreaker: Head-to-Head (Optional)

If countback doesn't break the tie:
- Compare athletes' performance on a designated event
- Select the event when enabling head-to-head

**Use case:** Finals or a signature event that should be the ultimate decider.

---

## DNF/DNS/Withdrawn Handling

Configure how non-standard results affect scoring:

### DNF (Did Not Finish)
| Option | Description |
|--------|-------------|
| **Last Place** (default) | Receive last place points (same as slowest finisher) |
| **Zero Points** | Receive 0 points for the event |
| **Worst Performance** | Calculate based on worst completed performance |

### DNS (Did Not Start)
| Option | Description |
|--------|-------------|
| **Zero Points** (default) | Receive 0 points |
| **Exclude** | Not counted in event (as if not registered) |
| **Worst Performance** | Calculate based on worst completed performance |

### Withdrawn
| Option | Description |
|--------|-------------|
| **Exclude** (default) | Removed from all event rankings |
| **Zero Points** | Keep in rankings with 0 points |

---

## Quick Start Recommendations

### Small Local Competitions (< 20 athletes)
- **Algorithm**: Traditional with step = 5
- **Tiebreaker**: Countback only
- **DNF**: Last place

### Large Competitions (50+ athletes)
- **Algorithm**: Traditional with step = 3-5
- **Tiebreaker**: Countback + Head-to-head on final event
- **DNF**: Last place

### Elite/Sanctioned Events
- **Algorithm**: P-Score for performance differentiation
- **Tiebreaker**: Countback + Head-to-head
- **DNF**: Worst performance

### Custom/Unique Formats
- **Algorithm**: Custom (based on Winner Takes More)
- Override top 3 placements for bonus points
- Adjust based on event importance

---

## Viewing Scoring in Action

Once configured, the scoring is reflected in:
- **Leaderboard page**: Shows total points with algorithm badge
- **Per-event results**: Shows rank and points earned
- **P-Score display**: Positive scores shown in green, negative in red

---

## Changing Scoring Mid-Competition

You can update scoring configuration at any time. Changes take effect immediately and recalculate all leaderboards.

**Warning:** Significant scoring changes during a competition may confuse athletes. Consider:
- Communicating changes to all participants
- Making changes between competition days if possible
- Testing with a small event first

---

## FAQ

**Q: Can I have different scoring per division?**  
A: Currently, scoring is competition-wide. Division-specific scoring is planned for a future update.

**Q: How do points multipliers work with scoring?**  
A: Event points multipliers (set in Programming → Events) are applied after the base algorithm calculates points. A 2x multiplier doubles all points for that event.

**Q: What happens if I don't configure scoring?**  
A: Traditional scoring with step = 5 is used by default.

**Q: Can athletes see the scoring configuration?**  
A: The algorithm type is shown as a badge on the leaderboard. Detailed configuration is only visible to organizers.
