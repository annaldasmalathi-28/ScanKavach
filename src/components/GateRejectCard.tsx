/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, Info, Check, ArrowRight } from 'lucide-react';

interface GateRejectCardProps {
  reasons: string[];
  onRetry?: () => void;
}

export const GateRejectCard: React.FC<GateRejectCardProps> = ({ reasons, onRetry }) => {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-slate-200">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-rose-500/20 p-2 text-rose-400">
          <ShieldAlert size={24} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-rose-300">
            Scan Stopped by Safety Gate
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            This image did not pass automated pre-screening safety checks. To prevent misleading or false anomaly scores, the scan was rejected before model scoring.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-900/60 p-4 border border-rose-500/20">
        <div className="text-xs font-semibold uppercase tracking-wider text-rose-400">
          Failure Reason:
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-400">
          <Info size={14} />
          <span>Clinical Upload Best Practices</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-slate-300">
          <div className="flex items-start gap-2 rounded bg-slate-900/40 p-2.5 border border-slate-800">
            <Check size={14} className="mt-0.5 text-teal-400 shrink-0" />
            <span>Use original grayscale scans (DICOM export, PNG or uncompressed JPG).</span>
          </div>
          <div className="flex items-start gap-2 rounded bg-slate-900/40 p-2.5 border border-slate-800">
            <Check size={14} className="mt-0.5 text-teal-400 shrink-0" />
            <span>Ensure sharp focus and avoid camera shake or phone glare on monitors.</span>
          </div>
          <div className="flex items-start gap-2 rounded bg-slate-900/40 p-2.5 border border-slate-800">
            <Check size={14} className="mt-0.5 text-teal-400 shrink-0" />
            <span>Verify the body part matches the reference set (e.g. PA chest radiograph).</span>
          </div>
          <div className="flex items-start gap-2 rounded bg-slate-900/40 p-2.5 border border-slate-800">
            <Check size={14} className="mt-0.5 text-teal-400 shrink-0" />
            <span>Check dynamic range to avoid completely black or washed-out images.</span>
          </div>
        </div>
      </div>

      {onRetry && (
        <div className="mt-5 flex justify-end">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
          >
            <span>Upload Another Scan</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
