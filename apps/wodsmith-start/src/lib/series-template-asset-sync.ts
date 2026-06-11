interface TitledAsset {
  title: string
}

function normalizeAssetTitle(title: string): string {
  return title.toLowerCase().trim()
}

/**
 * Selects template assets whose normalized titles are absent from existing assets.
 * It also deduplicates template assets by normalized title, keeping the first match.
 *
 * @param templateAssets - Assets from the template to compare.
 * @param existingAssets - Assets already present in the competition.
 * @returns Missing template assets, deduplicated by normalized title.
 */
export function selectTemplateAssetsMissingByTitle<T extends TitledAsset>(
  templateAssets: T[],
  existingAssets: TitledAsset[],
): T[] {
  const existingTitles = new Set(
    existingAssets.map((asset) => normalizeAssetTitle(asset.title)),
  )

  const missingAssets: T[] = []

  for (const asset of templateAssets) {
    const normalizedTitle = normalizeAssetTitle(asset.title)
    if (existingTitles.has(normalizedTitle)) continue

    missingAssets.push(asset)
    existingTitles.add(normalizedTitle)
  }

  return missingAssets
}
