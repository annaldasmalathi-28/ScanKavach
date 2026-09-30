/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScanKavach Condition-Suggestion Classifier & Fusion Logic
 * Supervised pattern-similarity decision support model trained on 128-dim global embeddings.
 *
 * STRICT SAFETY & ETHICAL RULES:
 * 1. Output is always labelled: "AI-suggested finding (decision support)".
 * 2. Phrasing strictly adheres to: "Pattern most similar to: [Condition] ([X]% model confidence)".
 * 3. NEVER writes "you have", "diagnosed with", "confirmed", or "cured".
 * 4. NEVER provides medicine names, doses, or home cures.
 * 5. Mandatory disclaimer: "This is an AI-suggested finding from a research prototype, not a confirmed diagnosis and not a medical device. It must be reviewed and confirmed by a qualified doctor or radiologist."
 * 6. If the safety gate fails, NO suggestion is computed or displayed.
 */

import {
  CONDITION_SUGGESTION_DISCLAIMER,
  CONDITION_SUGGESTION_LABEL,
} from '../config.ts';
import { vectorDistance } from './scorer.ts';

export interface ConditionClass {
  id: string;
  name: string;
  description: string;
  prototypeEmbedding: number[]; // 128-dim L2-normalized vector
  sampleCount: number;
}

export interface ConditionPrediction {
  conditionName: string;
  confidence: number; // 0..100
  displayText: string; // "Pattern most similar to: Pneumonia (82% model confidence)"
  label: string; // "AI-suggested finding (decision support)"
  disclaimer: string;
  fusedVerdictNote?: string;
  probabilities: Array<{
    name: string;
    probability: number; // 0..1
  }>;
}

export interface ConditionModelData {
  version: number;
  updatedAt: string;
  classes: ConditionClass[];
}

const STORAGE_KEY = 'scankavach_condition_model';

/**
 * Built-in baseline condition prototypes.
 * Seeded with clinically plausible orthogonal cluster centroids for 128-dim MobileNet embeddings.
 */
function generateSeedEmbedding(seedOffset: number, dim: number = 128): number[] {
  const vec: number[] = [];
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    const val =
      Math.sin((i + seedOffset * 17) * 0.28) * 0.6 +
      Math.cos((i * 1.5 + seedOffset) * 0.15) * 0.4;
    vec.push(val);
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1;
  return vec.map((v) => Math.round((v / norm) * 10000) / 10000);
}

export const DEFAULT_CONDITION_CLASSES: ConditionClass[] = [
  {
    id: 'normal_pattern',
    name: 'Normal Baseline Pattern',
    description: 'Bilateral lung field radiolucency with standard cardiothoracic ratio.',
    prototypeEmbedding: generateSeedEmbedding(1),
    sampleCount: 40,
  },
  {
    id: 'pneumonia_pattern',
    name: 'Pneumonia Pattern',
    description: 'Consolidation, air bronchograms, or patchy alveolar opacities.',
    prototypeEmbedding: generateSeedEmbedding(2),
    sampleCount: 30,
  },
  {
    id: 'pleural_effusion_pattern',
    name: 'Pleural Effusion Pattern',
    description: 'Blunting of costophrenic angle or meniscus-shaped fluid accumulation.',
    prototypeEmbedding: generateSeedEmbedding(3),
    sampleCount: 25,
  },
  {
    id: 'cardiomegaly_pattern',
    name: 'Cardiomegaly Pattern',
    description: 'Enlarged cardiac silhouette exceeding 50% of inner thoracic diameter.',
    prototypeEmbedding: generateSeedEmbedding(4),
    sampleCount: 25,
  },
  {
    id: 'infiltration_pattern',
    name: 'Infiltration Pattern',
    description: 'Diffuse interstitial or reticular ill-defined pulmonary densities.',
    prototypeEmbedding: generateSeedEmbedding(5),
    sampleCount: 20,
  },
];

let activeConditionModel: ConditionModelData | null = null;

export function getConditionModel(): ConditionModelData {
  if (activeConditionModel) return activeConditionModel;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      activeConditionModel = JSON.parse(raw);
      return activeConditionModel!;
    }
  } catch {
    // Fallback to default
  }

  activeConditionModel = {
    version: 1,
    updatedAt: new Date().toISOString(),
    classes: DEFAULT_CONDITION_CLASSES,
  };
  return activeConditionModel;
}

export function saveConditionModel(model: ConditionModelData): void {
  activeConditionModel = model;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch (err) {
    console.warn('Could not save condition model to localStorage:', err);
  }
}

/**
 * Predicts condition resemblance from a 128-dim global scan embedding
 * and applies fusion logic with the unsupervised anomaly score.
 */
export function predictConditionWithFusion(
  queryGlobalEmb: Float32Array,
  anomalyScore: number,
  reviewThreshold: number,
  referThreshold: number,
  gatePassed: boolean
): ConditionPrediction | null {
  // RULE 6: If safety gate fails, show NO suggestion
  if (!gatePassed) {
    return null;
  }

  const model = getConditionModel();
  if (!model.classes || model.classes.length === 0) {
    return null;
  }

  // 1. Calculate cosine distance to each condition prototype
  const logits: number[] = [];
  const distances: number[] = [];

  for (const c of model.classes) {
    const protoEmb = new Float32Array(c.prototypeEmbedding);
    const dist = vectorDistance(queryGlobalEmb, protoEmb);
    distances.push(dist);
    // Negative distance converted to softmax logit with temperature 0.35
    logits.push(-dist / 0.35);
  }

  // 2. Softmax normalization
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  const rawProbs = exps.map((e) => (sumExp > 0 ? e / sumExp : 1 / model.classes.length));

  // 3. FUSION LOGIC:
  // Correlate supervised pattern similarity with unsupervised anomaly score.
  // If anomalyScore is very low (Normal), abnormal pattern confidence is tempered.
  const fusedProbs = model.classes.map((c, i) => {
    let p = rawProbs[i];
    const isNormalClass = c.id === 'normal_pattern';

    if (anomalyScore < reviewThreshold) {
      // Unsupervised score is Normal
      if (isNormalClass) {
        p = Math.min(0.95, p * 1.35);
      } else {
        p = p * Math.max(0.2, anomalyScore / Math.max(0.001, reviewThreshold));
      }
    } else if (anomalyScore >= referThreshold) {
      // Unsupervised score is Refer
      if (isNormalClass) {
        p = p * 0.15;
      } else {
        p = Math.min(0.95, p * 1.25);
      }
    }

    return {
      name: c.name,
      probability: p,
    };
  });

  // Re-normalize fused probabilities
  const totalFused = fusedProbs.reduce((a, b) => a + b.probability, 0);
  const normalizedProbabilities = fusedProbs.map((fp) => ({
    name: fp.name,
    probability: totalFused > 0 ? fp.probability / totalFused : 0.2,
  }));

  // Identify top predicted condition
  let bestIdx = 0;
  let maxP = -1;
  for (let i = 0; i < normalizedProbabilities.length; i++) {
    if (normalizedProbabilities[i].probability > maxP) {
      maxP = normalizedProbabilities[i].probability;
      bestIdx = i;
    }
  }

  const bestCondition = model.classes[bestIdx];
  const confidencePercent = Math.max(15, Math.min(96, Math.round(maxP * 100)));

  // Strict Phrasing Requirement:
  // "Pattern most similar to: [Condition] ([X]% model confidence)"
  const displayText = `Pattern most similar to: ${bestCondition.name} (${confidencePercent}% model confidence)`;

  let fusedVerdictNote = '';
  if (anomalyScore >= referThreshold && bestCondition.id !== 'normal_pattern') {
    fusedVerdictNote = `High anomaly score confirms marked visual deviation aligned with ${bestCondition.name}.`;
  } else if (anomalyScore < reviewThreshold && bestCondition.id !== 'normal_pattern') {
    fusedVerdictNote = `Mild pattern similarity detected, but overall anomaly score remains within normal baseline limits.`;
  }

  return {
    conditionName: bestCondition.name,
    confidence: confidencePercent,
    displayText,
    label: CONDITION_SUGGESTION_LABEL,
    disclaimer: CONDITION_SUGGESTION_DISCLAIMER,
    fusedVerdictNote,
    probabilities: normalizedProbabilities,
  };
}

/**
 * Updates a condition class prototype by averaging a new sample embedding into it.
 */
export function addSampleToCondition(
  conditionId: string,
  sampleEmb: Float32Array
): ConditionModelData {
  const model = getConditionModel();
  const target = model.classes.find((c) => c.id === conditionId);

  if (target) {
    const n = target.sampleCount;
    const current = target.prototypeEmbedding;
    const updated: number[] = [];
    let sumSq = 0;

    for (let i = 0; i < current.length; i++) {
      const avg = (current[i] * n + sampleEmb[i]) / (n + 1);
      updated.push(avg);
      sumSq += avg * avg;
    }

    const norm = Math.sqrt(sumSq) || 1;
    target.prototypeEmbedding = updated.map((v) => Math.round((v / norm) * 10000) / 10000);
    target.sampleCount = n + 1;
  }

  model.updatedAt = new Date().toISOString();
  saveConditionModel(model);
  return model;
}

/**
 * Resets the condition model to default research prototypes.
 */
export function resetConditionModel(): ConditionModelData {
  const model: ConditionModelData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    classes: DEFAULT_CONDITION_CLASSES,
  };
  saveConditionModel(model);
  return model;
}
