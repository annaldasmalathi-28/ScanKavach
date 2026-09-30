/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AnalysisRecord } from '../lib/history.ts';
import { VerdictBadge } from './VerdictBadge.tsx';
import { FileText, Clock, ChevronRight, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { CLINICAL_DISCLAIMER } from '../config.ts';

interface HistoryTableProps {
  records: AnalysisRecord[];
  onOpenAssistantWithRecord?: (record: AnalysisRecord) => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({
  records,
  onOpenAssistantWithRecord,
}) => {
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-900/30">
        <FileText size={32} className="mx-auto text-slate-500 mb-2" />
        <h4 className="text-sm font-semibold text-slate-300">No screening history yet</h4>
        <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
          Analyze a patient scan or click &ldquo;Load sample data&rdquo; to populate this table with clinical screening records.
        </p>
      </div>
    );
  }

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-[11px] uppercase tracking-wider font-mono">
            <tr>
              <th scope="col" className="px-4 py-3">Time</th>
              <th scope="col" className="px-4 py-3">Scan File</th>
              <th scope="col" className="px-4 py-3">Verdict</th>
              <th scope="col" className="px-4 py-3 hidden sm:table-cell">Borderline</th>
              <th scope="col" className="px-4 py-3 hidden md:table-cell">Percentile</th>
              <th scope="col" className="px-4 py-3 hidden lg:table-cell">Latency</th>
              <th scope="col" className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {records.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelectedRecord(r)}
                className="cursor-pointer hover:bg-slate-850/80 transition-colors"
              >
                <td className="whitespace-nowrap px-4 py-3 text-slate-400 text-xs font-mono">
                  {formatTimestamp(r.timestamp)}
                </td>

                <td className="px-4 py-3 font-medium text-slate-100 max-w-[160px] truncate">
                  {r.fileName}
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  <VerdictBadge
                    verdict={r.verdict}
                    borderline={r.borderline}
                    size="sm"
                  />
                </td>

                <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell font-mono text-xs">
                  {r.borderline ? (
                    <span className="text-amber-400 font-semibold">Yes</span>
                  ) : (
                    <span className="text-slate-500">No</span>
                  )}
                </td>

                <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell font-mono text-xs text-slate-300">
                  {r.gatePassed ? `${r.percentile}%` : 'N/A'}
                </td>

                <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell font-mono text-xs text-slate-400">
                  {r.latencyMs}ms
                </td>

                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span className="inline-flex items-center text-teal-400 hover:text-teal-300 font-medium text-xs">
                    <span>View</span>
                    <ChevronRight size={14} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Record Detail Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Screening Summary Record
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  ID: {selectedRecord.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">File Name</span>
                <span className="font-semibold text-slate-200">{selectedRecord.fileName}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Timestamp</span>
                <span className="font-mono text-slate-300">
                  {new Date(selectedRecord.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Verdict</span>
                <VerdictBadge
                  verdict={selectedRecord.verdict}
                  borderline={selectedRecord.borderline}
                  showBorderlineBanner={false}
                  size="sm"
                />
              </div>

              {selectedRecord.gatePassed ? (
                <>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Anomaly Score</span>
                    <span className="font-mono font-semibold text-teal-300">
                      {selectedRecord.score.toFixed(4)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Healthy Validation Percentile</span>
                    <span className="font-mono text-slate-200">
                      More unusual than {selectedRecord.percentile}% of healthy validation scans
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Anomalous Area</span>
                    <span className="font-mono text-slate-200">
                      {Math.round(selectedRecord.areaPercent)}% of image area
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Peak Region (3x3 Grid)</span>
                    <span className="capitalize font-medium text-slate-200">
                      {selectedRecord.region} of image
                    </span>
                  </div>
                </>
              ) : (
                <div className="rounded-lg bg-rose-500/10 p-3 border border-rose-500/20 text-rose-300">
                  <div className="font-semibold flex items-center gap-1.5">
                    <ShieldAlert size={14} />
                    <span>Safety Gate Failure:</span>
                  </div>
                  <div className="mt-1">
                    {selectedRecord.gateReasons?.join('; ') || 'Image failed pre-screening gate.'}
                  </div>
                </div>
              )}

              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Inference Latency</span>
                <span className="font-mono text-slate-300">{selectedRecord.latencyMs} ms</span>
              </div>

              <div className="mt-3 rounded-lg bg-slate-950/60 p-3 border border-slate-800">
                <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wide">
                  Clinical Summary Sentence
                </div>
                <p className="mt-1 text-slate-200 leading-relaxed font-medium">
                  {selectedRecord.sentence}
                </p>
              </div>

              <p className="text-[10px] text-slate-500 text-center italic mt-2">
                {CLINICAL_DISCLAIMER}
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-4">
              {onOpenAssistantWithRecord && (
                <button
                  onClick={() => {
                    const r = selectedRecord;
                    setSelectedRecord(null);
                    onOpenAssistantWithRecord(r);
                  }}
                  className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-teal-500 transition-colors"
                >
                  Discuss with AI Assistant
                </button>
              )}
              <button
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
