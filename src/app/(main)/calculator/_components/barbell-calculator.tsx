"use client";
import Cookies from "js-cookie";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import React, { useState, useMemo, Suspense } from "react";
// Since we are not in a Next.js environment for this immersive,
// we'll simulate Head by just letting the style tag be global.
// import Head from 'next/head'; // Not available in this environment

// --- Constants ---
const LB_PLATES_FULL = [45, 35, 25, 15, 10, 5, 2.5];
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]; // Standard KG plates
const WARMUP_PERCENTAGES = [0.4, 0.55, 0.7, 0.8, 0.9];
const LB_TO_KG = 0.453592;
const KG_TO_LB = 2.20462;

// --- Helper Functions ---
const roundToNearestIncrement = (weight: number, increment: number): number => {
  return Math.round(weight / increment) * increment;
};

const calculatePlates = (
  targetWeight: number,
  barWeight: number,
  availablePlates: number[]
): number[] => {
  if (targetWeight <= barWeight) {
    return [];
  }
  // Ensure calculations are done with sufficient precision then rounded at the end if necessary
  const weightPerSide = (targetWeight - barWeight) / 2;
  const platesOnSide = [];
  let remaining = weightPerSide;

  // Small tolerance for floating point issues
  const tolerance = 0.0001;

  for (const plate of availablePlates) {
    while (remaining >= plate - tolerance) {
      platesOnSide.push(plate);
      remaining -= plate;
    }
  }
  return platesOnSide;
};

const getPlateColor = (weight: number, isKg: boolean): string => {
  // Standard Olympic Plate Colors
  if (isKg) {
    switch (weight) {
      case 25:
        return "#FF0000"; // Red
      case 20:
        return "#0000FF"; // Blue
      case 15:
        return "#FFFF00"; // Yellow
      case 10:
        return "#00FF00"; // Green
      case 5:
        return "#FFFFFF"; // White
      case 2.5:
        return "#000000"; // Black
      case 1.25:
        return "#808080"; // Grey/Chrome
      default:
        return "#7f8c8d"; // Default Grey
    }
  }
  // LB Plates - common gym colors
  switch (weight) {
    case 45:
      return "#0000FF"; // Blue
    case 35:
      return "#FFFF00"; // Yellow (less common, but for consistency)
    case 25:
      return "#00FF00"; // Green
    case 15:
      return "#FFA500"; // Orange (often not a standard color, using for distinction)
    case 10:
      return "#FFFFFF"; // White
    case 5:
      return "#FF0000"; // Red
    case 2.5:
      return "#000000"; // Black
    default:
      return "#7f8c8d"; // Default Grey
  }
};

const getPlateTextColor = (backgroundColor: string | null): string => {
  // Determine if text should be black or white based on background
  if (!backgroundColor) return "#000";
  const hex = backgroundColor.replace("#", "");
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
};

const getPlateDimensions = (
  weight: number
): { height: number; width: number } => {
  const baseHeight = 100; // px
  const baseWidth = 18; // px, increased for better visibility
  const minHeight = baseHeight * 0.4;
  const minWidth = baseWidth * 0.5;

  if (weight >= 45 || weight >= 25)
    return { height: baseHeight, width: baseWidth * 1.5 }; // 45lb or 25kg
  if (weight >= 35 || weight >= 20)
    return { height: baseHeight * 0.95, width: baseWidth * 1.4 }; // 35lb or 20kg
  if (weight >= 25 || weight >= 15)
    return { height: baseHeight * 0.9, width: baseWidth * 1.3 }; // 25lb or 15kg (note: 25lb is distinct from 25kg)
  if (weight >= 15) return { height: baseHeight * 0.8, width: baseWidth * 1.2 }; // 15lb
  if (weight >= 10) return { height: baseHeight * 0.7, width: baseWidth * 1.1 }; // 10lb or 10kg
  if (weight >= 5) return { height: baseHeight * 0.6, width: baseWidth }; // 5lb or 5kg
  if (weight >= 2.5)
    return { height: baseHeight * 0.5, width: baseWidth * 0.8 }; // 2.5lb or 2.5kg
  if (weight >= 1.25)
    return { height: baseHeight * 0.4, width: baseWidth * 0.7 }; // 1.25kg
  return { height: minHeight, width: minWidth };
};

// --- React Components ---

const Plate = ({ weight, isKg }: { weight: number; isKg: boolean }) => {
  const { height, width } = getPlateDimensions(weight);
  const color = getPlateColor(weight, isKg);
  const textColor = getPlateTextColor(color);

  return (
    <div
      className="mx-px flex items-center justify-center border-2 border-black text-center font-bold text-xs"
      style={{
        height: `${height}px`,
        width: `${width}px`,
        backgroundColor: color,
        color: textColor,
      }}
    >
      {weight}
    </div>
  );
};

const BarbellGraphic = ({
  plates,
  isKg,
}: {
  plates: number[];
  isKg: boolean;
}) => {
  return (
    <div className="relative mx-auto my-5 flex min-h-[150px] w-full max-w-[30rem] items-center justify-center overflow-x-auto border-3 border-black p-5">
      {/* Left Collar */}
      <div
        className="z-10 mr-0.5 w-2.5 rounded-sm border border-neutral-800 bg-neutral-600"
        style={{
          height: `${getPlateDimensions(isKg ? 2.5 : 5).height * 0.3}px`,
        }}
      />
      <div className="flex flex-row-reverse items-center">
        {plates.map((plate: number, index: number) => (
          <Plate key={`left-${index}-${plate}`} weight={plate} isKg={isKg} />
        ))}
      </div>
      {/* Bar */}
      <div className="relative z-0 h-3 min-w-[50px] max-w-[600px] flex-grow border-neutral-500 border-r-5 border-l-5 bg-neutral-400" />
      <div className="flex items-center">
        {plates.map((plate: number, index: number) => (
          <Plate key={`right-${index}-${plate}`} weight={plate} isKg={isKg} />
        ))}
      </div>
      {/* Right Collar */}
      <div
        className="z-10 ml-0.5 w-2.5 rounded-sm border border-neutral-800 bg-neutral-600"
        style={{
          height: `${getPlateDimensions(isKg ? 2.5 : 5).height * 0.3}px`,
        }}
      />
    </div>
  );
};

const WarmupSet = ({
  setNumber,
  weight,
  plates,
  unit,
  isKg,
  percentage,
  onPercentageChange,
}: {
  setNumber: number;
  weight: number;
  plates: number[];
  unit: string;
  isKg: boolean;
  percentage: number;
  onPercentageChange: (newPercentage: number) => void;
}) => (
  <div className="mb-2.5 border-2 border-black p-3.5 ">
    <div className="mb-2.5 flex items-center justify-between">
      <h4 className="mt-0 border-black border-b pb-1.25 text-black text-lg dark:text-black">
        Set {setNumber}: {weight.toFixed(1)}
        {unit}
      </h4>
      <div className="flex items-center gap-2">
        <span className="text-neutral-600 text-sm">
          ({(percentage * 100).toFixed(0)}%)
        </span>
        <input
          type="number"
          value={(percentage * 100).toFixed(0)}
          aria-label={`Percentage for Set ${setNumber}`}
          onChange={(e) => {
            const newPerc = Number.parseInt(e.target.value, 10) / 100;
            if (!Number.isNaN(newPerc) && newPerc >= 0 && newPerc <= 1) {
              onPercentageChange(newPerc);
            }
          }}
          className="w-16 border border-black bg-white p-1 text-sm dark:text-black"
          min="0"
          max="100"
          step="1"
        />
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-1.25">
      {plates.length > 0 ? (
        plates.map((p: number, i: number) => (
          <span
            key={`warmup-plate-${setNumber}-${i}-${p}`}
            className="rounded-sm border border-black px-2 py-0.5 font-bold text-sm"
            style={{
              backgroundColor: getPlateColor(p, isKg),
              color: getPlateTextColor(getPlateColor(p, isKg)),
            }}
          >
            {p}
          </span>
        ))
      ) : (
        <span className="italic">Just the bar!</span>
      )}
    </div>
  </div>
);

export default function BarbellCalculator() {
  const [targetWeightQuery, setTargetWeightQuery] = useQueryState(
    "weight",
    parseAsInteger.withDefault(135)
  );
  const [units, setUnits] = useQueryState(
    "units",
    parseAsString.withDefault("lb")
  );
  const [barWeightOption, setBarWeightOption] = useQueryState(
    "bar",
    parseAsInteger.withDefault(45) // This is always in LB as per UI
  );

  // Local state for the input field to allow typing before submission
  const [inputWeight, setInputWeight] = useState<string>(
    targetWeightQuery.toString()
  );
  // State for warmup percentages - initialized from cookies or defaults
  const [warmupPercentages, setWarmupPercentages] = useState<number[]>(() => {
    const savedPercentages = Cookies.get("warmupPercentages");
    if (savedPercentages) {
      try {
        const parsed = JSON.parse(savedPercentages);
        if (
          Array.isArray(parsed) &&
          parsed.every((p) => typeof p === "number" && p >= 0 && p <= 1) &&
          parsed.length === WARMUP_PERCENTAGES.length
        ) {
          console.log("INFO: Loaded warmup percentages from cookie:", parsed);
          return parsed;
        }
        console.warn(
          "WARN: Invalid warmup percentages in cookie, using defaults."
        );
      } catch (error) {
        console.warn(
          "WARN: Error parsing warmup percentages from cookie, using defaults.",
          error
        );
      }
    }
    console.log("INFO: No warmup percentages found in cookie, using defaults.");
    return WARMUP_PERCENTAGES;
  });

  const isKg = units === "kg";
  // Bar weight in the currently selected unit system
  const actualBarWeight = isKg
    ? roundToNearestIncrement(barWeightOption * LB_TO_KG, 1.25)
    : barWeightOption;
  const availablePlates = isKg ? KG_PLATES : LB_PLATES_FULL;
  const displayUnit = isKg ? "kg" : "lb";

  // Target weight in the currently selected unit system
  const currentDisplayTargetWeight = isKg
    ? roundToNearestIncrement(targetWeightQuery * LB_TO_KG, 2.5) // If input was LB, convert to KG
    : targetWeightQuery; // If input was KG, it's already in LB by query (or if it's LB, it's LB)

  // This ensures that if the unit is KG, the targetWeightQuery (which is always stored as if it were LB)
  // is converted to KG for display and calculation.
  const effectiveTargetWeightForCalc = isKg
    ? roundToNearestIncrement(targetWeightQuery * LB_TO_KG, 2.5)
    : targetWeightQuery;

  const platesPerSide = useMemo(() => {
    return calculatePlates(
      effectiveTargetWeightForCalc,
      actualBarWeight,
      availablePlates
    );
  }, [effectiveTargetWeightForCalc, actualBarWeight, availablePlates]);

  const warmupSets = useMemo(() => {
    // Warmup calculations should be based on the *intended* target weight in its original unit system.
    // The targetWeightQuery is always the "LB equivalent" or the direct LB value.
    const baseTargetLb = targetWeightQuery; // This is the value entered, treated as LB or converted to LB if KG was selected.
    const barWeightLb = barWeightOption; // Always use the selected LB bar weight for percentage base

    return warmupPercentages.map((perc, index) => {
      let warmupWeightLb = roundToNearestIncrement(baseTargetLb * perc, 5); // Calculate warmup in LBs
      if (warmupWeightLb < barWeightLb) warmupWeightLb = barWeightLb;

      let displayWarmupWeight: number;
      let platesForWarmup: number[];
      let barForWarmupCalc: number;

      if (isKg) {
        displayWarmupWeight = roundToNearestIncrement(
          warmupWeightLb * LB_TO_KG,
          1.25
        ); // Convert to KG for display
        barForWarmupCalc = roundToNearestIncrement(
          barWeightLb * LB_TO_KG,
          1.25
        );
        platesForWarmup = calculatePlates(
          displayWarmupWeight,
          barForWarmupCalc,
          KG_PLATES
        );
      } else {
        displayWarmupWeight = warmupWeightLb;
        barForWarmupCalc = barWeightLb;
        platesForWarmup = calculatePlates(
          displayWarmupWeight,
          barForWarmupCalc,
          LB_PLATES_FULL
        );
      }

      return {
        setNumber: index + 1,
        weight: displayWarmupWeight,
        plates: platesForWarmup,
        percentage: perc,
      };
    });
  }, [targetWeightQuery, barWeightOption, isKg, warmupPercentages]);

  const handleWeightSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newWeight = Number.parseInt(inputWeight, 10);
    if (!Number.isNaN(newWeight) && newWeight > 0) {
      // Store the raw input. If units are KG, it will be converted for display/calc.
      // If units are LB, it's used directly.
      // nuqs will store this value.
      setTargetWeightQuery(newWeight);
      console.log("INFO: Target weight submitted", newWeight);
    } else {
      // Reset input to current query if invalid
      setInputWeight(targetWeightQuery.toString());
      console.warn("WARN: Invalid weight input, resetting to current query");
    }
  };

  const handlePercentageChange = (setIndex: number, newPercentage: number) => {
    console.log(
      `INFO: Warmup percentage for set ${setIndex + 1} changed to ${(
        newPercentage * 100
      ).toFixed(0)}%`
    );
    const newPercentages = [...warmupPercentages];
    newPercentages[setIndex] = newPercentage;
    setWarmupPercentages(newPercentages);
    Cookies.set("warmupPercentages", JSON.stringify(newPercentages), {
      expires: 365,
    });
    console.log("INFO: Warmup percentages saved to cookie:", newPercentages);
  };

  // Update input field if query param changes (e.g. back button)
  React.useEffect(() => {
    setInputWeight(targetWeightQuery.toString());
    console.log("DEBUG: inputWeight synced with targetWeightQuery");
  }, [targetWeightQuery]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {/* <Head> is not available here, so styles are applied globally or inline */}

      <div className="mx-auto max-w-2xl border-4 border-black bg-white font-mono shadow-[8px_8px_0px_#000]">
        <h1 className="mb-5 border-black border-b-3 pb-2.5 text-center text-4xl text-black tracking-wider dark:text-black">
          BARBELL CALCULATOR
        </h1>

        <form
          onSubmit={handleWeightSubmit}
          className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3.5 border-3 border-black p-3.5 "
        >
          <div className="flex flex-col">
            <label
              htmlFor="weightInput"
              className="mb-2 font-bold text-base text-black dark:text-black"
            >
              TARGET WEIGHT:
            </label>
            <input
              id="weightInput"
              type="number"
              value={inputWeight}
              onChange={(e) => setInputWeight(e.target.value)}
              className="box-border w-full rounded-none border-2 border-black bg-white p-2.5 text-lg dark:text-black"
              required
              min="0"
            />
          </div>
          <div className="flex flex-row gap-4">
            <div className="flex h-full flex-col">
              <label
                htmlFor="units-lb"
                className="mb-2 font-bold text-base text-black dark:text-black"
              >
                UNITS:
              </label>
              <div className="flex h-full items-center justify-center gap-2.5 rounded-none border-2 border-black bg-white p-2">
                <label
                  className={`flex-1 cursor-pointer rounded-none border-2 border-black bg-gray-300 px-2.5 py-1 text-center text-black text-sm dark:text-black ${
                    units === "lb" ? "bg-black text-black dark:text-black" : ""
                  }`}
                  htmlFor="units-lb"
                >
                  <input
                    id="units-lb"
                    type="radio"
                    name="units"
                    value="lb"
                    checked={units === "lb"}
                    onChange={() => setUnits("lb")}
                    className="hidden"
                  />
                  LB
                </label>
                <label
                  className={`flex-1 cursor-pointer rounded-none border-2 border-black bg-gray-300 px-2.5 py-1 text-center text-black text-sm dark:text-black ${
                    units === "kg" ? "bg-black text-black" : ""
                  }`}
                  htmlFor="units-kg"
                >
                  <input
                    id="units-kg"
                    type="radio"
                    name="units"
                    value="kg"
                    checked={units === "kg"}
                    onChange={() => setUnits("kg")}
                    className="hidden"
                  />
                  KG
                </label>
              </div>
            </div>

            <div className="flex w-full flex-col">
              <label
                htmlFor="bar-45"
                className="mb-2 font-bold text-base text-black dark:text-black"
              >
                BAR (LB):
              </label>
              <div className="flex gap-2.5 rounded-none border-2 border-black bg-white p-2">
                <label
                  className={`flex-1 cursor-pointer rounded-none border-2 border-black bg-gray-300 px-2.5 py-1 text-center text-black text-sm dark:text-black ${
                    barWeightOption === 45 ? "bg-black text-black" : ""
                  }`}
                  htmlFor="bar-45"
                >
                  <input
                    id="bar-45"
                    type="radio"
                    name="bar"
                    value={45}
                    checked={barWeightOption === 45}
                    onChange={() => setBarWeightOption(45)}
                    className="hidden"
                  />
                  45 lb
                </label>
                <label
                  className={`flex-1 cursor-pointer rounded-none border-2 border-black bg-gray-300 px-2.5 py-1 text-center text-black text-sm dark:text-black ${
                    barWeightOption === 35 ? "bg-black text-black" : ""
                  }`}
                  htmlFor="bar-35"
                >
                  <input
                    id="bar-35"
                    type="radio"
                    name="bar"
                    value={35}
                    checked={barWeightOption === 35}
                    onChange={() => setBarWeightOption(35)}
                    className="hidden"
                  />
                  35 lb
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="col-span-full cursor-pointer rounded-none border-3 border-black bg-black px-3.5 py-2.5 text-center font-bold text-lg text-white shadow-[3px_3px_0px_#000] transition-all duration-100 ease-in-out active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000] dark:text-white"
          >
            Calculate
          </button>
        </form>

        <div className="mb-5 border-3 border-black p-3.5 text-center font-bold text-4xl text-black dark:text-black">
          {effectiveTargetWeightForCalc.toFixed(1)}
          <small className="ml-1.25 align-middle text-[0.4em]">
            {displayUnit.toUpperCase()}
          </small>
        </div>

        <BarbellGraphic plates={platesPerSide} isKg={isKg} />

        <div className="mt-6 border-3 border-black p-3.5">
          <h3 className="mb-3.5 border-black border-b-2 pb-2 text-center text-black text-xl dark:text-black">
            WARM-UP PROTOCOL
          </h3>
          {warmupSets.map((set) => (
            <WarmupSet
              key={set.setNumber}
              setNumber={set.setNumber}
              weight={set.weight}
              plates={set.plates}
              unit={displayUnit}
              isKg={isKg}
              percentage={set.percentage}
              onPercentageChange={(newPerc) =>
                handlePercentageChange(set.setNumber - 1, newPerc)
              }
            />
          ))}
        </div>
        <div className="mt-5 border-neutral-500 border-t pt-2.5 text-center text-neutral-500 text-xs">
          Spicy WOD - Barbell Calculator
        </div>
      </div>
    </Suspense>
  );
}
