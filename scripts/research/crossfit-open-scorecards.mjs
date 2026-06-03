#!/usr/bin/env node

const DEFAULT_YEARS = [2026, 2025, 2024, 2023, 2022]
const WORKOUTS_PER_YEAR = 3

const args = new Set(process.argv.slice(2))
const outputJson = args.has("--json")

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
}

function htmlToLines(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n"),
  )
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function unique(values) {
  return [...new Set(values)]
}

function cleanPdfUrl(url) {
  return decodeHtml(url)
}

function extractWorkoutSummary(lines) {
  const start = lines.findIndex((line) => line === "Rx'd")
  const end = lines.findIndex(
    (line, index) => index > start && line.includes("Workout Description"),
  )

  if (start === -1 || end === -1) return []

  return lines
    .slice(start + 1, end)
    .filter((line) => !["Scaled", "Foundations"].includes(line))
}

function classifyWorkout(summaryLines) {
  const text = summaryLines.join(" ").toLowerCase()

  const hasForTime = text.includes("for time") || text.includes("all for time")
  const hasAmrap =
    text.includes("as many rounds") ||
    text.includes("as many reps") ||
    text.includes("amrap")
  const hasLoad = text.includes("1-rep-max")

  const format = [hasForTime, hasAmrap, hasLoad].filter(Boolean).length > 1
    ? "Mixed"
    : hasAmrap
    ? "AMRAP"
    : hasForTime
      ? "For time"
      : hasLoad
        ? "Max load"
        : "Mixed"

  const scoring = []
  if (text.includes("time cap")) scoring.push("time cap")
  if (text.includes("tiebreak")) scoring.push("tiebreak")
  if (text.includes("1-rep-max")) scoring.push("load")
  if (text.includes("round") || text.includes("add ")) scoring.push("round ladder")

  const equipment = [
    ["dumbbell", "dumbbell"],
    ["barbell", "barbell"],
    ["bar-facing", "barbell"],
    ["over the bar", "barbell"],
    ["deadlift", "barbell"],
    ["row", "rower"],
    ["wall-ball", "medicine ball"],
    ["box", "box"],
    ["pull-up", "pull-up bar"],
    ["rings", "rings"],
    ["jump rope", "jump rope"],
    ["double-under", "jump rope"],
    ["shuttle", "floor tape"],
    ["lunge", "floor tape"],
  ]
    .filter(([needle]) => text.includes(needle))
    .map(([, label]) => label)

  if (
    !text.includes("dumbbell") &&
    text.match(/thruster|clean|snatch/) &&
    !equipment.includes("barbell")
  ) {
    equipment.push("barbell")
  }

  const skillMix = [
    text.match(/muscle-up|bar muscle-up|chest-to-bar|toes-to-bar|handstand/)
      ? "high-skill gymnastics"
      : null,
    text.match(/snatch|clean|thruster|deadlift/) ? "weightlifting" : null,
    text.match(/row|burpee|shuttle|double-under|lunge|wall walk/)
      ? "engine/bodyweight"
      : null,
  ].filter(Boolean)

  return {
    format,
    scoring: unique(scoring),
    equipment: unique(equipment),
    skillMix: unique(skillMix),
  }
}

async function fetchWorkout(year, week) {
  const url = `https://games.crossfit.com/workouts/open/${year}/${week}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  const html = await response.text()
  const lines = htmlToLines(html)
  const title = decodeHtml(html.match(/<title>(.*?)<\/title>/i)?.[1] ?? "")
  const workoutId = lines.find((line) => /^\d{2}\.\d[A-Z]?$/.test(line))
  const summaryLines = extractWorkoutSummary(lines)
  const pdfUrls = unique(
    [...html.matchAll(/https?:[^"']+\.pdf[^"']*/g)].map((match) =>
      cleanPdfUrl(match[0]),
    ),
  )

  return {
    year,
    week,
    url,
    title,
    workoutId,
    summaryLines,
    pdfUrls,
    ...classifyWorkout(summaryLines),
  }
}

function renderMarkdown(workouts) {
  const lines = [
    "# CrossFit Open Scorecard Source Matrix",
    "",
    `Fetched ${workouts.length} official Open workout pages.`,
    "",
    "| Year | Workout | Format | Scorecard PDFs | Equipment Signals | Skill Mix |",
    "| --- | --- | --- | ---: | --- | --- |",
  ]

  for (const workout of workouts) {
    lines.push(
      [
        workout.year,
        `[${workout.workoutId}](${workout.url})`,
        workout.format,
        workout.pdfUrls.length,
        workout.equipment.join(", ") || "-",
        workout.skillMix.join(", ") || "-",
      ].join(" | "),
    )
  }

  lines.push("", "## Source PDFs", "")

  for (const workout of workouts) {
    lines.push(`- ${workout.workoutId}: ${workout.pdfUrls[0] ?? "No PDF found"}`)
  }

  return lines.join("\n")
}

const workouts = []

for (const year of DEFAULT_YEARS) {
  for (let week = 1; week <= WORKOUTS_PER_YEAR; week += 1) {
    try {
      workouts.push(await fetchWorkout(year, week))
    } catch (error) {
      console.error(
        `Skipping CrossFit Open ${year}.${week}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}

if (outputJson) {
  console.log(JSON.stringify(workouts, null, 2))
} else {
  console.log(renderMarkdown(workouts))
}
