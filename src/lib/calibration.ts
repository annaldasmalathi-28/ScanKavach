/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Calibration Utilities
 * Percentile estimation, dataset splitting (bank vs validation),
 * and empirical cutoff derivation for anomaly score thresholds and safety gates.
 */

import {
  BANK_FRACTION,
  DEFAULT_BLUR_LIMIT,
  OOD_MARGIN,
  REFER_PERCENTILE,
  REVIEW_PERCENTILE,
} from '../config.ts';

export interface CalibrationCutoffs {
  /** 95th percentile of validation image scores */
  reviewThreshold: number;
  /** 99th percentile of validation image scores */
  referThreshold: number;
  /** 99th percentile of pooled validation patch scores */
  patchThreshold: number;
  /** Half of the 5th percentile of validation Laplacian variance (min 1) */
  blurLimit: number;
  /** Max validation global embedding distance * OOD_MARGIN */
  oodLimit: number;
  /** Sorted validation image anomaly scores */
  sortedValScores: number[];
}

/**
 * Calculates the p-th percentile (0..100) of an array of numbers using linear interpolation.
 */
export function calculatePercentile(values: number[], p: number): number {
  if (!values || values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const sorted = [...values].sort((a, b) => a - b);
  const clampedP = Math.max(0, Math.min(100, p));
  const rank = (clampedP / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const fraction = rank - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  return sorted[lowerIndex] + fraction * (sorted[upperIndex] - sorted[lowerIndex]);
}

/**
 * Shuffles an array and splits into train (bank) and validation subsets with zero overlap.
 */
export function splitDataset<T>(
  items: T[],
  fraction: number = BANK_FRACTION
): { train: T[]; val: T[] } {
  if (items.length <= 1) {
    return { train: [...items], val: [] };
  }

  // Fisher-Yates shuffle on copy
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const trainCount = Math.max(1, Math.round(shuffled.length * fraction));
  const train = shuffled.slice(0, trainCount);
  const val = shuffled.slice(trainCount);

  // Guarantee at least 1 validation item if total items >= 2
  if (val.length === 0 && train.length > 1) {
    val.push(train.pop()!);
  }

  return { train, val };
}

/**
 * Derives calibrated screening thresholds from empirical validation metrics.
 */
export function computeCalibrationCutoffs(
  validationImageScores: number[],
  validationPatchScores: number[],
  validationEmbedDistances: number[],
  validationBlurScores: number[]
): CalibrationCutoffs {
  const sortedValScores = [...validationImageScores].sort((a, b) => a - b);

  // 95th percentile for Review
  const reviewThreshold = calculatePercentile(sortedValScores, REVIEW_PERCENTILE);

  // 99th percentile for Refer (ensure referThreshold >= reviewThreshold)
  const rawRefer = calculatePercentile(sortedValScores, REFER_PERCENTILE);
  const referThreshold = Math.max(rawRefer, reviewThreshold * 1.05);

  // 99th percentile of pooled patch distances
  const patchThreshold =
    validationPatchScores.length > 0
      ? calculatePercentile(validationPatchScores, 99)
      : reviewThreshold;

  // Half of the 5th percentile of validation Laplacian variance, minimum 1
  const p5Blur =
    validationBlurScores.length > 0
      ? calculatePercentile(validationBlurScores, 5)
      : DEFAULT_BLUR_LIMIT * 2;
  const blurLimit = Math.max(1, Math.round(p5Blur * 0.5 * 10) / 10);

  // Max global embedding distance * OOD_MARGIN (or fallback)
  const maxEmbedDist =
    validationEmbedDistances.length > 0
      ? Math.max(...validationEmbedDistances)
      : 0.8;
  const oodLimit = Math.max(0.2, maxEmbedDist * OOD_MARGIN);

  return {
    reviewThreshold,
    referThreshold,
    patchThreshold,
    blurLimit,
    oodLimit,
    sortedValScores,
  };
}
