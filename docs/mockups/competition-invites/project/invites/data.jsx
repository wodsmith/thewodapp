/* Shared data for the invite system prototype. Exports to window. */

// The championship being managed
const CHAMPIONSHIP = {
  id: "comp_mwfc_finals_2026",
  name: "MWFC Finals 2026",
  slug: "mwfc-finals-2026",
  date: "Aug 14–16, 2026",
  location: "Salt Lake City, UT",
  totalSpots: 40,
  divisions: [
    { id: "div_rxm", label: "RX Men", spots: 20 },
    { id: "div_rxw", label: "RX Women", spots: 20 },
  ],
};

// Qualification sources: a series (of 3 throwdowns) + a separate online qualifier
const SOURCES = [
  {
    id: "src_series",
    kind: "series",
    name: "Mountain West Throwdown Series",
    date: "Apr – Jul 2026",
    comps: [
      { id: "comp_mwt_denver", name: "Denver Throwdown", date: "Apr 12", athletes: 96, complete: true },
      { id: "comp_mwt_boise", name: "Boise Throwdown", date: "May 17", athletes: 88, complete: true },
      { id: "comp_mwt_slc", name: "SLC Throwdown", date: "Jul 5", athletes: 102, complete: true },
    ],
    // Each throwdown direct-qualifies N winners
    directSpotsPerComp: 3,
    // Series global leaderboard fills this many additional spots (skipping already-qualified)
    globalSpots: 6,
    allocated: 15, // 3 comps × 3 winners + 6 global = 15
  },
  {
    id: "src_online",
    kind: "competition",
    name: "Online Qualifier 2026",
    date: "Mar 1–21, 2026",
    athletes: 412,
    allocated: 5, // top 5 from the online qualifier
  },
];

// Division currently being managed in the UI
const CURRENT_DIVISION_LABEL = "RX Men";

// Athlete leaderboard for RX Men — sorted by qualification priority.
// Each has a `status` reflecting where they are in the invite pipeline.
// status values: accepted_paid, accepted, pending, declined, expired, not_invited
// round: which round they were sent in (null = not yet)
// source: where they qualified from (series-denver, series-boise, series-slc, series-global, online)
const ATHLETES = [
  // Series direct qualifiers (throwdown winners)
  { rank: 1, name: "Marcus Reinholt", affiliate: "CF Canvas · Salt Lake City", points: 300, source: "series-slc", sourceDetail: "1st — SLC Throwdown", status: "accepted_paid", round: 1, sentAt: "Jul 8", respondedAt: "Jul 10", avatar: "MR" },
  { rank: 2, name: "Trevor Nakashima", affiliate: "Foundry CrossFit · Boise", points: 295, source: "series-boise", sourceDetail: "1st — Boise Throwdown", status: "accepted_paid", round: 1, sentAt: "Jul 8", respondedAt: "Jul 9", avatar: "TN" },
  { rank: 3, name: "Dominic Ferraro", affiliate: "Mile High Fitness · Denver", points: 290, source: "series-denver", sourceDetail: "1st — Denver Throwdown", status: "accepted", round: 1, sentAt: "Jul 8", respondedAt: "Jul 11", avatar: "DF" },
  { rank: 4, name: "Elias Whitford", affiliate: "CF Canvas · Salt Lake City", points: 272, source: "series-slc", sourceDetail: "2nd — SLC Throwdown", status: "accepted_paid", round: 1, sentAt: "Jul 8", respondedAt: "Jul 12", avatar: "EW" },
  { rank: 5, name: "Jonah Castellanos", affiliate: "Foundry CrossFit · Boise", points: 268, source: "series-boise", sourceDetail: "2nd — Boise Throwdown", status: "pending", round: 1, sentAt: "Jul 8", respondedAt: null, avatar: "JC" },
  { rank: 6, name: "Harrison Mbeki", affiliate: "Mile High Fitness · Denver", points: 261, source: "series-denver", sourceDetail: "2nd — Denver Throwdown", status: "declined", round: 1, sentAt: "Jul 8", respondedAt: "Jul 9", avatar: "HM" },
  { rank: 7, name: "Parker Yumatov", affiliate: "Ironclad CrossFit · Bozeman", points: 255, source: "series-slc", sourceDetail: "3rd — SLC Throwdown", status: "accepted_paid", round: 1, sentAt: "Jul 8", respondedAt: "Jul 13", avatar: "PY" },
  { rank: 8, name: "Silas Korvan", affiliate: "Foundry CrossFit · Boise", points: 252, source: "series-boise", sourceDetail: "3rd — Boise Throwdown", status: "expired", round: 1, sentAt: "Jul 8", respondedAt: null, avatar: "SK" },
  { rank: 9, name: "Devonte Rahier", affiliate: "Mile High Fitness · Denver", points: 247, source: "series-denver", sourceDetail: "3rd — Denver Throwdown", status: "pending", round: 1, sentAt: "Jul 8", respondedAt: null, avatar: "DR" },

  // Series global leaderboard fills — top non-winners by total series points
  { rank: 10, name: "August Velkind", affiliate: "CF Canvas · Salt Lake City", points: 244, source: "series-global", sourceDetail: "Series GLB · 1st unqualified", status: "accepted", round: 2, sentAt: "Jul 18", respondedAt: "Jul 19", avatar: "AV" },
  { rank: 11, name: "Rohan Dasgupta", affiliate: "Summit Strength · Bend", points: 238, source: "series-global", sourceDetail: "Series GLB · 2nd unqualified", status: "accepted_paid", round: 2, sentAt: "Jul 18", respondedAt: "Jul 19", avatar: "RD" },
  { rank: 12, name: "Wyatt Brenneman", affiliate: "Ironclad CrossFit · Bozeman", points: 234, source: "series-global", sourceDetail: "Series GLB · 3rd unqualified", status: "pending", round: 2, sentAt: "Jul 18", respondedAt: null, avatar: "WB" },
  { rank: 13, name: "Kenji Morales", affiliate: "Foundry CrossFit · Boise", points: 229, source: "series-global", sourceDetail: "Series GLB · 4th unqualified", status: "declined", round: 2, sentAt: "Jul 18", respondedAt: "Jul 20", avatar: "KM" },
  { rank: 14, name: "Theo Vashchenko", affiliate: "CF Canvas · Salt Lake City", points: 221, source: "series-global", sourceDetail: "Series GLB · 5th unqualified", status: "pending", round: 2, sentAt: "Jul 18", respondedAt: null, avatar: "TV" },
  { rank: 15, name: "Langston Pryor", affiliate: "Mile High Fitness · Denver", points: 217, source: "series-global", sourceDetail: "Series GLB · 6th unqualified", status: "not_invited", round: null, sentAt: null, respondedAt: null, avatar: "LP" },

  // Online qualifier top 5 (separate source)
  { rank: 16, name: "Iver Ólafsson", affiliate: "Northforge · Spokane", points: 1842, source: "online", sourceDetail: "1st — Online Qualifier", status: "accepted_paid", round: 1, sentAt: "Mar 22", respondedAt: "Mar 23", avatar: "IO" },
  { rank: 17, name: "Cassius Nkwame", affiliate: "Vertex CF · Cheyenne", points: 1821, source: "online", sourceDetail: "2nd — Online Qualifier", status: "accepted", round: 1, sentAt: "Mar 22", respondedAt: "Mar 24", avatar: "CN" },
  { rank: 18, name: "Bastian Krüger", affiliate: "Ironclad CrossFit · Bozeman", points: 1815, source: "online", sourceDetail: "3rd — Online Qualifier", status: "declined", round: 1, sentAt: "Mar 22", respondedAt: "Mar 23", avatar: "BK" },
  { rank: 19, name: "Xavier Delacroix", affiliate: "Foundry CrossFit · Boise", points: 1808, source: "online", sourceDetail: "4th — Online Qualifier", status: "expired", round: 1, sentAt: "Mar 22", respondedAt: null, avatar: "XD" },
  { rank: 20, name: "Maddox Whelan", affiliate: "Summit Strength · Bend", points: 1799, source: "online", sourceDetail: "5th — Online Qualifier", status: "pending", round: 1, sentAt: "Mar 22", respondedAt: null, avatar: "MW" },

  // Next in line — not yet invited (waitlist below the line)
  { rank: 21, name: "Noah Castellanos", affiliate: "Mile High Fitness · Denver", points: 1792, source: "online", sourceDetail: "6th — Online Qualifier", status: "not_invited", round: null, sentAt: null, respondedAt: null, avatar: "NC" },
  { rank: 22, name: "Orion Sato", affiliate: "CF Canvas · Salt Lake City", points: 1781, source: "online", sourceDetail: "7th — Online Qualifier", status: "not_invited", round: null, sentAt: null, respondedAt: null, avatar: "OS" },
  { rank: 23, name: "Fenn Halvorson", affiliate: "Summit Strength · Bend", points: 1769, source: "online", sourceDetail: "8th — Online Qualifier", status: "not_invited", round: null, sentAt: null, respondedAt: null, avatar: "FH" },
  { rank: 24, name: "Aurelio Maestas", affiliate: "Vertex CF · Cheyenne", points: 1752, source: "online", sourceDetail: "9th — Online Qualifier", status: "not_invited", round: null, sentAt: null, respondedAt: null, avatar: "AM" },
  { rank: 25, name: "Caspian Reeve", affiliate: "Northforge · Spokane", points: 1741, source: "online", sourceDetail: "10th — Online Qualifier", status: "not_invited", round: null, sentAt: null, respondedAt: null, avatar: "CR" },
  { rank: 26, name: "Emeric Vance", affiliate: "Ironclad CrossFit · Bozeman", points: 1728, source: "online", sourceDetail: "11th — Online Qualifier", status: "not_invited", round: null, sentAt: null, respondedAt: null, avatar: "EV" },
  { rank: 27, name: "Thaddeus Ono", affiliate: "Mile High Fitness · Denver", points: 1719, source: "online", sourceDetail: "12th — Online Qualifier", status: "not_invited", round: null, sentAt: null, respondedAt: null, avatar: "TO" },
  { rank: 28, name: "Lionel Beauchamp", affiliate: "Foundry CrossFit · Boise", points: 1704, source: "online", sourceDetail: "13th — Online Qualifier", status: "not_invited", round: null, sentAt: null, respondedAt: null, avatar: "LB" },
];

// Historical rounds
const ROUNDS = [
  {
    id: "r1",
    number: 1,
    label: "Round 1 — Guaranteed",
    subject: "You're invited to MWFC Finals 2026",
    tone: "guaranteed",
    sentAt: "Jul 8, 2026 · 9:02 AM",
    sentBy: "Jordan Tessmer",
    rsvpDeadline: "Jul 15, 2026",
    recipients: 14,
    accepted: 7,
    paid: 6,
    declined: 2,
    pending: 3,
    expired: 2,
  },
  {
    id: "r2",
    number: 2,
    label: "Round 2 — Series Global",
    subject: "A spot has opened at MWFC Finals 2026",
    tone: "opened",
    sentAt: "Jul 18, 2026 · 2:41 PM",
    sentBy: "Jordan Tessmer",
    rsvpDeadline: "Jul 22, 2026",
    recipients: 5,
    accepted: 2,
    paid: 1,
    declined: 1,
    pending: 2,
    expired: 0,
  },
];

// Draft for the next round
const DEFAULT_DRAFT_ROUND = {
  number: 3,
  label: "Round 3 — Wildcard Wave",
  tone: "limited",
  rsvpDays: 4,
  subject: "Invitations now open: secure your spot at MWFC Finals 2026",
};

// Email templates by tone
const EMAIL_TEMPLATES = {
  guaranteed: {
    badge: "GUARANTEED SPOT",
    badgeColor: "emerald",
    headline: "You earned a spot at MWFC Finals 2026.",
    lede: "Congratulations — your finish at {source} has qualified you directly. A spot has been reserved in your name.",
    cta: "Claim your spot",
    footer: "Spot held until {deadline}. After that, your reservation may be offered to another athlete.",
  },
  opened: {
    badge: "INVITATION OPENED",
    badgeColor: "orange",
    headline: "A spot has opened at MWFC Finals 2026.",
    lede: "Based on your result in {source}, we're opening an invitation to you. Spots are limited, but yours is reserved as long as you claim it by the deadline.",
    cta: "Claim your spot",
    footer: "Spot reserved until {deadline}. First come, first served after that.",
  },
  limited: {
    badge: "WILDCARD WAVE — LIMITED",
    badgeColor: "amber",
    headline: "Invitations are now open to the next wave.",
    lede: "Previous rounds left a handful of spots unclaimed. You're one of the next athletes we'd like to see at Finals, but a spot is no longer guaranteed — tickets are available on a first-come, first-served basis.",
    cta: "Grab a spot",
    footer: "Spots close when Finals sells out, or by {deadline}, whichever comes first.",
  },
};

// Acceptance stats derived
function deriveStats(athletes, total) {
  const invited = athletes.filter((a) => a.status !== "not_invited").length;
  const accepted = athletes.filter((a) => a.status === "accepted" || a.status === "accepted_paid").length;
  const paid = athletes.filter((a) => a.status === "accepted_paid").length;
  const declined = athletes.filter((a) => a.status === "declined").length;
  const pending = athletes.filter((a) => a.status === "pending").length;
  const expired = athletes.filter((a) => a.status === "expired").length;
  return {
    invited,
    accepted,
    paid,
    declined,
    pending,
    expired,
    remaining: total - paid,
    fillPct: Math.round((paid / total) * 100),
  };
}

Object.assign(window, {
  CHAMPIONSHIP,
  SOURCES,
  CURRENT_DIVISION_LABEL,
  ATHLETES,
  ROUNDS,
  DEFAULT_DRAFT_ROUND,
  EMAIL_TEMPLATES,
  deriveStats,
});
