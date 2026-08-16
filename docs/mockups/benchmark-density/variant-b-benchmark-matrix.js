const matrixSearch = document.querySelector("#search-b")
const matrixSearchField = matrixSearch.closest(".search-field")
const matrixClear = matrixSearchField.querySelector(".clear-search")
const matrixSort = document.querySelector("#sort-b")
const densityButton = document.querySelector(".density-control")
const filterContainer = document.querySelector(".domain-filters")
const table = document.querySelector(".benchmark-table")
const tableBody = table.querySelector("tbody")
const matrixScroll = document.querySelector(".matrix-scroll")
const matrixCount = document.querySelector(".matrix-heading .result-count")
const matrixEmpty = document.querySelector(".content-panel > .empty-state")
const resetButton = matrixEmpty.querySelector("button")
let activeDomain = null

function renderFilters() {
  filterContainer.innerHTML = `
    <button class="filter-chip tone-ember" type="button" data-domain="" aria-pressed="true">
      All <span class="filter-chip__count">${BENCHMARKS.length}</span>
    </button>
    ${BENCHMARK_DOMAINS.map((domain) => {
      const meta = DOMAIN_META[domain]
      const count = BENCHMARKS.filter((workout) => workout.domain === domain).length
      return `<button class="filter-chip tone-${meta.tone}" type="button" data-domain="${escapeBenchmarkHtml(domain)}" aria-pressed="false">
        ${escapeBenchmarkHtml(meta.short)} <span class="filter-chip__count">${count}</span>
      </button>`
    }).join("")}`
}

function sortedWorkouts(workouts) {
  const mode = matrixSort.value
  return [...workouts].sort((a, b) => {
    if (mode === "domain") {
      const domainOrder = DOMAIN_META[a.domain].order - DOMAIN_META[b.domain].order
      return domainOrder || a.name.localeCompare(b.name)
    }
    if (mode === "result") {
      return a.result.localeCompare(b.result) || a.name.localeCompare(b.name)
    }
    return a.name.localeCompare(b.name)
  })
}

function renderTable() {
  const query = matrixSearch.value.trim().toLowerCase()
  matrixSearchField.classList.toggle("has-value", query.length > 0)
  const visible = sortedWorkouts(BENCHMARKS.filter((workout) => {
    const inDomain = !activeDomain || workout.domain === activeDomain
    const searchable = `${workout.name} ${workout.domain} ${workout.result} ${workout.pattern}`.toLowerCase()
    return inDomain && (!query || searchable.includes(query))
  }))

  tableBody.innerHTML = visible.map((workout) => {
    const meta = DOMAIN_META[workout.domain]
    return `
      <tr>
        <th scope="row">${escapeBenchmarkHtml(workout.name)}</th>
        <td><span class="table-domain tone-${meta.tone}">${escapeBenchmarkHtml(meta.short)}</span></td>
        <td>${escapeBenchmarkHtml(workout.result)}</td>
        <td>${escapeBenchmarkHtml(workout.pattern)}</td>
        <td class="table-action"><a href="${workout.href}" aria-label="View ${escapeBenchmarkHtml(workout.name)}">${benchmarkArrow}</a></td>
      </tr>`
  }).join("")

  matrixCount.innerHTML = `<strong>${visible.length}</strong> shown`
  matrixScroll.hidden = visible.length === 0
  matrixEmpty.style.display = visible.length === 0 ? "block" : "none"
}

function setActiveDomain(domain) {
  activeDomain = domain || null
  filterContainer.querySelectorAll("button[data-domain]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.domain === (activeDomain || "")))
  })
  renderTable()
}

function resetMatrix() {
  activeDomain = null
  matrixSearch.value = ""
  matrixSort.value = "domain"
  setActiveDomain(null)
  matrixSearch.focus()
}

renderFilters()
renderTable()

filterContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-domain]")
  if (!button) return
  setActiveDomain(button.dataset.domain)
})

matrixSearch.addEventListener("input", renderTable)
matrixSort.addEventListener("change", renderTable)
matrixClear.addEventListener("click", () => {
  matrixSearch.value = ""
  renderTable()
  matrixSearch.focus()
})
resetButton.addEventListener("click", resetMatrix)

densityButton.addEventListener("click", () => {
  const compact = densityButton.getAttribute("aria-pressed") !== "true"
  densityButton.setAttribute("aria-pressed", String(compact))
  table.classList.toggle("compact", compact)
})
