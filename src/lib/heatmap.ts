/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Heatmap Generation
 * Upsamples 14x14 patch anomaly scores with bilinear interpolation
 * and renders a smooth semi-transparent colormap overlay onto medical scan canvases.
 */

/**
 * Maps a normalized scalar intensity [0..1] to an RGBA color.
 * Uses a medical anomaly colormap: transparent blue -> cyan -> yellow -> intense red.
 */
export function intensityToRgba(t: number, opacity: number = 0.65): [number, number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));

  let r = 0;
  let g = 0;
  let b = 0;

  if (clamped < 0.25) {
    // 0..0.25: deep blue to cyan
    const f = clamped / 0.25;
    r = 0;
    g = Math.round(255 * f);
    b = 255;
  } else if (clamped < 0.5) {
    // 0.25..0.5: cyan to green
    const f = (clamped - 0.25) / 0.25;
    r = 0;
    g = 255;
    b = Math.round(255 * (1 - f));
  } else if (clamped < 0.75) {
    // 0.5..0.75: green to yellow
    const f = (clamped - 0.5) / 0.25;
    r = Math.round(255 * f);
    g = 255;
    b = 0;
  } else {
    // 0.75..1.0: yellow to fiery red
    const f = (clamped - 0.75) / 0.25;
    r = 255;
    g = Math.round(255 * (1 - f));
    b = 0;
  }

  // Smooth alpha scaling: suppress low scores, highlight high ones
  const alpha = Math.round(255 * opacity * (clamped * clamped));

  return [r, g, b, alpha];
}

/**
 * Creates an overlay canvas with the smoothed heatmap for a given set of 14x14 patch scores.
 */
export function createHeatmapCanvas(
  patchScores: number[],
  targetWidth: number,
  targetHeight: number,
  options?: {
    threshold?: number;
    opacity?: number;
    minScore?: number;
    maxScore?: number;
  }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const patchGridSize = 14;
  const opacity = options?.opacity ?? 0.6;

  // Determine normalization range
  const validScores = patchScores.length > 0 ? patchScores : [0];
  const minVal = options?.minScore ?? Math.min(...validScores);
  const maxVal = options?.maxScore ?? Math.max(...validScores);
  const range = maxVal > minVal ? maxVal - minVal : 1;
  const threshold = options?.threshold ?? minVal;

  // 1. Create a 14x14 low-res heatmap image
  const lowRes = document.createElement('canvas');
  lowRes.width = patchGridSize;
  lowRes.height = patchGridSize;
  const lowCtx = lowRes.getContext('2d');
  if (!lowCtx) return canvas;

  const lowData = lowCtx.createImageData(patchGridSize, patchGridSize);
  for (let r = 0; r < patchGridSize; r++) {
    for (let c = 0; c < patchGridSize; c++) {
      const idx = r * patchGridSize + c;
      const score = idx < patchScores.length ? patchScores[idx] : minVal;
      const pixelIdx = (r * patchGridSize + c) * 4;

      if (score < threshold) {
        // Zero or minimal intensity below patch threshold
        const [red, green, blue] = intensityToRgba(0, opacity);
        lowData.data[pixelIdx] = red;
        lowData.data[pixelIdx + 1] = green;
        lowData.data[pixelIdx + 2] = blue;
        lowData.data[pixelIdx + 3] = 0; // fully transparent
      } else {
        const norm = (score - threshold) / Math.max(0.001, maxVal - threshold);
        const [red, green, blue, alpha] = intensityToRgba(norm, opacity);
        lowData.data[pixelIdx] = red;
        lowData.data[pixelIdx + 1] = green;
        lowData.data[pixelIdx + 2] = blue;
        lowData.data[pixelIdx + 3] = alpha;
      }
    }
  }
  lowCtx.putImageData(lowData, 0, 0);

  // 2. Upscale smoothly to target canvas dimensions
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(lowRes, 0, 0, targetWidth, targetHeight);

  return canvas;
}
