/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Verdict Calculation
 * Derives calibrated classification (Normal / Review / Refer),
 * borderline flags, and empirical percentile rankings against validation scans.
 */

import { BORDERLINE_MARGIN } from '../config.ts';

export type VerdictLabel = 'Normal' | 'Review' | 'Refer';

export interface VerdictResult {
  label: VerdictLabel;
  borderline: boolean;
  percentile: number;
}

export interface ScreeningThresholds {
  review: number;
  refer: number;
}

/**
 * Evaluates an anomaly score against calibrated screening thresholds.
 *
 * @param score Anomaly score of the query scan (mean of top-K patch distances)
 * @param thresholds Review and Refer cutoffs derived from healthy validation set
 * @param margin Relative margin for borderline flag (default 0.05 / 5%)
 * @param sortedValScores Optional array of sorted validation scores for empirical percentile
 */
export function verdict(
  score: number,
  thresholds: ScreeningThresholds,
  margin: number = BORDERLINE_MARGIN,
  sortedValScores?: number[]
): VerdictResult {
  let label: VerdictLabel = 'Normal';
  if (score >= thresholds.refer) {
    label = 'Refer';
  } else if (score >= thresholds.review) {
    label = 'Review';
  } else {
    label = 'Normal';
  }

  // Borderline check: within relative margin of either the review or refer cutoff
  const reviewMargin = margin * thresholds.review;
  const referMargin = margin * thresholds.refer;

  const isNearReview = Math.abs(score - thresholds.review) <= reviewMargin;
  const isNearRefer = Math.abs(score - thresholds.refer) <= referMargin;
  const borderline = isNearReview || isNearRefer;

  // Calculate empirical percentile relative to healthy validation scans
  let percentile = 50;
  if (sortedValScores && sortedValScores.length > 0) {
    const countBelow = sortedValScores.filter((s) => s < score).length;
    percentile = Math.round((countBelow / sortedValScores.length) * 100);
    percentile = Math.max(0, Math.min(99, percentile));
  } else {
    // Linear approximation if empirical validation array is missing
    if (score < thresholds.review) {
      percentile = Math.round((score / Math.max(0.001, thresholds.review)) * 95);
    } else if (score < thresholds.refer) {
      const range = Math.max(0.001, thresholds.refer - thresholds.review);
      percentile = Math.round(95 + ((score - thresholds.review) / range) * 4);
    } else {
      percentile = 99;
    }
  }

  return {
    label,
    borderline,
    percentile,
  };
}
