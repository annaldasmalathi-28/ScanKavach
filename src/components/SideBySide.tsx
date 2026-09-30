/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Layers, Eye, EyeOff, Sparkles, Sliders } from 'lucide-react';
import { createHeatmapCanvas } from '../lib/heatmap.ts';
import { StoredThumbnail } from '../lib/memoryBank.ts';

interface SideBySideProps {
  sourceCanvas: HTMLCanvasElement | null;
  patchScores: number[];
  patchThreshold: number;
  nearestHealthy: StoredThumbnail | null;
  areaPercent: number;
  peakRegion: string;
  summarySentence: string;
}

export const SideBySide: React.FC<SideBySideProps> = ({
  sourceCanvas,
  patchScores,
  patchThreshold,
  nearestHealthy,
  areaPercent,
  peakRegion,
  summarySentence,
}) => {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [opacity, setOpacity] = useState(0.65);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Redraw combined scan and heatmap on canvas
  useEffect(() => {
    const targetCanvas = canvasRef.current;
    if (!targetCanvas || !sourceCanvas) return;

    targetCanvas.width = sourceCanvas.width;
    targetCanvas.height = sourceCanvas.height;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    // Draw base scan
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.drawImage(sourceCanvas, 0, 0);

    // Overlay heatmap if enabled
    if (showHeatmap && patchScores.length > 0) {
      const heatCanvas = createHeatmapCanvas(
        patchScores,
        sourceCanvas.width,
        sourceCanvas.height,
        {
          threshold: patchThreshold,
          opacity,
        }
      );
      ctx.drawImage(heatCanvas, 0, 0);
    }
  }, [sourceCanvas, patchScores, patchThreshold, showHeatmap, opacity]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Layers className="text-teal-400" size={18} />
          <h3 className="font-semibold text-slate-100">
            Visual Inspection & Nearest Healthy Match
          </h3>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-300">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
              showHeatmap
                ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Toggle anomaly colormap overlay"
          >
            {showHeatmap ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Anomaly Heatmap {showHeatmap ? 'ON' : 'OFF'}</span>
          </button>

          {showHeatmap && (
            <div className="flex items-center gap-2">
              <Sliders size={13} className="text-slate-400" />
              <span>Opacity:</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-20 accent-teal-500 cursor-pointer"
              />
              <span className="font-mono text-slate-400 w-8">{Math.round(opacity * 100)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Images Grid */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Uploaded Scan with Overlay */}
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium text-slate-200">Screened Patient Scan</span>
            <span className="text-[11px] font-mono text-teal-400">
              {showHeatmap ? 'Colormap active' : 'Grayscale only'}
            </span>
          </div>

          <div className="relative w-full aspect-square max-w-[340px] rounded-lg overflow-hidden border border-slate-700/80 bg-black flex items-center justify-center shadow-lg shadow-black/40">
            {sourceCanvas ? (
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-xs text-slate-500">No scan rendered</div>
            )}
          </div>

          {/* Colormap Legend */}
          {showHeatmap && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
              <span>Normal</span>
              <div className="h-2 w-28 rounded bg-gradient-to-r from-transparent via-cyan-500 via-amber-400 to-red-500 border border-slate-700" />
              <span>Anomalous</span>
            </div>
          )}
        </div>

        {/* Nearest Healthy Example */}
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium text-slate-200 flex items-center gap-1.5">
              <Sparkles size={13} className="text-teal-400" />
              <span>Closest Healthy Reference Scan</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Ref ID: {nearestHealthy ? nearestHealthy.imageId.slice(0, 16) : 'None'}
            </span>
          </div>

          <div className="relative w-full aspect-square max-w-[340px] rounded-lg overflow-hidden border border-slate-700/80 bg-black flex items-center justify-center shadow-lg shadow-black/40">
            {nearestHealthy ? (
              <img
                src={nearestHealthy.dataUrl}
                alt="Nearest healthy reference scan"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                <p>No reference thumbnail available.</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Build or import a reference bank with normal scans to enable comparative side-by-side view.
                </p>
              </div>
            )}
          </div>

          <p className="mt-3 text-[11px] text-slate-400 text-center max-w-xs">
            Closest anatomical embedding in your healthy bank. Use this side-by-side to visually verify lung fields, rib contour, and positioning.
          </p>
        </div>
      </div>

      {/* Plain Language Summary Box */}
      <div className="mt-6 rounded-lg bg-teal-950/20 border border-teal-500/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-teal-400">
            Pattern Analysis & Spatial Localization
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-slate-800/80 px-2 py-0.5 border border-slate-700 text-slate-300">
              Peak: <strong className="text-teal-300 font-medium">{peakRegion}</strong>
            </span>
            <span className="rounded bg-slate-800/80 px-2 py-0.5 border border-slate-700 text-slate-300">
              Area: <strong className="text-teal-300 font-medium">{Math.round(areaPercent)}%</strong>
            </span>
          </div>
        </div>

        <p className="mt-2 text-sm text-slate-200 font-medium leading-relaxed">
          {summarySentence}
        </p>
      </div>
    </div>
  );
};
