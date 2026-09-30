/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { evaluateGate } from '../lib/gate.ts';

describe('Input Safety Gate', () => {
  const defaultLimits = {
    colorDiffLimit: 12,
    minContrastStd: 0.05,
    blurLimit: 15,
    oodLimit: 1.5,
  };

  it('rejects a colour photo with high RGB divergence', () => {
    const res = evaluateGate(
      {
        colorDiff: 24.5,
        contrastStd: 0.18,
        blurVariance: 45,
        minGlobalDistance: 0.4,
      },
      defaultLimits
    );

    expect(res.passed).toBe(false);
    expect(res.reasons[0]).toContain('colour photo');
  });

  it('rejects a blank or low-contrast scan', () => {
    const res = evaluateGate(
      {
        colorDiff: 1.2,
        contrastStd: 0.02,
        blurVariance: 50,
        minGlobalDistance: 0.3,
      },
      defaultLimits
    );

    expect(res.passed).toBe(false);
    expect(res.reasons[0]).toContain('too little contrast');
  });

  it('rejects a blurry scan with low Laplacian variance', () => {
    const res = evaluateGate(
      {
        colorDiff: 2.1,
        contrastStd: 0.15,
        blurVariance: 8.5,
        minGlobalDistance: 0.3,
      },
      defaultLimits
    );

    expect(res.passed).toBe(false);
    expect(res.reasons[0]).toContain('too blurry');
  });

  it('rejects an out-of-distribution scan type / body part', () => {
    const res = evaluateGate(
      {
        colorDiff: 3.0,
        contrastStd: 0.14,
        blurVariance: 35,
        minGlobalDistance: 1.95,
      },
      defaultLimits
    );

    expect(res.passed).toBe(false);
    expect(res.reasons[0]).toContain('not look like the type of scan');
  });

  it('accepts a sharp, high-contrast, in-distribution grayscale scan', () => {
    const res = evaluateGate(
      {
        colorDiff: 2.5,
        contrastStd: 0.16,
        blurVariance: 42,
        minGlobalDistance: 0.35,
      },
      defaultLimits
    );

    expect(res.passed).toBe(true);
    expect(res.reasons.length).toBe(0);
  });
});
