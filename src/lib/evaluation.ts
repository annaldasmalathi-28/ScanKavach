/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScanKavach Clinical Evaluation & Metrics Suite
 * Provides quantitative statistical validation tools:
 * Confusion matrix (TP, FP, TN, FN), Sensitivity (Recall), Specificity,
 * Precision, F1-Score, and ROC Curve with Area Under Curve (AUC) sweep.
 */

export interface EvaluationSample {
  id: string;
  score: number;
  isAbnormal: boolean;
  actualCondition?: string;
}

export interface ConfusionMatrixMetrics {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  total: number;
  sensitivity: number; // TPR
  specificity: number; // TNR
  precision: number; // PPV
  accuracy: number;
  f1Score: number;
}

export interface RocCurvePoint {
  threshold: number;
  tpr: number; // True Positive Rate (Sensitivity)
  fpr: number; // False Positive Rate (1 - Specificity)
}

/**
 * Computes confusion matrix and clinical diagnostic statistics at a specific threshold cutoff.
 */
export function computeConfusionMatrix(
  samples: EvaluationSample[],
  threshold: number
): ConfusionMatrixMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const s of samples) {
    const predictedAbnormal = s.score >= threshold;
    if (predictedAbnormal && s.isAbnormal) tp++;
    else if (predictedAbnormal && !s.isAbnormal) fp++;
    else if (!predictedAbnormal && !s.isAbnormal) tn++;
    else if (!predictedAbnormal && s.isAbnormal) fn++;
  }

  const total = samples.length;
  const sensitivity = tp + fn > 0 ? tp / (tp + fn) : 0;
  const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const accuracy = total > 0 ? (tp + tn) / total : 0;
  const f1Score =
    precision + sensitivity > 0
      ? (2 * precision * sensitivity) / (precision + sensitivity)
      : 0;

  return {
    tp,
    fp,
    tn,
    fn,
    total,
    sensitivity: Math.round(sensitivity * 1000) / 1000,
    specificity: Math.round(specificity * 1000) / 1000,
    precision: Math.round(precision * 1000) / 1000,
    accuracy: Math.round(accuracy * 1000) / 1000,
    f1Score: Math.round(f1Score * 1000) / 1000,
  };
}

/**
 * Computes ROC curve points across a threshold sweep and estimates AUC using trapezoidal rule.
 */
export function computeRocCurve(
  samples: EvaluationSample[],
  stepCount: number = 30
): { points: RocCurvePoint[]; auc: number } {
  if (samples.length === 0) {
    return { points: [], auc: 0.5 };
  }

  const scores = samples.map((s) => s.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const stepSize = (maxScore - minScore) / stepCount || 0.02;

  const points: RocCurvePoint[] = [];

  for (let i = 0; i <= stepCount; i++) {
    const thresh = minScore + i * stepSize;
    const cm = computeConfusionMatrix(samples, thresh);
    points.push({
      threshold: Math.round(thresh * 1000) / 1000,
      tpr: cm.sensitivity,
      fpr: Math.round((1 - cm.specificity) * 1000) / 1000,
    });
  }

  // Sort by FPR ascending for numerical integration
  points.sort((a, b) => a.fpr - b.fpr);

  // Trapezoidal AUC calculation
  let auc = 0;
  for (let i = 1; i < points.length; i++) {
    const dFpr = points[i].fpr - points[i - 1].fpr;
    const avgTpr = (points[i].tpr + points[i - 1].tpr) / 2;
    auc += dFpr * avgTpr;
  }

  return {
    points,
    auc: Math.max(0.5, Math.min(1.0, Math.round(auc * 1000) / 1000)),
  };
}

/**
 * Generates a realistic synthetic evaluation cohort (e.g. 50 normal, 35 abnormal scans)
 * for clinical validation and ROC calibration demos.
 */
export function generateSyntheticCohort(): EvaluationSample[] {
  const cohort: EvaluationSample[] = [];

  // 50 Normal scans (scores clustered 0.10 .. 0.35)
  for (let i = 1; i <= 50; i++) {
    const score = 0.12 + Math.random() * 0.22 + (Math.random() < 0.05 ? 0.08 : 0);
    cohort.push({
      id: `eval_norm_${i}`,
      score: Math.round(score * 1000) / 1000,
      isAbnormal: false,
      actualCondition: 'Normal Healthy',
    });
  }

  // 35 Abnormal scans (scores clustered 0.38 .. 0.75)
  for (let i = 1; i <= 35; i++) {
    const score = 0.38 + Math.random() * 0.34 + (Math.random() < 0.1 ? -0.06 : 0);
    const conditions = ['Pneumonia', 'Pleural Effusion', 'Cardiomegaly', 'Infiltration'];
    cohort.push({
      id: `eval_abnorm_${i}`,
      score: Math.round(score * 1000) / 1000,
      isAbnormal: true,
      actualCondition: conditions[i % conditions.length],
    });
  }

  return cohort;
}
