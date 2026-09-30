/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  areaPercent,
  peakRegion,
  buildSentence,
  compute3x3Grid,
} from '../lib/explain.ts';
import { CLINICAL_DISCLAIMER } from '../config.ts';

describe('Spatial Explanation & Area Calculation', () => {
  it('computes areaPercent strictly between 0 and 100', () => {
    const scores = [0.1, 0.4, 0.6, 0.8];
    const threshold = 0.5;
    const pct = areaPercent(scores, threshold);

    expect(pct).toBe(50);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);

    // Empty array
    expect(areaPercent([], 0.5)).toBe(0);
  });

  it('identifies the correct peak region from a 3x3 grid with a hot cell', () => {
    const grid = [
      [0.1, 0.2, 0.1],
      [0.2, 0.3, 0.2],
      [0.1, 0.2, 0.95], // lower right is the hottest cell
    ];

    const region = peakRegion(grid);
    expect(region).toBe('lower right');
  });

  it('identifies centre when centre cell is highest', () => {
    const grid = [
      [0.1, 0.1, 0.1],
      [0.1, 0.8, 0.1], // centre is hottest
      [0.1, 0.1, 0.1],
    ];

    const region = peakRegion(grid);
    expect(region).toBe('centre');
  });

  it('aggregates 196 patch scores into a 3x3 grid properly', () => {
    // 196 patches (14x14)
    const patchScores = new Array(196).fill(0.2);
    // Set bottom-right 4x4 patches to 0.9
    for (let r = 10; r < 14; r++) {
      for (let c = 10; c < 14; c++) {
        patchScores[r * 14 + c] = 0.9;
      }
    }

    const grid = compute3x3Grid(patchScores, 14);
    const peak = peakRegion(grid);
    expect(peak).toBe('lower right');
  });

  it('buildSentence includes plain language location and clinical disclaimer', () => {
    const sentence = buildSentence('lower right', 12.4);
    expect(sentence).toContain('Unusual pattern in the lower right of the image, about 12% of the area.');
    expect(sentence).toContain('Not a diagnosis.');
    expect(sentence).not.toContain('lung'); // Never refers to specific organs/diseases
  });

  it('buildSentence returns neutral message when no region exceeds threshold', () => {
    const sentence = buildSentence(null, 0);
    expect(sentence).toBe('No region stands out from the healthy reference set.');
  });
});
