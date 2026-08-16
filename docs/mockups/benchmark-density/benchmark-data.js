// Research snapshot captured from the live demo on 2026-08-15. Production
// renders database workouts and owns classification in BenchmarkWorkoutDirectory.
window.DOMAIN_META = {
  "Strength & barbell": { short: "Strength", tone: "ember", description: "Presses, pulls, squats and Olympic lifts", order: 1 },
  "Gymnastics & skill": { short: "Gymnastics", tone: "sky", description: "Bodyweight strength, control and skill", order: 2 },
  "Machines & rope": { short: "Machines", tone: "lime", description: "Bike, ski and rope capacity", order: 3 },
  "Mixed tests": { short: "Mixed", tone: "violet", description: "Multi-modal competition tests", order: 4 },
  Running: { short: "Running", tone: "sand", description: "Short speed through long aerobic work", order: 5 },
  Rowing: { short: "Rowing", tone: "cyan", description: "Sprint, middle and long distance", order: 6 },
  "CrossFit benchmarks": { short: "Classics", tone: "rose", description: "Girls, heroes and Open tests", order: 7 },
  "Other benchmarks": { short: "Other", tone: "rose", description: "Benchmarks outside the established domains", order: 8 },
}

window.BENCHMARKS = [
  { name: "Strict Press", domain: "Strength & barbell", result: "Load", pattern: "Press" },
  { name: "Push Press", domain: "Strength & barbell", result: "Load", pattern: "Press" },
  { name: "Bench Press", domain: "Strength & barbell", result: "Load", pattern: "Press" },
  { name: "Deadlift", domain: "Strength & barbell", result: "Load", pattern: "Pull" },
  { name: "Power Snatch", domain: "Strength & barbell", result: "Load", pattern: "Olympic" },
  { name: "Squat Snatch", domain: "Strength & barbell", result: "Load", pattern: "Olympic" },
  { name: "Power Clean", domain: "Strength & barbell", result: "Load", pattern: "Olympic" },
  { name: "Squat Clean", domain: "Strength & barbell", result: "Load", pattern: "Olympic" },
  { name: "Clean & Jerk", domain: "Strength & barbell", result: "Load", pattern: "Olympic" },
  { name: "Front Squat", domain: "Strength & barbell", result: "Load", pattern: "Squat" },
  { name: "Back Squat", domain: "Strength & barbell", result: "Load", pattern: "Squat" },
  { name: "Overhead Squat", domain: "Strength & barbell", result: "Load", pattern: "Squat" },
  { name: "Max Reps Bench (225/155)", domain: "Strength & barbell", result: "Reps", pattern: "Press" },
  { name: "20 Rep Back Squat (lb)", domain: "Strength & barbell", result: "Load", pattern: "Squat" },
  { name: "Gwen in 10:00 (lb)", domain: "Strength & barbell", result: "Load", pattern: "Olympic" },
  { name: "Max Strict Pull Up", domain: "Gymnastics & skill", result: "Reps", pattern: "Pull" },
  { name: "Max Chest to Bar Pull Up", domain: "Gymnastics & skill", result: "Reps", pattern: "Pull" },
  { name: "Weighted C2B Pull Up (lb)", domain: "Gymnastics & skill", result: "Load", pattern: "Pull" },
  { name: "Max Toes to Bar (unbroken)", domain: "Gymnastics & skill", result: "Reps", pattern: "Core" },
  { name: "Max Strict HSPU", domain: "Gymnastics & skill", result: "Reps", pattern: "Press" },
  { name: "Max Kipping Ring Muscle Up", domain: "Gymnastics & skill", result: "Reps", pattern: "Muscle-up" },
  { name: "Max Bar Muscle Up", domain: "Gymnastics & skill", result: "Reps", pattern: "Muscle-up" },
  { name: "Max Strict Ring Dip", domain: "Gymnastics & skill", result: "Reps", pattern: "Press" },
  { name: "L Sit Hold", domain: "Gymnastics & skill", result: "Time", pattern: "Core" },
  { name: "3:00 AMRAP GHDSU (reps)", domain: "Gymnastics & skill", result: "Reps", pattern: "Core" },
  { name: "Vertical Jump (in)", domain: "Gymnastics & skill", result: "Height", pattern: "Jump" },
  { name: "Dead Hang", domain: "Gymnastics & skill", result: "Time", pattern: "Grip" },
  { name: "Unbroken Handstand Walk (ft)", domain: "Gymnastics & skill", result: "Distance", pattern: "Inversion" },
  { name: "Unbroken Pegboard Ascents", domain: "Gymnastics & skill", result: "Reps", pattern: "Climb" },
  { name: "BikeErg 20 min Avg Watts", domain: "Machines & rope", result: "Watts", pattern: "Bike" },
  { name: "Echo Bike 50 cal", domain: "Machines & rope", result: "Time", pattern: "Bike" },
  { name: "Ski Erg 2K", domain: "Machines & rope", result: "Time", pattern: "Ski" },
  { name: "Max Unbroken Double Unders", domain: "Machines & rope", result: "Reps", pattern: "Rope" },
  { name: "Beat Bagent", domain: "Mixed tests", result: "Time", pattern: "Mixed" },
  { name: "Regional Triple 3", domain: "Mixed tests", result: "Time", pattern: "Mixed" },
  { name: "Acid Bath", domain: "Mixed tests", result: "Time", pattern: "Mixed" },
  { name: "400m Sprint", domain: "Running", result: "Time", pattern: "Sprint" },
  { name: "1 Mile Run", domain: "Running", result: "Time", pattern: "Middle" },
  { name: "5K Run", domain: "Running", result: "Time", pattern: "Distance" },
  { name: "10K Run", domain: "Running", result: "Time", pattern: "Distance" },
  { name: "500m Row", domain: "Rowing", result: "Time", pattern: "Sprint" },
  { name: "2K Row", domain: "Rowing", result: "Time", pattern: "Middle" },
  { name: "5K Row", domain: "Rowing", result: "Time", pattern: "Distance" },
  { name: "Fran", domain: "CrossFit benchmarks", result: "Time", pattern: "Girl" },
  { name: "Diane", domain: "CrossFit benchmarks", result: "Time", pattern: "Girl" },
  { name: "Helen", domain: "CrossFit benchmarks", result: "Time", pattern: "Girl" },
  { name: "Grace", domain: "CrossFit benchmarks", result: "Time", pattern: "Girl" },
  { name: "Isabel", domain: "CrossFit benchmarks", result: "Time", pattern: "Girl" },
  { name: "Amanda", domain: "CrossFit benchmarks", result: "Time", pattern: "Girl" },
  { name: "Elizabeth", domain: "CrossFit benchmarks", result: "Time", pattern: "Girl" },
  { name: "Nancy", domain: "CrossFit benchmarks", result: "Time", pattern: "Girl" },
  { name: "Murph (vest)", domain: "CrossFit benchmarks", result: "Time", pattern: "Hero" },
  { name: "Cindy (rounds in 20)", domain: "CrossFit benchmarks", result: "Rounds", pattern: "Girl" },
  { name: "100 Wall Ball / 100 Cal Row", domain: "CrossFit benchmarks", result: "Time", pattern: "Chipper" },
  { name: "Open 14.4 (reps)", domain: "CrossFit benchmarks", result: "Reps", pattern: "Open" },
  { name: "Open 16.2 (time/reps)", domain: "CrossFit benchmarks", result: "Time / reps", pattern: "Open" },
  { name: "7 min AMRAP Burpees (reps)", domain: "CrossFit benchmarks", result: "Reps", pattern: "Open" },
  { name: "Open 18.4 (reps/time)", domain: "CrossFit benchmarks", result: "Reps / time", pattern: "Open" },
].map((workout, index) => {
  const eventSlug = workout.name
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
  return {
    ...workout,
    id: `benchmark-${index + 1}`,
    href: `https://demo.wodsmith.com/compete/training-guide-benchmark/workouts/tw_training_guide_${eventSlug}`,
  }
})

window.BENCHMARK_DOMAINS = Object.keys(window.DOMAIN_META)
  .filter((domain) => window.BENCHMARKS.some((workout) => workout.domain === domain))
  .sort((a, b) => window.DOMAIN_META[a].order - window.DOMAIN_META[b].order)

window.escapeBenchmarkHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

window.benchmarkArrow = `
  <svg class="icon" aria-hidden="true" viewBox="0 0 20 20" fill="none">
    <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
