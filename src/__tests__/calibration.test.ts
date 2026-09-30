/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePercentile,
  computeCalibrationCutoffs,
  splitDataset,
} from '../lib/calibration.ts';

describe('Calibration & Percentile Calculation', () => {
  it('calculates exact percentiles on known arrays', () => {
    // Array of 11 numbers from 0 to 10
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    expect(calculatePercentile(values, 0)).toBe(0);
    expect(calculatePercentile(values, 50)).toBe(5);
    expect(calculatePercentile(values, 100)).toBe(10);
    expect(calculatePercentile(values, 90)).toBe(9);
  });

  it('splits a dataset into bank and validation sets with zero overlap', () => {
    const items = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];
    const { train, val } = splitDataset(items, 0.7);

    // Sum equals original length
    expect(train.length + val.length).toBe(items.length);
    expect(train.length).toBe(7);
    expect(val.length).toBe(3);

    // Zero overlap
    const trainSet = new Set(train);
    for (const v of val) {
      expect(trainSet.has(v)).toBe(false);
    }
  });

  it('computes calibration cutoffs honoring mathematical bounds', () => {
    const valImageScores = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55];
    const valPatchScores = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const valEmbedDists = [0.2, 0.3, 0.4, 0.5];
    const valBlurScores = [20, 25, 30, 35, 40];

    const cutoffs = computeCalibrationCutoffs(
      valImageScores,
      valPatchScores,
      valEmbedDists,
      valBlurScores
    );

    expect(cutoffs.reviewThreshold).toBeGreaterThan(0);
    expect(cutoffs.referThreshold).toBeGreaterThanOrEqual(cutoffs.reviewThreshold);
    expect(cutoffs.blurLimit).toBeGreaterThanOrEqual(1);
    expect(cutoffs.oodLimit).toBeGreaterThan(0.5);
    expect(cutoffs.sortedValScores.length).toBe(valImageScores.length);
  });
});
