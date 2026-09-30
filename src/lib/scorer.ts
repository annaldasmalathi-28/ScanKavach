/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Anomaly Scorer
 * Efficient chunked matrix-multiplication nearest-neighbour distance computation
 * between query patch features and the healthy memory bank.
 */

import * as tf from '@tensorflow/tfjs';
import { TOPK_PATCHES } from '../config.ts';

export interface ScoreResult {
  /** Aggregated image anomaly score (mean of top-K patch scores) */
  imageScore: number;
  /** Distance to nearest bank patch for each of the 196 query patches */
  patchScores: number[];
  /** Array of top-K largest patch scores contributing to the image score */
  topKPatchScores: number[];
}

/**
 * Computes nearest-neighbour distances for query patches against a memory bank of patches
 * using chunked tf.matmul for GPU memory efficiency and blazing speed.
 *
 * Both queryPatches and bankPatches are assumed to be L2-normalized.
 * Euclidean distance d = sqrt(2 - 2 * cos_sim).
 *
 * @param queryPatches Flattened Float32Array of query patch features [196 * dim]
 * @param bankPatches Flattened Float32Array of bank patch features [numBankPatches * dim]
 * @param numBankPatches Number of patch vectors in the bank
 * @param dim Feature dimensionality (e.g. 128)
 * @param topK Number of largest patch distances to average for image score (default 3)
 */
export function scoreQueryPatches(
  queryPatches: Float32Array,
  bankPatches: Float32Array,
  numBankPatches: number,
  dim: number,
  topK: number = TOPK_PATCHES
): ScoreResult {
  if (numBankPatches === 0) {
    return {
      imageScore: 0,
      patchScores: new Array(196).fill(0),
      topKPatchScores: [0, 0, 0],
    };
  }

  const numQueryPatches = Math.floor(queryPatches.length / dim); // usually 196

  // Use tf.tidy to ensure no tensor allocations leak
  const patchScoresArray = tf.tidy(() => {
    const qTensor = tf.tensor2d(queryPatches, [numQueryPatches, dim]); // [196, D]

    // Chunk size for bank patches to avoid large temporary intermediate matrices
    const chunkSize = 2000;
    let maxSimTensor: tf.Tensor1D | null = null; // [196]

    for (let offset = 0; offset < numBankPatches; offset += chunkSize) {
      const currentChunkSize = Math.min(chunkSize, numBankPatches - offset);
      const chunkData = bankPatches.subarray(
        offset * dim,
        (offset + currentChunkSize) * dim
      );
      const bChunk = tf.tensor2d(chunkData, [currentChunkSize, dim]); // [C, D]

      // Cosine similarity: Q * B^T -> [196, C]
      const simChunk = tf.matMul(qTensor, bChunk, false, true);
      // Max similarity across this bank chunk for each query patch -> [196]
      const chunkMax = tf.max(simChunk, 1) as tf.Tensor1D;

      if (!maxSimTensor) {
        maxSimTensor = chunkMax;
      } else {
        const prev: tf.Tensor1D = maxSimTensor;
        maxSimTensor = tf.maximum(prev, chunkMax);
      }
    }

    if (!maxSimTensor) {
      maxSimTensor = tf.zeros([numQueryPatches]);
    }

    // Clip similarity to [-1, 1] to prevent NaN in sqrt due to precision drift
    const clampedSim = tf.clipByValue(maxSimTensor, -1.0, 1.0);
    // Euclidean distance: sqrt(2 - 2 * sim)
    const distSq = tf.sub(2.0, tf.mul(2.0, clampedSim));
    const distTensor = tf.sqrt(tf.maximum(0.0, distSq));

    return Array.from(distTensor.dataSync());
  });

  // Calculate top-K mean image score
  const sortedDistances = [...patchScoresArray].sort((a, b) => b - a);
  const actualK = Math.min(topK, sortedDistances.length);
  const topKSlice = sortedDistances.slice(0, actualK);
  const sumTopK = topKSlice.reduce((acc, val) => acc + val, 0);
  const imageScore = actualK > 0 ? sumTopK / actualK : 0;

  return {
    imageScore,
    patchScores: patchScoresArray,
    topKPatchScores: topKSlice,
  };
}

/**
 * Computes Euclidean distance between two L2-normalized vectors on CPU.
 */
export function vectorDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  const clampedDot = Math.max(-1.0, Math.min(1.0, dot));
  return Math.sqrt(Math.max(0, 2 - 2 * clampedDot));
}

/**
 * Pure CPU nearest-neighbour scorer for testing and edge cases without TensorFlow context.
 */
export function scoreQueryPatchesCpu(
  queryPatches: Float32Array,
  bankPatches: Float32Array,
  numBankPatches: number,
  dim: number,
  topK: number = TOPK_PATCHES
): ScoreResult {
  const numQueryPatches = Math.floor(queryPatches.length / dim);
  const patchScores: number[] = new Array(numQueryPatches).fill(0);

  for (let q = 0; q < numQueryPatches; q++) {
    const qOffset = q * dim;
    let maxSim = -1.0;

    for (let b = 0; b < numBankPatches; b++) {
      const bOffset = b * dim;
      let dot = 0;
      for (let d = 0; d < dim; d++) {
        dot += queryPatches[qOffset + d] * bankPatches[bOffset + d];
      }
      if (dot > maxSim) {
        maxSim = dot;
      }
    }

    const clampedSim = Math.max(-1.0, Math.min(1.0, maxSim));
    patchScores[q] = Math.sqrt(Math.max(0, 2 - 2 * clampedSim));
  }

  const sorted = [...patchScores].sort((a, b) => b - a);
  const actualK = Math.min(topK, sorted.length);
  const topKSlice = sorted.slice(0, actualK);
  const imageScore = actualK > 0 ? topKSlice.reduce((a, b) => a + b, 0) / actualK : 0;

  return {
    imageScore,
    patchScores,
    topKPatchScores: topKSlice,
  };
}
