/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * In-App Self-Test Suite
 * Runs browser-side operational validation tests verifying:
 * 1. Colour photo rejection by the safety gate.
 * 2. Blank / low-contrast rejection by the safety gate.
 * 3. Synthetic grayscale scan validation by the safety gate.
 * 4. Model anomaly sensitivity (injected anomaly scores higher than normal scan).
 */

import { evaluateGate } from './gate.ts';
import { extractFeatures } from './extractor.ts';
import { computeImageStats, createSyntheticScanCanvas } from './imageUtils.ts';
import { scoreQueryPatches } from './scorer.ts';

export interface SelfTestItem {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export async function runSelfTests(): Promise<SelfTestItem[]> {
  const results: SelfTestItem[] = [];

  // TEST 1: Color Photo Rejection
  const start1 = performance.now();
  try {
    const colorCanvas = createSyntheticScanCanvas(224, 224, { colorTint: true });
    const stats = computeImageStats(colorCanvas);
    const gateRes = evaluateGate(stats);
    const passed =
      !gateRes.passed &&
      gateRes.reasons.some((r) => r.includes('colour photo'));

    results.push({
      id: 'test_color_rejection',
      name: 'Safety Gate: Colour Rejection',
      description: 'Verifies colour photos are flagged and stopped with appropriate clinical notice.',
      passed,
      message: passed
        ? `Passed: Correctly rejected with colorDiff=${stats.colorDiff.toFixed(1)}.`
        : `Failed: Gate allowed colour photo or gave unexpected reason (${gateRes.reasons.join(', ')}).`,
      durationMs: Math.round(performance.now() - start1),
    });
  } catch (err) {
    results.push({
      id: 'test_color_rejection',
      name: 'Safety Gate: Colour Rejection',
      description: 'Verifies colour photos are flagged and stopped.',
      passed: false,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Math.round(performance.now() - start1),
    });
  }

  // TEST 2: Blank / Low-Contrast Rejection
  const start2 = performance.now();
  try {
    const blankCanvas = createSyntheticScanCanvas(224, 224, { blank: true });
    const stats = computeImageStats(blankCanvas);
    const gateRes = evaluateGate(stats);
    const passed =
      !gateRes.passed &&
      gateRes.reasons.some((r) => r.includes('contrast'));

    results.push({
      id: 'test_blank_rejection',
      name: 'Safety Gate: Low Contrast Rejection',
      description: 'Verifies blank or zero-contrast scans are caught before model inference.',
      passed,
      message: passed
        ? `Passed: Correctly rejected with contrastStd=${stats.contrastStd.toFixed(4)}.`
        : `Failed: Gate allowed flat image (${gateRes.reasons.join(', ')}).`,
      durationMs: Math.round(performance.now() - start2),
    });
  } catch (err) {
    results.push({
      id: 'test_blank_rejection',
      name: 'Safety Gate: Low Contrast Rejection',
      description: 'Verifies blank or zero-contrast scans are caught.',
      passed: false,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Math.round(performance.now() - start2),
    });
  }

  // TEST 3: Synthetic Grayscale Scan Passes Gate
  const start3 = performance.now();
  try {
    const normalCanvas = createSyntheticScanCanvas(224, 224);
    const stats = computeImageStats(normalCanvas);
    const gateRes = evaluateGate(stats);
    const passed = gateRes.passed;

    results.push({
      id: 'test_grayscale_pass',
      name: 'Safety Gate: Valid Scan Acceptance',
      description: 'Verifies sharp grayscale scans satisfy all gate quality criteria.',
      passed,
      message: passed
        ? `Passed: Grayscale scan accepted (colorDiff=${stats.colorDiff.toFixed(1)}, contrastStd=${stats.contrastStd.toFixed(2)}, blur=${stats.blurVariance.toFixed(0)}).`
        : `Failed: Gate rejected valid scan (${gateRes.reasons.join(', ')}).`,
      durationMs: Math.round(performance.now() - start3),
    });
  } catch (err) {
    results.push({
      id: 'test_grayscale_pass',
      name: 'Safety Gate: Valid Scan Acceptance',
      description: 'Verifies sharp grayscale scans satisfy gate criteria.',
      passed: false,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Math.round(performance.now() - start3),
    });
  }

  // TEST 4: Anomaly Detection Sensitivity (Bright Blob Scores Higher)
  const start4 = performance.now();
  try {
    // Generate healthy baseline and test with injected anomaly blob
    const normal1 = createSyntheticScanCanvas(224, 224, { noiseLevel: 0.02 });
    const normal2 = createSyntheticScanCanvas(224, 224, { noiseLevel: 0.03 });
    const anomalous = createSyntheticScanCanvas(224, 224, {
      anomaly: { x: 75, y: 140, radius: 24, intensity: 130 },
      noiseLevel: 0.02,
    });

    const featNormal1 = await extractFeatures(normal1);
    const featNormal2 = await extractFeatures(normal2);
    const featAnom = await extractFeatures(anomalous);

    // Build mini bank of normal patches
    const totalPatches = featNormal1.patchCount;
    const dim = featNormal1.dim;
    const bankPatches = featNormal1.patchFeatures;

    const normalScore = scoreQueryPatches(featNormal2.patchFeatures, bankPatches, totalPatches, dim).imageScore;
    const anomScore = scoreQueryPatches(featAnom.patchFeatures, bankPatches, totalPatches, dim).imageScore;

    const passed = anomScore > normalScore;

    results.push({
      id: 'test_anomaly_sensitivity',
      name: 'Model Anomaly Sensitivity',
      description: 'Verifies that an injected foreign lesion scores measurably higher than a normal scan.',
      passed,
      message: passed
        ? `Passed: Anomalous scan scored ${anomScore.toFixed(3)} vs baseline ${normalScore.toFixed(3)} (+${((anomScore - normalScore) * 100).toFixed(1)}% elevation).`
        : `Failed: Anomaly score (${anomScore.toFixed(3)}) was not higher than normal (${normalScore.toFixed(3)}).`,
      durationMs: Math.round(performance.now() - start4),
    });
  } catch (err) {
    results.push({
      id: 'test_anomaly_sensitivity',
      name: 'Model Anomaly Sensitivity',
      description: 'Verifies anomaly detection sensitivity.',
      passed: false,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Math.round(performance.now() - start4),
    });
  }

  return results;
}
