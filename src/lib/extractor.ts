/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Feature Extractor using TensorFlow.js & MobileNet v1 0.25 224
 * Lazily loads the backbone, extracts L2-normalized 14x14 patch embeddings
 * and a pooled global embedding.
 */

import * as tf from '@tensorflow/tfjs';
import {
  IMG_SIZE,
  MOBILENET_MODEL_URL,
  PATCH_LAYER,
} from '../config.ts';

export type ModelStatus = 'unloaded' | 'loading' | 'ready' | 'error';

export interface ExtractorFeatures {
  /** Flattened array of patch feature vectors [patchCount * dim] */
  patchFeatures: Float32Array;
  /** Number of patches extracted (14 x 14 = 196) */
  patchCount: number;
  /** Embedding dimensionality per patch */
  dim: number;
  /** Global L2-normalized image embedding vector [dim] */
  globalEmbedding: Float32Array;
}

export interface ModelLoadingState {
  status: ModelStatus;
  progress: number; // 0..100
  error: string | null;
}

let extractorModel: tf.LayersModel | null = null;
let currentStatus: ModelStatus = 'unloaded';
let currentProgress = 0;
let currentError: string | null = null;
let loadPromise: Promise<tf.LayersModel> | null = null;

const listeners = new Set<(state: ModelLoadingState) => void>();

function notifyListeners() {
  const state: ModelLoadingState = {
    status: currentStatus,
    progress: currentProgress,
    error: currentError,
  };
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (e) {
      console.error('Error in model state listener:', e);
    }
  });
}

/**
 * Subscribes to model loading state updates.
 */
export function subscribeModelStatus(
  listener: (state: ModelLoadingState) => void
): () => void {
  listeners.add(listener);
  listener({
    status: currentStatus,
    progress: currentProgress,
    error: currentError,
  });
  return () => {
    listeners.delete(listener);
  };
}

export function getModelStatus(): ModelLoadingState {
  return {
    status: currentStatus,
    progress: currentProgress,
    error: currentError,
  };
}

/**
 * Initializes TensorFlow backend: tries WebGL first, falls back to CPU automatically.
 */
async function initBackend(): Promise<string> {
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    return 'webgl';
  } catch (webglErr) {
    console.warn('WebGL backend unavailable, falling back to CPU:', webglErr);
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      return 'cpu';
    } catch (cpuErr) {
      console.error('Failed to initialize CPU backend:', cpuErr);
      throw new Error('No supported TensorFlow.js backend available.');
    }
  }
}

/**
 * Finds the appropriate 14x14 layer in MobileNet v1 if the default PATCH_LAYER is missing.
 */
function find14x14Layer(model: tf.LayersModel): tf.layers.Layer | null {
  try {
    const layer = model.getLayer(PATCH_LAYER);
    if (layer) return layer;
  } catch {
    // Layer name not found, inspect layers
  }

  // Iterate backwards to find the last layer producing 14x14 spatial output
  for (let i = model.layers.length - 1; i >= 0; i--) {
    const l = model.layers[i];
    const shape = l.outputShape;
    if (Array.isArray(shape) && shape.length === 4) {
      const h = shape[1];
      const w = shape[2];
      if (h === 14 && w === 14) {
        return l;
      }
    }
  }

  return null;
}

/**
 * Loads the MobileNet v1 0.25 224 model lazily and builds the frozen patch extractor.
 * Safe to call multiple times; returns existing model if already loaded or in progress.
 */
export async function loadExtractorModel(): Promise<tf.LayersModel> {
  if (extractorModel) {
    currentStatus = 'ready';
    currentProgress = 100;
    notifyListeners();
    return extractorModel;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      currentStatus = 'loading';
      currentProgress = 10;
      currentError = null;
      notifyListeners();

      await initBackend();
      currentProgress = 25;
      notifyListeners();

      // Load base MobileNet model with download progress tracking
      const baseModel = await tf.loadLayersModel(MOBILENET_MODEL_URL, {
        onProgress: (fraction) => {
          currentProgress = Math.round(25 + fraction * 55); // 25..80%
          notifyListeners();
        },
      });

      currentProgress = 85;
      notifyListeners();

      // Select target layer (conv_pw_11_relu or last 14x14 layer)
      const targetLayer = find14x14Layer(baseModel);
      if (!targetLayer) {
        throw new Error(
          `Could not locate layer '${PATCH_LAYER}' or any 14x14 layer in MobileNet architecture.`
        );
      }

      // Build frozen patch extractor model
      const input = baseModel.inputs;
      const output = targetLayer.output as tf.SymbolicTensor;
      const extractor = tf.model({ inputs: input, outputs: output });

      // Freeze all layers
      extractor.layers.forEach((l) => {
        l.trainable = false;
      });

      // Warm up model with one dummy prediction to compile execution graph
      currentProgress = 95;
      notifyListeners();

      tf.tidy(() => {
        const dummy = tf.zeros([1, IMG_SIZE, IMG_SIZE, 3]);
        const result = extractor.predict(dummy) as tf.Tensor;
        // Force evaluation
        result.dataSync();
      });

      extractorModel = extractor;
      currentStatus = 'ready';
      currentProgress = 100;
      notifyListeners();

      return extractor;
    } catch (err) {
      currentStatus = 'error';
      currentError = err instanceof Error ? err.message : 'Failed to load feature extractor model';
      loadPromise = null;
      notifyListeners();
      throw err;
    }
  })();

  return loadPromise;
}

/**
 * Retries model loading if an error occurred.
 */
export async function retryLoadModel(): Promise<tf.LayersModel> {
  extractorModel = null;
  loadPromise = null;
  currentError = null;
  currentStatus = 'unloaded';
  currentProgress = 0;
  notifyListeners();
  return loadExtractorModel();
}

/**
 * Extracts normalized patch feature vectors and a global embedding from an HTMLCanvasElement.
 * All tensor allocations are managed within tf.tidy to prevent GPU memory leaks.
 */
export async function extractFeatures(
  canvas: HTMLCanvasElement
): Promise<ExtractorFeatures> {
  const model = await loadExtractorModel();

  return tf.tidy(() => {
    // 1. Convert canvas to tensor [H, W, 3]
    const rawTensor = tf.browser.fromPixels(canvas, 3);

    // 2. Resize to [224, 224] if necessary
    let resized: tf.Tensor3D;
    if (rawTensor.shape[0] !== IMG_SIZE || rawTensor.shape[1] !== IMG_SIZE) {
      resized = tf.image.resizeBilinear(rawTensor, [IMG_SIZE, IMG_SIZE]);
    } else {
      resized = rawTensor;
    }

    // 3. Preprocess to [-1, 1] range: (x / 127.5) - 1.0
    const floatTensor = resized.toFloat();
    const preprocessed = tf.sub(tf.div(floatTensor, 127.5), 1.0);
    const batched = tf.expandDims(preprocessed, 0); // [1, 224, 224, 3]

    // 4. Pass through frozen extractor -> [1, 14, 14, C]
    const featureMap = model.predict(batched) as tf.Tensor4D;
    const [, h, w, c] = featureMap.shape;
    const patchCount = h * w; // 196

    // 5. Reshape to [196, C]
    const reshapedPatches = tf.reshape(featureMap, [patchCount, c]);

    // 6. L2-normalize patch features along channel dimension
    const patchNorms = tf.norm(reshapedPatches, 2, -1, true);
    // Add epsilon for numerical stability
    const stablePatchNorms = tf.add(patchNorms, 1e-12);
    const normalizedPatches = tf.div(reshapedPatches, stablePatchNorms);

    // 7. Global embedding: mean of patch features, L2-normalized
    const meanEmbedding = tf.mean(normalizedPatches, 0, true); // [1, C]
    const globalNorm = tf.add(tf.norm(meanEmbedding, 2, -1, true), 1e-12);
    const normalizedGlobal = tf.div(meanEmbedding, globalNorm);

    // 8. Extract raw Float32Array copies
    const patchData = normalizedPatches.dataSync() as Float32Array;
    const globalData = normalizedGlobal.dataSync() as Float32Array;

    return {
      patchFeatures: new Float32Array(patchData),
      patchCount,
      dim: c,
      globalEmbedding: new Float32Array(globalData),
    };
  });
}
