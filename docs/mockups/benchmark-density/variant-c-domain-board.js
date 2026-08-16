const boardSearch = document.querySelector("#search-c")
const boardSearchField = boardSearch.closest(".search-field")
const boardClearButtons = [
  boardSearchField.querySelector(".clear-search"),
  document.querySelector(".content-panel > .empty-state button"),
]
const domainOverview = document.querySelector(".domain-overview")
const domainBoard = document.querySelector(".domain-board")
const boardResultLine = document.querySelector(".board-result-line")
const boardEmpty = document.querySelector(".content-panel > .empty-state")
const boardKey = document.querySelector(".board-key__rows")

function boardSlug(value) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function domainCount(domain) {
  return BENCHMARKS.filter((workout) => workout.domain === domain).length
}

function renderOverview() {
  domainOverview.innerHTML = BENCHMARK_DOMAINS.map((domain) => {
    const meta = DOMAIN_META[domain]
    return `
      <button class="tone-${meta.tone}" type="button" data-domain="${escapeBenchmarkHtml(domain)}">
        <span class="domain-overview__count">${domainCount(domain)}</span>
        <span class="domain-overview__label">${escapeBenchmarkHtml(meta.short)}</span>
      </button>`
  }).join("")
}

function renderZone(domain) {
  const meta = DOMAIN_META[domain]
  const workouts = BENCHMARKS.filter((workout) => workout.domain === domain)
  const zoneId = `board-${boardSlug(domain)}`
  const startsOpen = window.matchMedia("(min-width: 721px)").matches || meta.order <= 2
  return `
    <details class="domain-zone tone-${meta.tone}" data-domain="${escapeBenchmarkHtml(domain)}" data-size="${workouts.length < 8 ? "small" : "large"}" id="${zoneId}" ${startsOpen ? "open" : ""}>
      <summary class="domain-zone__summary">
        <span class="domain-zone__title">
          <strong>${escapeBenchmarkHtml(domain)}</strong>
          <span>${escapeBenchmarkHtml(meta.description)}</span>
        </span>
        <span class="domain-zone__count">${workouts.length}</span>
        <svg class="domain-zone__chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m5.5 8 4.5 4.5L14.5 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <ul class="zone-list">
        ${workouts.map((workout) => `
          <li class="zone-item" data-search="${escapeBenchmarkHtml(`${workout.name} ${workout.result} ${workout.pattern}`.toLowerCase())}">
            <a class="workout-link" href="${workout.href}" aria-label="View ${escapeBenchmarkHtml(workout.name)}">
              <span class="zone-item__name">${escapeBenchmarkHtml(workout.name)}</span>
              <span class="zone-item__result">${escapeBenchmarkHtml(workout.result)}</span>
            </a>
          </li>`).join("")}
      </ul>
    </details>`
}

function renderBoard() {
  domainBoard.innerHTML = BENCHMARK_DOMAINS.map(renderZone).join("")

  boardKey.innerHTML = BENCHMARK_DOMAINS.map((domain) => {
    const meta = DOMAIN_META[domain]
    return `<div class="board-key__row tone-${meta.tone}"><i aria-hidden="true"></i><span>${escapeBenchmarkHtml(meta.short)}</span><strong>${domainCount(domain)}</strong></div>`
  }).join("")
}

function applyBoardSearch() {
  const query = boardSearch.value.trim().toLowerCase()
  boardSearchField.classList.toggle("has-value", query.length > 0)
  let visibleTotal = 0
  let visibleDomains = 0

  domainBoard.querySelectorAll(".domain-zone").forEach((zone) => {
    let visibleInZone = 0
    zone.querySelectorAll(".zone-item").forEach((item) => {
      const matches = !query || item.dataset.search.includes(query)
      item.hidden = !matches
      if (matches) visibleInZone += 1
    })
    zone.hidden = visibleInZone === 0
    zone.classList.toggle("domain-zone--filtered", query.length > 0)
    zone.querySelector(".domain-zone__count").textContent = visibleInZone
    const overviewButton = domainOverview.querySelector(`[data-domain="${CSS.escape(zone.dataset.domain)}"]`)
    overviewButton.hidden = query.length > 0 && visibleInZone === 0
    overviewButton.querySelector(".domain-overview__count").textContent = visibleInZone
    if (query && visibleInZone > 0) zone.open = true
    if (visibleInZone > 0) visibleDomains += 1
    visibleTotal += visibleInZone
  })


  boardResultLine.innerHTML = `<strong>${visibleTotal}</strong> workout${visibleTotal === 1 ? "" : "s"} across ${visibleDomains} domain${visibleDomains === 1 ? "" : "s"}`
  domainBoard.hidden = visibleTotal === 0
  boardEmpty.style.display = visibleTotal === 0 ? "block" : "none"
}

renderOverview()
renderBoard()

domainOverview.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-domain]")
  if (!button) return
  const zone = domainBoard.querySelector(`[data-domain="${CSS.escape(button.dataset.domain)}"]`)
  if (!zone) return
  zone.open = true
  zone.scrollIntoView({ behavior: "smooth", block: "start" })
})

boardSearch.addEventListener("input", applyBoardSearch)
boardClearButtons.forEach((button) => button.addEventListener("click", () => {
  boardSearch.value = ""
  applyBoardSearch()
  boardSearch.focus()
}))
