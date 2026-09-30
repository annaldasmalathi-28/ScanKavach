/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Memory Bank Management
 * Builds, subsamples, persists (IndexedDB), exports/imports, and provides
 * access to the reference set of normal patch features and calibration parameters.
 */

import {
  MAX_BANK_PATCHES,
  MAX_THUMBNAILS,
  MIN_NORMALS,
} from '../config.ts';
import { CalibrationCutoffs, computeCalibrationCutoffs, splitDataset } from './calibration.ts';
import { extractFeatures } from './extractor.ts';
import {
  canvasToThumbnail,
  computeImageStats,
  fileToCanvas,
} from './imageUtils.ts';
import { scoreQueryPatches, vectorDistance } from './scorer.ts';

export interface StoredThumbnail {
  imageId: string;
  dataUrl: string;
  globalEmbedding: number[];
}

export interface MemoryBankData {
  version: number;
  createdAt: string;
  healthyScanCount: number;
  bankPatchCount: number;
  dim: number;
  /** Flattened Float32Array serialized as number[] */
  patches: number[];
  /** imageId corresponding to each patch in `patches` */
  patchImageIds: string[];
  /** Cached thumbnails for nearest healthy neighbor display */
  thumbnails: Record<string, StoredThumbnail>;
  /** Empirical calibration thresholds derived from the held-out validation set */
  calibration: CalibrationCutoffs;
}

export interface BuildProgress {
  phase: 'extracting_bank' | 'extracting_val' | 'calibrating' | 'saving' | 'complete';
  current: number;
  total: number;
  message: string;
}

const DB_NAME = 'scankavach_bank_db';
const STORE_NAME = 'bank_store';
const BANK_KEY = 'active_memory_bank';

// In-memory fallback if IndexedDB is unavailable
let activeBankInMemory: MemoryBankData | null = null;
let activePatchesFloat32: Float32Array | null = null;

/**
 * Opens the IndexedDB database safely.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Saves bank data to IndexedDB.
 */
export async function saveBankToDb(bank: MemoryBankData): Promise<void> {
  activeBankInMemory = bank;
  activePatchesFloat32 = new Float32Array(bank.patches);

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(bank, BANK_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('Could not persist memory bank to IndexedDB, retaining in memory:', err);
  }
}

/**
 * Loads bank data from IndexedDB or memory cache.
 */
export async function loadBankFromDb(): Promise<MemoryBankData | null> {
  if (activeBankInMemory) {
    return activeBankInMemory;
  }

  try {
    const db = await openDb();
    const bank = await new Promise<MemoryBankData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(BANK_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });

    if (bank) {
      activeBankInMemory = bank;
      activePatchesFloat32 = new Float32Array(bank.patches);
    }
    return bank;
  } catch (err) {
    console.warn('Failed to load bank from IndexedDB:', err);
    return null;
  }
}

/**
 * Clears the active memory bank from both memory and IndexedDB.
 */
export async function clearBankFromDb(): Promise<void> {
  activeBankInMemory = null;
  activePatchesFloat32 = null;

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(BANK_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('Error clearing bank from IndexedDB:', err);
  }
}

/**
 * Returns the active bank in memory or null.
 */
export function getActiveBank(): MemoryBankData | null {
  return activeBankInMemory;
}

/**
 * Returns Float32Array of bank patches for fast computation.
 */
export function getActiveBankPatches(): Float32Array | null {
  if (activePatchesFloat32) return activePatchesFloat32;
  if (activeBankInMemory?.patches) {
    activePatchesFloat32 = new Float32Array(activeBankInMemory.patches);
    return activePatchesFloat32;
  }
  return null;
}

/**
 * Builds a calibrated memory bank from a collection of healthy scan images.
 */
export async function buildMemoryBank(
  scans: Array<File | HTMLCanvasElement>,
  onProgress?: (p: BuildProgress) => void
): Promise<MemoryBankData> {
  if (scans.length < MIN_NORMALS) {
    throw new Error(
      `At least ${MIN_NORMALS} healthy scans are required to build a reference bank (received ${scans.length}).`
    );
  }

  // 1. Convert any File items to canvases (stripping EXIF metadata)
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < scans.length; i++) {
    const item = scans[i];
    if (item instanceof HTMLCanvasElement) {
      canvases.push(item);
    } else {
      const c = await fileToCanvas(item);
      canvases.push(c);
    }
  }

  // 2. Split into Bank Set (BANK_FRACTION) and Validation Set with NO overlap
  const { train: bankCanvases, val: valCanvases } = splitDataset(canvases);

  const bankPatchChunks: Float32Array[] = [];
  const bankPatchImageIds: string[] = [];
  const thumbnails: Record<string, StoredThumbnail> = {};
  const bankGlobalEmbeddings: { id: string; emb: Float32Array }[] = [];
  let featureDim = 0;

  // 3. Process Bank Images
  for (let i = 0; i < bankCanvases.length; i++) {
    const canvas = bankCanvases[i];
    const imageId = `bank_${Date.now()}_${i}`;

    onProgress?.({
      phase: 'extracting_bank',
      current: i + 1,
      total: bankCanvases.length,
      message: `Extracting features from reference scan ${i + 1} of ${bankCanvases.length}...`,
    });

    const features = await extractFeatures(canvas);
    featureDim = features.dim;
    bankPatchChunks.push(features.patchFeatures);

    for (let p = 0; p < features.patchCount; p++) {
      bankPatchImageIds.push(imageId);
    }

    bankGlobalEmbeddings.push({
      id: imageId,
      emb: features.globalEmbedding,
    });

    if (Object.keys(thumbnails).length < MAX_THUMBNAILS) {
      thumbnails[imageId] = {
        imageId,
        dataUrl: canvasToThumbnail(canvas),
        globalEmbedding: Array.from(features.globalEmbedding),
      };
    }

    // Yield control to UI thread
    await new Promise((r) => setTimeout(r, 0));
  }

  // Combine raw bank patches
  const totalRawPatches = bankPatchImageIds.length;
  const mergedBankPatches = new Float32Array(totalRawPatches * featureDim);
  let copyOffset = 0;
  for (const chunk of bankPatchChunks) {
    mergedBankPatches.set(chunk, copyOffset);
    copyOffset += chunk.length;
  }

  // 4. Randomly subsample patches if exceeding MAX_BANK_PATCHES
  let finalBankPatches: Float32Array;
  let finalPatchImageIds: string[];

  if (totalRawPatches > MAX_BANK_PATCHES) {
    const indices: number[] = [];
    for (let i = 0; i < totalRawPatches; i++) indices.push(i);

    // Random shuffle indices
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const selectedIndices = indices.slice(0, MAX_BANK_PATCHES);
    finalBankPatches = new Float32Array(MAX_BANK_PATCHES * featureDim);
    finalPatchImageIds = new Array(MAX_BANK_PATCHES);

    for (let i = 0; i < MAX_BANK_PATCHES; i++) {
      const srcIdx = selectedIndices[i];
      const srcSlice = mergedBankPatches.subarray(
        srcIdx * featureDim,
        (srcIdx + 1) * featureDim
      );
      finalBankPatches.set(srcSlice, i * featureDim);
      finalPatchImageIds[i] = bankPatchImageIds[srcIdx];
    }
  } else {
    finalBankPatches = mergedBankPatches;
    finalPatchImageIds = bankPatchImageIds;
  }

  const finalPatchCount = finalPatchImageIds.length;

  // 5. Evaluate Held-out Validation Images against the Bank
  const valImageScores: number[] = [];
  const valPatchScores: number[] = [];
  const valEmbedDistances: number[] = [];
  const valBlurScores: number[] = [];

  for (let i = 0; i < valCanvases.length; i++) {
    const canvas = valCanvases[i];
    onProgress?.({
      phase: 'extracting_val',
      current: i + 1,
      total: valCanvases.length,
      message: `Calibrating on held-out validation scan ${i + 1} of ${valCanvases.length}...`,
    });

    const features = await extractFeatures(canvas);
    const scoreRes = scoreQueryPatches(
      features.patchFeatures,
      finalBankPatches,
      finalPatchCount,
      featureDim
    );

    valImageScores.push(scoreRes.imageScore);
    valPatchScores.push(...scoreRes.patchScores);

    // Compute nearest global embedding distance to bank
    let minEmbedDist = Infinity;
    for (const b of bankGlobalEmbeddings) {
      const dist = vectorDistance(features.globalEmbedding, b.emb);
      if (dist < minEmbedDist) {
        minEmbedDist = dist;
      }
    }
    valEmbedDistances.push(minEmbedDist === Infinity ? 0.5 : minEmbedDist);

    // Compute quality metrics (blur and contrast)
    const stats = computeImageStats(canvas);
    valBlurScores.push(stats.blurVariance);

    await new Promise((r) => setTimeout(r, 0));
  }

  // 6. Compute Calibrated Cutoffs
  onProgress?.({
    phase: 'calibrating',
    current: 1,
    total: 1,
    message: 'Computing percentile cutoffs and safety thresholds...',
  });

  const calibration = computeCalibrationCutoffs(
    valImageScores,
    valPatchScores,
    valEmbedDistances,
    valBlurScores
  );

  const bankData: MemoryBankData = {
    version: 1,
    createdAt: new Date().toISOString(),
    healthyScanCount: canvases.length,
    bankPatchCount: finalPatchCount,
    dim: featureDim,
    patches: Array.from(finalBankPatches),
    patchImageIds: finalPatchImageIds,
    thumbnails,
    calibration,
  };

  onProgress?.({
    phase: 'saving',
    current: 1,
    total: 1,
    message: 'Saving memory bank to local storage...',
  });

  await saveBankToDb(bankData);

  onProgress?.({
    phase: 'complete',
    current: 1,
    total: 1,
    message: 'Memory bank built and calibrated successfully!',
  });

  return bankData;
}

/**
 * Exports memory bank data as a downloadable JSON file.
 */
export function exportBankToJson(bank: MemoryBankData): void {
  const jsonStr = JSON.stringify(bank);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scankavach-bank-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates an imported JSON file as a memory bank.
 */
export async function importBankFromJson(file: File): Promise<MemoryBankData> {
  const text = await file.text();
  const data = JSON.parse(text) as MemoryBankData;

  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray(data.patches) ||
    !Array.isArray(data.patchImageIds) ||
    !data.calibration
  ) {
    throw new Error('Invalid memory bank JSON format.');
  }

  await saveBankToDb(data);
  return data;
}

/**
 * Finds the nearest healthy reference thumbnail to a query global embedding.
 */
export function findNearestHealthyThumbnail(
  queryGlobalEmb: Float32Array,
  bank: MemoryBankData
): StoredThumbnail | null {
  const thumbs = Object.values(bank.thumbnails);
  if (thumbs.length === 0) return null;

  let bestThumb: StoredThumbnail | null = null;
  let minDistance = Infinity;

  for (const thumb of thumbs) {
    const thumbEmb = new Float32Array(thumb.globalEmbedding);
    const dist = vectorDistance(queryGlobalEmb, thumbEmb);
    if (dist < minDistance) {
      minDistance = dist;
      bestThumb = thumb;
    }
  }

  return bestThumb;
}

/**
 * Finds the minimum global embedding distance to any healthy scan in the bank.
 */
export function computeMinGlobalDistance(
  queryGlobalEmb: Float32Array,
  bank: MemoryBankData
): number {
  const thumbs = Object.values(bank.thumbnails);
  if (thumbs.length === 0) return 0.5;

  let minDistance = Infinity;
  for (const thumb of thumbs) {
    const thumbEmb = new Float32Array(thumb.globalEmbedding);
    const dist = vectorDistance(queryGlobalEmb, thumbEmb);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance === Infinity ? 0.5 : minDistance;
}
