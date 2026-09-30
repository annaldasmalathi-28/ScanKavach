/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { verdict } from '../lib/verdict.ts';

describe('Screening Verdict & Borderline Classification', () => {
  const thresholds = {
    review: 0.40,
    refer: 0.60,
  };
  const margin = 0.05; // 5% margin -> review margin: 0.02, refer margin: 0.03
  const sortedValScores = [0.10, 0.20, 0.25, 0.30, 0.35, 0.38, 0.40, 0.45, 0.50, 0.60];

  it('classifies scores well below review threshold as Normal without borderline', () => {
    const res = verdict(0.25, thresholds, margin, sortedValScores);
    expect(res.label).toBe('Normal');
    expect(res.borderline).toBe(false);
    expect(res.percentile).toBe(20);
  });

  it('flags scores just below review threshold as Normal with borderline=true', () => {
    // 0.39 is within 0.02 of 0.40 (0.38..0.42)
    const res = verdict(0.39, thresholds, margin, sortedValScores);
    expect(res.label).toBe('Normal');
    expect(res.borderline).toBe(true);
  });

  it('flags scores just above review threshold as Review with borderline=true', () => {
    // 0.41 is within 0.02 of 0.40
    const res = verdict(0.41, thresholds, margin, sortedValScores);
    expect(res.label).toBe('Review');
    expect(res.borderline).toBe(true);
  });

  it('classifies scores in the middle of Review range as Review without borderline', () => {
    // 0.50 is far from 0.40 (diff 0.10 > 0.02) and far from 0.60 (diff 0.10 > 0.03)
    const res = verdict(0.50, thresholds, margin, sortedValScores);
    expect(res.label).toBe('Review');
    expect(res.borderline).toBe(false);
  });

  it('flags scores near refer threshold as Refer with borderline=true', () => {
    // 0.61 is within 0.03 of 0.60 (0.57..0.63)
    const res = verdict(0.61, thresholds, margin, sortedValScores);
    expect(res.label).toBe('Refer');
    expect(res.borderline).toBe(true);
  });

  it('classifies scores well above refer threshold as Refer without borderline', () => {
    const res = verdict(0.85, thresholds, margin, sortedValScores);
    expect(res.label).toBe('Refer');
    expect(res.borderline).toBe(false);
    expect(res.percentile).toBe(99);
  });
});
