/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Input Safety Gate
 * Validates scan quality and appropriateness BEFORE screening to prevent false alarms
 * from color photographs, low-contrast/blank images, blur, or out-of-distribution body parts.
 */

import {
  COLOR_DIFF_LIMIT,
  DEFAULT_BLUR_LIMIT,
  MIN_CONTRAST_STD,
} from '../config.ts';

export interface GateInputMetrics {
  colorDiff: number;
  contrastStd: number;
  blurVariance: number;
  minGlobalDistance?: number;
}

export interface GateLimits {
  colorDiffLimit: number;
  minContrastStd: number;
  blurLimit: number;
  oodLimit?: number;
}

export interface GateResult {
  passed: boolean;
  reasons: string[];
}

/**
 * Pure function evaluating image quality metrics against safety thresholds.
 * Runs cheap checks first and stops on the first failure.
 */
export function evaluateGate(
  metrics: GateInputMetrics,
  limits: GateLimits = {
    colorDiffLimit: COLOR_DIFF_LIMIT,
    minContrastStd: MIN_CONTRAST_STD,
    blurLimit: DEFAULT_BLUR_LIMIT,
  }
): GateResult {
  const reasons: string[] = [];

  // Check 1: Color photo detection
  if (metrics.colorDiff > limits.colorDiffLimit) {
    reasons.push('This is a colour photo. Expected a grayscale medical scan.');
    return { passed: false, reasons };
  }

  // Check 2: Blank or low-contrast image
  if (metrics.contrastStd < limits.minContrastStd) {
    reasons.push('The image has too little contrast to assess.');
    return { passed: false, reasons };
  }

  // Check 3: Blurry image (Laplacian variance)
  if (metrics.blurVariance < limits.blurLimit) {
    reasons.push('The image is too blurry to assess reliably.');
    return { passed: false, reasons };
  }

  // Check 4: Out-of-distribution anatomical scan / body part
  if (
    limits.oodLimit !== undefined &&
    metrics.minGlobalDistance !== undefined &&
    metrics.minGlobalDistance > limits.oodLimit
  ) {
    reasons.push(
      'This does not look like the type of scan the reference set was built from (for example, not a chest X-ray).'
    );
    return { passed: false, reasons };
  }

  return { passed: true, reasons: [] };
}
