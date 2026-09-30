/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Anomaly Explanation Utilities
 * Computes anomaly area coverage, identifies peak spatial region on a 3x3 grid,
 * and builds plain-language summary sentences with clinical disclaimers.
 */

export type PeakRegion =
  | 'upper left'
  | 'upper centre'
  | 'upper right'
  | 'centre left'
  | 'centre'
  | 'centre right'
  | 'lower left'
  | 'lower centre'
  | 'lower right';

const REGION_NAMES: PeakRegion[][] = [
  ['upper left', 'upper centre', 'upper right'],
  ['centre left', 'centre', 'centre right'],
  ['lower left', 'lower centre', 'lower right'],
];

/**
 * Computes the percentage of image patches (0..100) whose anomaly score exceeds the patch threshold.
 */
export function areaPercent(patchScores: number[], threshold: number): number {
  if (!patchScores || patchScores.length === 0) return 0;
  const countExceeding = patchScores.filter((score) => score > threshold).length;
  const pct = (countExceeding / patchScores.length) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

/**
 * Aggregates a 14x14 patch score array (196 values) into a 3x3 spatial grid of mean scores.
 */
export function compute3x3Grid(patchScores: number[], spatialDim: number = 14): number[][] {
  const grid: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const counts: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let r = 0; r < spatialDim; r++) {
    const gridR = Math.min(2, Math.floor((r / spatialDim) * 3));
    for (let c = 0; c < spatialDim; c++) {
      const gridC = Math.min(2, Math.floor((c / spatialDim) * 3));
      const idx = r * spatialDim + c;
      const score = idx < patchScores.length ? patchScores[idx] : 0;
      grid[gridR][gridC] += score;
      counts[gridR][gridC]++;
    }
  }

  for (let gr = 0; gr < 3; gr++) {
    for (let gc = 0; gc < 3; gc++) {
      grid[gr][gc] = counts[gr][gc] > 0 ? grid[gr][gc] / counts[gr][gc] : 0;
    }
  }

  return grid;
}

/**
 * Identifies the region with the highest mean anomaly score on a 3x3 grid.
 */
export function peakRegion(grid3x3: number[][]): PeakRegion {
  let maxVal = -Infinity;
  let bestR = 1;
  let bestC = 1;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const val = grid3x3[r]?.[c] ?? 0;
      if (val > maxVal) {
        maxVal = val;
        bestR = r;
        bestC = c;
      }
    }
  }

  return REGION_NAMES[bestR][bestC];
}

/**
 * Generates a plain-language explanation sentence.
 * Always refers to "of the image" and never implies a medical diagnosis.
 */
export function buildSentence(peak: PeakRegion | null, areaPct: number): string {
  if (!peak || areaPct <= 0) {
    return 'No region stands out from the healthy reference set.';
  }

  const roundedArea = Math.round(areaPct);
  return `Unusual pattern in the ${peak} of the image, about ${roundedArea}% of the area. Not a diagnosis.`;
}
