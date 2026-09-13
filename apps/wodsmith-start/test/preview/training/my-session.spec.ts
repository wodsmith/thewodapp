import { expect, test } from "@playwright/test"

// This harness renders the production Training components with isolated source
// fixtures. Real authorization and persistence are covered by the MySQL suite.
// @lat: [[training-personal#Verification#Session building browser journey]]
test("switches tracks in place and combines a warm-up, scored work and cooldown in a saved performance session", async ({page}) => {
 await page.goto('/training?date=2026-09-04&trackId=everyday')
 await expect(page.getByRole('heading',{name:'Everyday training',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Create workout',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'Customize session',exact:true}).click()
 await page.getByRole('button',{name:'Add from another session',exact:true}).click()
 await page.getByLabel('Track',{exact:true}).selectOption('recovery')
 await page.getByLabel('Shoulder warm-up').check()
 await page.getByLabel('Recovery cooldown').check()
 await page.getByRole('button',{name:'Add 2 workouts',exact:true}).click()
 await page.getByRole('button',{name:'Move Shoulder warm-up up'}).click()
 await page.getByRole('button',{name:'Move Shoulder warm-up up'}).click()
 await page.getByRole('button',{name:'Save session',exact:true}).click()
 await expect(page.getByRole('heading',{name:'My session',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Edit session',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Move Shoulder warm-up up'})).toHaveCount(0)
 const headings = await page.locator('[id^="session-item-"] h3').allTextContents()
 expect(headings.join(' ')).toMatch(/Shoulder warm-up.*Everyday warm-up.*Strict pull-ups.*Recovery cooldown/)
 await page.getByLabel('Training track',{exact:true}).selectOption('recovery')
 await expect(page.getByRole('heading',{name:'Recovery session',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Strict pull-ups',exact:true})).toHaveCount(0)
 await expect(page).toHaveURL(/\/training\?/)
 await page.getByRole('button',{name:'My session · 4',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Strict pull-ups',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Back to Recovery',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Recovery session',exact:true})).toBeVisible()
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

// @lat: [[training-personal#Verification#Keyboard builder cancellation]]
test("cancels a draft with keyboard and restores the trigger without saving a session", async ({page}) => {
 await page.goto('/training?date=2026-09-05&trackId=everyday')
 const trigger = page.getByRole('button',{name:'Customize session',exact:true})
 await trigger.focus()
 await page.keyboard.press('Enter')
 await expect(page.getByRole('heading',{name:'Build My session'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Make default track',exact:true})).toBeDisabled()
 await expect(page.getByRole('button',{name:'Back to default',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Start empty',exact:true}).click()
 await page.getByRole('button',{name:'Cancel',exact:true}).focus()
 await page.keyboard.press('Enter')
 await expect(trigger).toBeFocused()
 await expect(page.getByRole('heading',{name:'Strict pull-ups',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'My session',exact:true}).click()
 await expect(page.getByText('Your session is empty.',{exact:false})).toBeVisible()
})

// @lat: [[training-personal#Session UX Verification#Direct score forms in the browser]]
test("logs and edits kilogram rounds and a tiebreak from a foreign track without composing a session", async ({page}) => {
 await page.goto('/training?date=2026-09-04&trackId=ptrk_crossfit_dotcom')
 const backSquat=page.getByRole('listitem').filter({has:page.getByRole('heading',{name:'Back squat',exact:true})})
 await backSquat.getByRole('link',{name:'Log score',exact:true}).click()
 await expect(page.getByLabel('Weight unit')).toBeVisible()
 await page.getByLabel('Round 1',{exact:true}).fill('100')
 await page.getByRole('button',{name:'Cancel',exact:true}).click()
 await expect(page).toHaveURL(/\/training\?/)
 expect(await page.evaluate(()=>sessionStorage.getItem('session-ux-score-attempts'))).toBeNull()
 await backSquat.getByRole('link',{name:'Log score',exact:true}).click()
 await page.getByLabel('Weight unit').selectOption('kg')
 for(const [index,value] of ['100','110','105'].entries()) await page.getByLabel(`Round ${index+1}`,{exact:true}).fill(value)
 await page.getByLabel('Tiebreak (time)').fill('1:02')
 await page.getByLabel('Notes (optional)').fill('Private training notes')
 await page.getByRole('button',{name:'Save result',exact:true}).click()
 await expect(page).toHaveURL(/\/training\?/)
 await expect(page.getByRole('button',{name:'My session',exact:true})).toBeVisible()
 await backSquat.getByRole('link',{name:/Edit score/}).click()
 await expect(page.getByLabel('Weight unit')).toHaveValue('kg')
 await expect(page.getByLabel('Round 2',{exact:true})).toHaveValue('110')
 await expect(page.getByLabel('Tiebreak (time)')).toHaveValue('1:02')
 await page.getByLabel('Round 2',{exact:true}).fill('112')
 await page.getByRole('button',{name:'Save changes',exact:true}).click()
 await expect(page).toHaveURL(/\/training\?/)
 await expect(backSquat.getByRole('link',{name:/Edit score.*112/})).toBeVisible()
 expect(await page.evaluate(()=>Object.keys(JSON.parse(sessionStorage.getItem('session-ux-score-attempts') ?? '{}')).length)).toBe(1)
})

// @lat: [[training-personal#Session UX Verification#Provider selection and attributed instructions]]
test("borrows provider work and chosen instructions from another date without inventing sections", async ({page}) => {
 await page.goto('/training?date=2026-09-05&trackId=everyday')
 await page.getByRole('button',{name:'Customize session',exact:true}).click()
 await page.getByRole('button',{name:'Add from another session',exact:true}).click()
 await page.getByLabel('Track',{exact:true}).selectOption('ptrk_crossfit_dotcom')
 await page.getByLabel('Programmed date',{exact:true}).fill('2026-09-04')
 await page.getByLabel('Back squat',{exact:false}).check()
 await page.getByLabel('Instructions to borrow (optional)').fill('Reduce the load and use assisted pull-ups.')
 await page.getByRole('button',{name:'Add 2 workouts',exact:true}).click()
 await page.getByRole('button',{name:'Save session',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Back squat',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Borrowed instructions',exact:true})).toBeVisible()
 await expect(page.getByText('Source: CrossFit.com · 2026-09-04',{exact:false})).toBeVisible()
 await expect(page.getByRole('heading',{name:'My session',exact:true})).toBeVisible()
})

// @lat: [[session-review-tests#Customize preserves an existing cross-track composition]]
test("customizing another track preserves the existing session until explicitly starting empty",async({page})=>{
 await page.goto('/training?date=2026-09-04&trackId=recovery')
 const cooldown=page.locator('[id^="session-item-"]').filter({has:page.getByRole('heading',{name:'Recovery cooldown',exact:true})})
 await cooldown.getByRole('button',{name:'Add to My session',exact:true}).click()
 await expect(page.getByRole('button',{name:'My session · 1',exact:true})).toBeVisible()
 await page.getByLabel('Training track',{exact:true}).selectOption('everyday')
 await page.getByRole('button',{name:'Customize session',exact:true}).click()
 await expect(page.getByText('Your private composition · 2026-09-04. Changes stay in this draft until you save.',{exact:false})).toBeVisible()
 await page.getByRole('button',{name:'Save session',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Recovery cooldown',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Strict pull-ups',exact:true})).toHaveCount(0)
})

// @lat: [[session-review-tests#Repeated add-all cannot undo previous work]]
test("repeating Add all leaves existing work outside a new Undo receipt",async({page})=>{
 await page.goto('/training?date=2026-09-04&trackId=ptrk_crossfit_dotcom')
 await page.getByRole('button',{name:'Add all to my day',exact:true}).click()
 await expect(page.getByRole('button',{name:'My session · 2',exact:true})).toBeVisible()
 await page.reload()
 await page.getByRole('button',{name:'Add all to my day',exact:true}).click()
 await expect(page.getByRole('button',{name:'Undo',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'My session · 2',exact:true})).toBeVisible()
})

// @lat: [[session-review-tests#Planned provider scores save in the browser]]
test("saves a first planned provider score and edits it from the source",async({page})=>{
 await page.goto('/training?date=2026-09-04&trackId=ptrk_crossfit_dotcom')
 const row=page.getByRole('listitem').filter({has:page.getByRole('heading',{name:'Back squat',exact:true})})
 await row.getByRole('button',{name:'Add to My session',exact:true}).click()
 await row.getByRole('link',{name:'Log score',exact:true}).click()
 for(const [index,value] of ['100','110','105'].entries()) await page.getByLabel(`Round ${index+1}`,{exact:true}).fill(value)
 await page.getByRole('button',{name:'Save result',exact:true}).click()
 await expect(page).toHaveURL(/\/training\?/)
 await page.getByLabel('Training track',{exact:true}).selectOption('everyday')
 await expect(page.getByRole('heading',{name:'Everyday training',exact:true})).toBeVisible()
 await page.getByLabel('Training track',{exact:true}).selectOption('ptrk_crossfit_dotcom')
 await expect(row.getByRole('link',{name:/Edit score/})).toBeVisible()
})

// @lat: [[session-review-tests#Editing weight units preserves exact stored loads]]
test("preserves fractional grams on notes-only edit and a unit-only round conversion",async({page})=>{
 await page.goto('/training?date=2026-09-04&trackId=ptrk_crossfit_dotcom')
 const row=page.getByRole('listitem').filter({has:page.getByRole('heading',{name:'Back squat',exact:true})})
 await row.getByRole('link',{name:'Log score',exact:true}).click()
 await page.getByLabel('Weight unit').selectOption('kg')
 for(const [index,value] of ['100.123','110.457','105.789'].entries()) await page.getByLabel(`Round ${index+1}`,{exact:true}).fill(value)
 await page.getByRole('button',{name:'Save result',exact:true}).click()
 await expect(page).toHaveURL(/\/training\?/)
 const stored=()=>page.evaluate(()=>Object.values(JSON.parse(sessionStorage.getItem('session-ux-score-attempts')??'{}')).map((attempt:any)=>({score:attempt.result.scoreValue,rounds:attempt.result.rounds})))
 const before=await stored()
 await row.getByRole('link',{name:/Edit score/}).click()
 await page.getByLabel('Notes (optional)').fill('Only a note')
 await page.getByRole('button',{name:'Save changes',exact:true}).click()
 await expect(page).toHaveURL(/\/training\?/)
 expect(await stored()).toEqual(before)
 await row.getByRole('link',{name:/Edit score/}).click()
 await page.getByLabel('Weight unit').selectOption('lb')
 await page.getByRole('button',{name:'Save changes',exact:true}).click()
 await expect(page).toHaveURL(/\/training\?/)
 expect(await stored()).toEqual(before)
})

// @lat: [[session-navigation-tests#Personal score browser return journey]]
test("returns to the browsed non-default track after My session new and edited scores", async ({
  page,
}) => {
  await page.goto("/training?date=2026-09-04&trackId=ptrk_crossfit_dotcom")
  await page
    .getByRole("button", { name: "Add all to my day", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "My session · 2", exact: true }),
  ).toBeVisible()
  await page
    .getByLabel("Training track", { exact: true })
    .selectOption("recovery")
  await page
    .getByRole("button", { name: "My session · 2", exact: true })
    .click()
  const item = page.locator('[id^="session-item-"]').filter({
    has: page.getByRole("heading", { name: "Back squat", exact: true }),
  })
  await item.getByRole("link", { name: "Log score", exact: true }).click()
  for (const [index, value] of ["100", "110", "105"].entries())
    await page.getByLabel(`Round ${index + 1}`, { exact: true }).fill(value)
  await page.getByRole("button", { name: "Save result", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "My session", exact: true }),
  ).toBeVisible()
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({
    teamId: "preview-personal",
    date: "2026-09-04",
    trackId: "recovery",
    surface: "session",
  })
  await item.getByRole("link", { name: /Edit score/ }).click()
  await page.getByLabel("Notes (optional)").fill("Return to Recovery")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "My session", exact: true }),
  ).toBeVisible()
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({
    teamId: "preview-personal",
    date: "2026-09-04",
    trackId: "recovery",
    surface: "session",
  })
})

// @lat: [[session-navigation-tests#Preview private completion and default reload]]
test("retains private borrowed completion and the default track across native reload", async ({
  page,
}) => {
  await page.goto("/training?date=2026-09-04&trackId=recovery")
  await page
    .getByRole("button", { name: "Make default track", exact: true })
    .click()
  await expect(page.getByText("Default track", { exact: true })).toBeVisible()
  await page
    .getByRole("button", { name: "Customize session", exact: true })
    .click()
  await page.getByRole("button", { name: "Start empty", exact: true }).click()
  await page
    .getByRole("button", { name: "Add from another session", exact: true })
    .click()
  await page.getByLabel("Track", { exact: true }).selectOption("recovery")
  await page.getByLabel("Programmed date", { exact: true }).fill("2026-09-03")
  await page.getByLabel("Recovery cooldown").check()
  await page.getByRole("button", { name: "Add 1 workout", exact: true }).click()
  await page.getByRole("button", { name: "Save session", exact: true }).click()
  await page.getByRole("button", { name: "Mark complete", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Undo completion", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.goto("/training?date=2026-09-04&surface=session")
  await expect(page.getByLabel("Training track", { exact: true })).toHaveValue(
    "recovery",
  )
  await expect(
    page.getByRole("button", { name: "Undo completion", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
})

// @lat: [[session-navigation-tests#Provider draft save boundary in the browser]]
test("requires explicit Save before scoring provider draft items and Cancel leaves no composition", async ({
  page,
}) => {
  await page.goto("/training?date=2026-09-04&trackId=ptrk_crossfit_dotcom")
  await page
    .getByRole("button", { name: "Customize session", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Build My session", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: /^(Log score|Edit score)/ }),
  ).toHaveCount(0)
  await expect(
    page.getByText("Save your session to record this section.", {
      exact: true,
    }),
  ).toHaveCount(2)
  expect(
    await page.evaluate(() => sessionStorage.getItem("session-ux-plans")),
  ).toBeNull()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  expect(
    await page.evaluate(() => sessionStorage.getItem("session-ux-plans")),
  ).toBeNull()
  await page
    .getByRole("button", { name: "Customize session", exact: true })
    .click()
  await page.getByRole("button", { name: "Save session", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "My session", exact: true }),
  ).toBeVisible()
  const links = page.getByRole("link", { name: "Log score", exact: true })
  await expect(links).toHaveCount(2)
  for (const link of await links.all()) {
    const url = new URL((await link.getAttribute("href"))!, page.url())
    expect(url.searchParams.get("personalSessionId")).toBeTruthy()
    expect(url.searchParams.get("personalItemId")).toBeTruthy()
    expect(url.searchParams.get("returnTrackId")).toBe("ptrk_crossfit_dotcom")
  }
  await links.first().click()
  await expect(
    page.getByRole("heading", { name: "Log result", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Save result", exact: true }),
  ).toBeVisible()
})
