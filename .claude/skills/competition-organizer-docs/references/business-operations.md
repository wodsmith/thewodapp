# Business Operations Workflows

Workflows for revenue, sponsors, and competition series.

## 1. Track Revenue

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/revenue` |
| **Complexity** | Low |
| **Doc Type** | How-to |
| **Prerequisites** | Registrations processed |

### Key Components
- `RevenuesDashboard` - Revenue overview
- `TransactionList` - Payment history
- `RefundTracker` - Refund management
- `RevenueExport` - Financial exports

### User Actions
1. View revenue summary
2. Track payments by division
3. Monitor refunds
4. Export financial reports
5. Reconcile with Stripe

### Documentation Requirements

**How-to Focus:**
- Export revenue report
- Reconcile with Stripe dashboard

---

## 2. Manage Sponsors

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/sponsors` |
| **Complexity** | Low |
| **Doc Type** | How-to |
| **Prerequisites** | Competition created |

### Key Components
- `SponsorManager` - Sponsor CRUD
- `SponsorTier` - Sponsorship levels
- `LogoUploader` - Brand asset management

### User Actions
1. Add sponsors
2. Configure sponsorship tiers
3. Upload sponsor logos
4. Set display order
5. Link sponsor websites

---

## 3. Competition Series

| Attribute | Value |
|-----------|-------|
| **Route** | `/series/` routes |
| **Complexity** | Low |
| **Doc Type** | How-to |
| **Prerequisites** | Multiple competitions created |

### Key Components
- `SeriesManager` - Series configuration
- `SeriesLeaderboard` - Aggregate standings
- `SeriesCompetitions` - Competition linking

### User Actions
1. Create series
2. Link existing competitions
3. Configure series scoring
4. View aggregate leaderboard

---

## CI Change Detection

```yaml
triggers:
  "src/app/(main)/compete/$competitionId/revenue/**":
    workflows: [track-revenue]
    priority: low

  "src/app/(main)/compete/$competitionId/sponsors/**":
    workflows: [manage-sponsors]
    priority: low

  "src/app/(main)/series/**":
    workflows: [competition-series]
    priority: low
```
