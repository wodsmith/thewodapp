type TitledAsset = {
  title: string
}

function normalizeAssetTitle(title: string): string {
  return title.toLowerCase().trim()
}

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
