/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Image Utilities
 * Safe canvas operations, EXIF/metadata stripping, thumbnailing,
 * and grayscale statistics (color difference, contrast std, Laplacian blur variance).
 */

import { THUMB_SIZE } from '../config.ts';

export interface ImageQualityMetrics {
  /** Mean absolute difference between R, G, and B channels (0..255) */
  colorDiff: number;
  /** Grayscale pixel value standard deviation on a 0..1 scale */
  contrastStd: number;
  /** Laplacian variance measuring edge sharpness/blur (higher = sharper) */
  blurVariance: number;
}

/**
 * Loads a File into an HTMLImageElement and renders it to an HTMLCanvasElement,
 * which strips any camera EXIF or patient metadata tags.
 */
export async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const dataUrl = await fileToDataUrl(file);
  return imageElementToCanvas(dataUrl);
}

/**
 * Converts a File object to an object URL / data URL safely.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Loads a data URL or image source into an offscreen HTMLCanvasElement.
 */
export function imageElementToCanvas(src: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Could not obtain 2D canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Invalid or unreadable image file'));
    img.src = src;
  });
}

/**
 * Resizes a canvas into a square thumbnail data URL for lightweight storage.
 */
export function canvasToThumbnail(
  sourceCanvas: HTMLCanvasElement,
  size: number = THUMB_SIZE
): string {
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = size;
  thumbCanvas.height = size;
  const ctx = thumbCanvas.getContext('2d');
  if (!ctx) return '';

  // Draw scaled with smooth rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(sourceCanvas, 0, 0, size, size);
  return thumbCanvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Resizes an arbitrary canvas to target dimension (e.g. 224x224).
 */
export function resizeCanvas(
  sourceCanvas: HTMLCanvasElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const target = document.createElement('canvas');
  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  }
  return target;
}

/**
 * Computes image quality metrics on a canvas:
 * 1. Mean absolute difference between R, G, B channels (color photo detection).
 * 2. Grayscale standard deviation (scale 0..1) for contrast detection.
 * 3. Laplacian variance for blur detection.
 */
export function computeImageStats(canvas: HTMLCanvasElement): ImageQualityMetrics {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { colorDiff: 0, contrastStd: 0, blurVariance: 0 };
  }

  // Work on downsampled representation (approx 128x128 max) for real-time speed
  const sampleW = Math.min(128, canvas.width);
  const sampleH = Math.min(128, canvas.height);

  let data: Uint8ClampedArray;
  if (canvas.width === sampleW && canvas.height === sampleH) {
    data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  } else {
    const tmp = document.createElement('canvas');
    tmp.width = sampleW;
    tmp.height = sampleH;
    const tmpCtx = tmp.getContext('2d');
    if (!tmpCtx) return { colorDiff: 0, contrastStd: 0, blurVariance: 0 };
    tmpCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
    data = tmpCtx.getImageData(0, 0, sampleW, sampleH).data;
  }

  const numPixels = sampleW * sampleH;
  let totalColorDiff = 0;
  const grayArray = new Float32Array(numPixels);
  let graySum = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Color difference: average distance across pairs
    const diff = (Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r)) / 3;
    totalColorDiff += diff;

    // ITU-R BT.601 luminance normalized to [0, 1]
    const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    grayArray[i] = gray;
    graySum += gray;
  }

  const colorDiff = totalColorDiff / numPixels;
  const grayMean = graySum / numPixels;

  // Grayscale contrast variance and standard deviation
  let grayVarSum = 0;
  for (let i = 0; i < numPixels; i++) {
    const diff = grayArray[i] - grayMean;
    grayVarSum += diff * diff;
  }
  const contrastStd = Math.sqrt(grayVarSum / numPixels);

  // Discrete Laplacian variance on the 2D grayscale grid
  // Kernel:
  //  0  1  0
  //  1 -4  1
  //  0  1  0
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let laplacianCount = 0;

  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const c = grayArray[y * sampleW + x] * 255.0;
      const top = grayArray[(y - 1) * sampleW + x] * 255.0;
      const bottom = grayArray[(y + 1) * sampleW + x] * 255.0;
      const left = grayArray[y * sampleW + (x - 1)] * 255.0;
      const right = grayArray[y * sampleW + (x + 1)] * 255.0;

      const lap = top + bottom + left + right - 4 * c;
      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      laplacianCount++;
    }
  }

  let blurVariance = 0;
  if (laplacianCount > 0) {
    const lapMean = laplacianSum / laplacianCount;
    blurVariance = laplacianSqSum / laplacianCount - lapMean * lapMean;
  }

  return {
    colorDiff,
    contrastStd,
    blurVariance: Math.max(0, blurVariance),
  };
}

/**
 * Creates a synthetic procedural grayscale medical-like image canvas (e.g. simulated chest silhouette).
 * Used for in-app self-testing, sample bank building, and fallback testing.
 */
export function createSyntheticScanCanvas(
  width: number = 224,
  height: number = 224,
  options?: {
    anomaly?: { x: number; y: number; radius: number; intensity: number };
    noiseLevel?: number;
    colorTint?: boolean;
    blur?: boolean;
    blank?: boolean;
  }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (options?.blank) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, width, height);
    return canvas;
  }

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;
  const noise = options?.noiseLevel ?? 0.05;

  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Base anatomical pattern (dark lung fields, bright ribs & spine)
      const dx = (x - cx) / (width * 0.45);
      const dy = (y - cy) / (height * 0.45);
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      // Rib pattern simulation
      const ribWave = Math.sin(y * 0.12) * 18;
      // Silhouette field
      let val = 120 - Math.min(100, distFromCenter * 65) + ribWave;

      // Lung cavity pockets (darker bilaterally)
      const leftLung = Math.exp(-(((x - width * 0.35) ** 2) / 600 + ((y - height * 0.5) ** 2) / 1200));
      const rightLung = Math.exp(-(((x - width * 0.65) ** 2) / 600 + ((y - height * 0.5) ** 2) / 1200));
      val -= (leftLung + rightLung) * 75;

      // Mediastinum / spine (brighter center)
      const spine = Math.exp(-(((x - cx) ** 2) / 140));
      val += spine * 60;

      // Add controlled texture noise
      val += (Math.random() - 0.5) * 255 * noise;

      // Add anomaly patch if requested
      if (options?.anomaly) {
        const adx = x - options.anomaly.x;
        const ady = y - options.anomaly.y;
        const aDist = Math.sqrt(adx * adx + ady * ady);
        if (aDist < options.anomaly.radius) {
          const falloff = 1 - aDist / options.anomaly.radius;
          val += options.anomaly.intensity * falloff;
        }
      }

      val = Math.max(0, Math.min(255, val));

      if (options?.colorTint) {
        data[idx] = Math.min(255, val + 50); // Red bias
        data[idx + 1] = Math.max(0, val - 30); // Green
        data[idx + 2] = Math.max(0, val - 40); // Blue
      } else {
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  if (options?.blur) {
    const tmp = document.createElement('canvas');
    tmp.width = width;
    tmp.height = height;
    const tmpCtx = tmp.getContext('2d');
    if (tmpCtx) {
      tmpCtx.filter = 'blur(6px)';
      tmpCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(tmp, 0, 0);
    }
  }

  return canvas;
}
