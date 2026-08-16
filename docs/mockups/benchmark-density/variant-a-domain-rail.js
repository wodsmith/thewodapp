const searchInput = document.querySelector("#search-a")
const searchField = searchInput.closest(".search-field")
const clearButtons = [
  searchField.querySelector(".clear-search"),
  document.querySelector(".empty-state button"),
]
const rail = document.querySelector(".domain-rail")
const groupsContainer = document.querySelector(".domain-groups")
const resultCount = document.querySelector(".domain-results > .result-count")
const emptyState = document.querySelector(".empty-state")
const domainGuide = document.querySelector(".domain-guide")
const domainCodes = {
  "Strength & barbell": "ST",
  "Gymnastics & skill": "GY",
  "Machines & rope": "EN",
  "Mixed tests": "MX",
  Running: "RN",
  Rowing: "RW",
  "CrossFit benchmarks": "CF",
}
const illustrativeScores = new Map([
  ["Strict Press", "145 lb"],
  ["Bench Press", "225 lb"],
  ["Deadlift", "405 lb"],
  ["Back Squat", "345 lb"],
  ["Max Strict Pull Up", "18 reps"],
  ["Max Unbroken Double Unders", "127 reps"],
  ["2K Row", "7:06"],
  ["Fran", "4:12"],
  ["Grace", "2:47"],
  ["Cindy (rounds in 20)", "22 + 8"],
])
let railCollapsed = window.localStorage.getItem("benchmark-domain-rail-collapsed") === "true"

function slugify(value) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function renderRail() {
  rail.innerHTML = `
    <button class="domain-rail__toggle" type="button" aria-expanded="${!railCollapsed}" aria-label="${railCollapsed ? "Expand" : "Collapse"} domain rail">
      <svg class="rail-icon rail-icon--collapse" aria-hidden="true" viewBox="0 0 20 20" fill="none">
        <path d="M4 4.5h12v11H4zM8 4.5v11m4-7-2 2 2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg class="rail-icon rail-icon--expand" aria-hidden="true" viewBox="0 0 20 20" fill="none">
        <path d="M4 4.5h12v11H4zM8 4.5v11m2-7 2 2-2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="domain-rail__title">Domains</span>
    </button>
    ${BENCHMARK_DOMAINS.map((domain, index) => {
      const meta = DOMAIN_META[domain]
      const count = BENCHMARKS.filter((workout) => workout.domain === domain).length
      return `
        <button type="button" data-domain="${escapeBenchmarkHtml(domain)}" aria-current="${index === 0}" aria-label="${escapeBenchmarkHtml(meta.short)}, ${count} workouts">
          <span class="domain-rail__code" aria-hidden="true">${domainCodes[domain]}</span>
          <span class="domain-rail__label">${escapeBenchmarkHtml(meta.short)}</span>
          <span class="domain-rail__count">${count}</span>
        </button>`
    }).join("")}`
}

function setRailCollapsed(collapsed, persist = true) {
  railCollapsed = collapsed
  domainGuide.classList.toggle("is-rail-collapsed", collapsed)
  const toggle = rail.querySelector(".domain-rail__toggle")
  toggle.setAttribute("aria-expanded", String(!collapsed))
  toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} domain rail`)
  if (persist) window.localStorage.setItem("benchmark-domain-rail-collapsed", String(collapsed))
}

function renderGroups() {
  const desktop = window.matchMedia("(min-width: 721px)").matches
  groupsContainer.innerHTML = BENCHMARK_DOMAINS.map((domain, index) => {
    const meta = DOMAIN_META[domain]
    const workouts = BENCHMARKS.filter((workout) => workout.domain === domain)
    const groupId = `domain-${slugify(domain)}`
    const expanded = desktop || index === 0
    return `
      <section class="domain-group" id="${groupId}" data-domain="${escapeBenchmarkHtml(domain)}">
        <button class="domain-group__heading" type="button" aria-expanded="${expanded}" aria-controls="${groupId}-list">
          <span class="domain-title">
            <strong>${escapeBenchmarkHtml(domain)}</strong>
            <span>${escapeBenchmarkHtml(meta.description)}</span>
          </span>
          <span class="domain-group__count">${workouts.length}</span>
          <svg class="domain-chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m5.5 8 4.5 4.5L14.5 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <ul class="domain-list" id="${groupId}-list"${expanded ? "" : " hidden"}>
          ${workouts.map((workout) => {
            const score = illustrativeScores.get(workout.name)
            return `
              <li class="domain-row" data-has-score="${Boolean(score)}" data-search="${escapeBenchmarkHtml(`${workout.name} ${workout.pattern} ${workout.result} ${score ?? ""}`.toLowerCase())}">
                <span class="domain-row__name" data-pattern="${escapeBenchmarkHtml(workout.pattern)}">${escapeBenchmarkHtml(workout.name)}</span>
                <span class="domain-row__pattern">${escapeBenchmarkHtml(workout.pattern)}</span>
                <span class="domain-row__score">${score ? `<small>Your score</small><strong>${escapeBenchmarkHtml(score)}</strong>` : ""}</span>
                <span class="domain-row__result">${escapeBenchmarkHtml(workout.result)}</span>
                <a class="workout-link" href="${workout.href}" aria-label="View ${escapeBenchmarkHtml(workout.name)}">${benchmarkArrow}</a>
              </li>`
          }).join("")}
        </ul>
      </section>`
  }).join("")
}

function setCurrentDomain(domain) {
  rail.querySelectorAll("button[data-domain]").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.domain === domain))
  })
}

function applySearch() {
  const query = searchInput.value.trim().toLowerCase()
  searchField.classList.toggle("has-value", query.length > 0)
  let visibleTotal = 0
  let visibleDomains = 0

  groupsContainer.querySelectorAll(".domain-group").forEach((group) => {
    let visibleInGroup = 0
    group.querySelectorAll(".domain-row").forEach((row) => {
      const matches = !query || row.dataset.search.includes(query)
      row.hidden = !matches
      if (matches) visibleInGroup += 1
    })

    group.hidden = visibleInGroup === 0
    group.classList.toggle("domain-group--filtered", query.length > 0)
    group.querySelector(".domain-group__count").textContent = visibleInGroup
    const railButton = rail.querySelector(`[data-domain="${CSS.escape(group.dataset.domain)}"]`)
    railButton.hidden = query.length > 0 && visibleInGroup === 0
    railButton.querySelector(".domain-rail__count").textContent = visibleInGroup
    if (query) {
      group.querySelector(".domain-list").hidden = false
      group.querySelector(".domain-group__heading").setAttribute("aria-expanded", "true")
    }
    if (visibleInGroup > 0) visibleDomains += 1
    visibleTotal += visibleInGroup
  })
  if (query) {
    const firstVisibleDomain = rail.querySelector("button[data-domain]:not([hidden])")
    if (firstVisibleDomain) setCurrentDomain(firstVisibleDomain.dataset.domain)
  }

  resultCount.innerHTML = `<strong>${visibleTotal}</strong> workout${visibleTotal === 1 ? "" : "s"} in ${visibleDomains} domain${visibleDomains === 1 ? "" : "s"}`
  groupsContainer.hidden = visibleTotal === 0
  emptyState.style.display = visibleTotal === 0 ? "block" : "none"
}

renderRail()
renderGroups()
setRailCollapsed(railCollapsed, false)

rail.addEventListener("click", (event) => {
  const toggle = event.target.closest(".domain-rail__toggle")
  if (toggle) {
    setRailCollapsed(!railCollapsed)
    return
  }

  const button = event.target.closest("button[data-domain]")
  if (!button) return
  const group = groupsContainer.querySelector(`[data-domain="${CSS.escape(button.dataset.domain)}"]`)
  if (!group) return
  const heading = group.querySelector(".domain-group__heading")
  const list = group.querySelector(".domain-list")
  heading.setAttribute("aria-expanded", "true")
  list.hidden = false
  setCurrentDomain(button.dataset.domain)
  group.scrollIntoView({ behavior: "smooth", block: "start" })
})

groupsContainer.addEventListener("click", (event) => {
  const heading = event.target.closest(".domain-group__heading")
  if (!heading || searchInput.value.trim()) return
  const list = document.getElementById(heading.getAttribute("aria-controls"))
  const expanded = heading.getAttribute("aria-expanded") === "true"
  heading.setAttribute("aria-expanded", String(!expanded))
  list.hidden = expanded
})

searchInput.addEventListener("input", applySearch)
clearButtons.forEach((button) => button.addEventListener("click", () => {
  searchInput.value = ""
  applySearch()
  searchInput.focus()
}))

const observer = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
  if (visible) setCurrentDomain(visible.target.dataset.domain)
}, { rootMargin: "-10% 0px -75% 0px", threshold: 0 })

groupsContainer.querySelectorAll(".domain-group").forEach((group) => observer.observe(group))
