import { expect } from "vitest"

export interface ParityAdapter<TInput, TOutput> {
  readonly name: string
  readonly execute: (input: TInput) => TOutput | Promise<TOutput>
}

export interface ParityFixture<TInput, TOutput> {
  readonly name: string
  readonly input: TInput
  readonly expected: TOutput
}

/** Runs one reviewed fixture corpus through every product adapter. */
export async function assertCrossAppParity<TInput, TOutput, TNormalized>(options: {
  readonly fixtures: readonly ParityFixture<TInput, TNormalized>[]
  readonly adapters: readonly ParityAdapter<TInput, TOutput>[]
  readonly normalize: (output: TOutput) => TNormalized
}): Promise<void> {
  for (const fixture of options.fixtures) {
    for (const adapter of options.adapters) {
      const output = await adapter.execute(fixture.input)
      expect(
        options.normalize(output),
        `${adapter.name} diverged for ${fixture.name}`,
      ).toEqual(fixture.expected)
    }
  }
}
