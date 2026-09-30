/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  Layers,
  Upload,
  Sparkles,
  Download,
  FileCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  Filter,
  FileText,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { VerdictBadge } from '../components/VerdictBadge.tsx';
import { getCurrentSession } from '../lib/auth.ts';
import { extractFeatures } from '../lib/extractor.ts';
import { evaluateGate } from '../lib/gate.ts';
import {
  computeImageStats,
  createSyntheticScanCanvas,
  fileToCanvas,
} from '../lib/imageUtils.ts';
import {
  computeMinGlobalDistance,
  getActiveBank,
  loadBankFromDb,
} from '../lib/memoryBank.ts';
import { scoreQueryPatches } from '../lib/scorer.ts';
import {
  areaPercent,
  buildSentence,
  compute3x3Grid,
  peakRegion,
} from '../lib/explain.ts';
import { verdict } from '../lib/verdict.ts';
import { predictConditionWithFusion } from '../lib/classifier.ts';
import { generateClinicalPdfReport } from '../lib/pdfReport.ts';
import { exportHistoryToCsv, AnalysisRecord, saveHistoryRecord } from '../lib/history.ts';
import { BORDERLINE_MARGIN, CLINICAL_DISCLAIMER } from '../config.ts';

interface BatchItem {
  id: string;
  file?: File;
  canvas: HTMLCanvasElement;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  gatePassed: boolean;
  gateReasons: string[];
  score: number;
  percentile: number;
  verdict: 'Normal' | 'Review' | 'Refer' | 'Rejected';
  borderline: boolean;
  areaPercent: number;
  peakRegion: string;
  sentence: string;
  conditionSuggestion?: string;
  latencyMs: number;
  error?: string;
}

export const BatchPage: React.FC = () => {
  const session = getCurrentSession();
  const userId = session?.userId || 'guest';
  const bank = getActiveBank();

  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'refer' | 'review' | 'normal' | 'rejected'>('all');
  const [progressCount, setProgressCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesAdded = async (files: FileList | null) => {
    if (!files) return;
    const newItems: BatchItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name)) {
        try {
          const c = await fileToCanvas(f);
          newItems.push({
            id: `batch_${Date.now()}_${i}`,
            file: f,
            canvas: c,
            fileName: f.name,
            status: 'pending',
            gatePassed: true,
            gateReasons: [],
            score: 0,
            percentile: 0,
            verdict: 'Normal',
            borderline: false,
            areaPercent: 0,
            peakRegion: 'None',
            sentence: '',
            latencyMs: 0,
          });
        } catch (e) {
          console.error('File canvas error:', e);
        }
      }
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleLoadSampleBatch = () => {
    const samples: BatchItem[] = [
      {
        id: `sample_1_${Date.now()}`,
        canvas: createSyntheticScanCanvas(224, 224, { noiseLevel: 0.02 }),
        fileName: 'Triage_Patient_001_Normal.png',
        status: 'pending',
        gatePassed: true,
        gateReasons: [],
        score: 0,
        percentile: 0,
        verdict: 'Normal',
        borderline: false,
        areaPercent: 0,
        peakRegion: 'None',
        sentence: '',
        latencyMs: 0,
      },
      {
        id: `sample_2_${Date.now()}`,
        canvas: createSyntheticScanCanvas(224, 224, {
          anomaly: { x: 70, y: 130, radius: 25, intensity: 120 },
        }),
        fileName: 'Triage_Patient_002_Refer.png',
        status: 'pending',
        gatePassed: true,
        gateReasons: [],
        score: 0,
        percentile: 0,
        verdict: 'Normal',
        borderline: false,
        areaPercent: 0,
        peakRegion: 'None',
        sentence: '',
        latencyMs: 0,
      },
      {
        id: `sample_3_${Date.now()}`,
        canvas: createSyntheticScanCanvas(224, 224, {
          anomaly: { x: 140, y: 120, radius: 18, intensity: 80 },
        }),
        fileName: 'Triage_Patient_003_Review.png',
        status: 'pending',
        gatePassed: true,
        gateReasons: [],
        score: 0,
        percentile: 0,
        verdict: 'Normal',
        borderline: false,
        areaPercent: 0,
        peakRegion: 'None',
        sentence: '',
        latencyMs: 0,
      },
      {
        id: `sample_4_${Date.now()}`,
        canvas: createSyntheticScanCanvas(224, 224, { colorTint: true }),
        fileName: 'Triage_Patient_004_ColourErr.jpg',
        status: 'pending',
        gatePassed: true,
        gateReasons: [],
        score: 0,
        percentile: 0,
        verdict: 'Normal',
        borderline: false,
        areaPercent: 0,
        peakRegion: 'None',
        sentence: '',
        latencyMs: 0,
      },
    ];

    setItems((prev) => [...prev, ...samples]);
  };

  const runBatchProcessing = async () => {
    if (!bank) {
      alert('Please build or load a healthy reference bank first.');
      return;
    }

    setIsProcessing(true);
    setProgressCount(0);

    const pendingItems = [...items];
    const updated: BatchItem[] = [];

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      if (item.status === 'completed') {
        updated.push(item);
        continue;
      }

      setProgressCount(i + 1);
      const start = performance.now();

      try {
        const stats = computeImageStats(item.canvas);
        const feat = await extractFeatures(item.canvas);
        const minGlobalDist = computeMinGlobalDistance(feat.globalEmbedding, bank);

        const gateRes = evaluateGate(
          {
            colorDiff: stats.colorDiff,
            contrastStd: stats.contrastStd,
            blurVariance: stats.blurVariance,
            minGlobalDistance: minGlobalDist,
          },
          {
            colorDiffLimit: 12,
            minContrastStd: 0.05,
            blurLimit: bank.calibration.blurLimit,
            oodLimit: bank.calibration.oodLimit,
          }
        );

        if (!gateRes.passed) {
          const latency = Math.round(performance.now() - start);
          const completedItem: BatchItem = {
            ...item,
            status: 'completed',
            gatePassed: false,
            gateReasons: gateRes.reasons,
            verdict: 'Rejected',
            latencyMs: latency,
            sentence: `Stopped by safety gate: ${gateRes.reasons[0]}`,
          };
          updated.push(completedItem);

          // Save history
          await saveHistoryRecord({
            id: completedItem.id,
            userId,
            fileName: completedItem.fileName,
            timestamp: new Date().toISOString(),
            gatePassed: false,
            gateReasons: completedItem.gateReasons,
            score: 0,
            percentile: 0,
            verdict: 'Rejected',
            borderline: false,
            areaPercent: 0,
            region: 'None',
            sentence: completedItem.sentence,
            latencyMs: latency,
          });
          continue;
        }

        // Patch scoring
        const bankPatches = new Float32Array(bank.patches);
        const scoreRes = scoreQueryPatches(
          feat.patchFeatures,
          bankPatches,
          bank.bankPatchCount,
          bank.dim
        );

        const vResult = verdict(
          scoreRes.imageScore,
          {
            review: bank.calibration.reviewThreshold,
            refer: bank.calibration.referThreshold,
          },
          BORDERLINE_MARGIN,
          bank.calibration.sortedValScores
        );

        const areaPct = areaPercent(scoreRes.patchScores, bank.calibration.patchThreshold);
        const grid = compute3x3Grid(scoreRes.patchScores, 14);
        const peak = peakRegion(grid);
        const sentence = buildSentence(areaPct > 0 ? peak : null, areaPct);

        const condition = predictConditionWithFusion(
          feat.globalEmbedding,
          scoreRes.imageScore,
          bank.calibration.reviewThreshold,
          bank.calibration.referThreshold,
          true
        );

        const latency = Math.round(performance.now() - start);
        const completedItem: BatchItem = {
          ...item,
          status: 'completed',
          gatePassed: true,
          score: scoreRes.imageScore,
          percentile: vResult.percentile,
          verdict: vResult.label,
          borderline: vResult.borderline,
          areaPercent: areaPct,
          peakRegion: peak,
          sentence,
          conditionSuggestion: condition?.displayText,
          latencyMs: latency,
        };
        updated.push(completedItem);

        // Save history
        await saveHistoryRecord({
          id: completedItem.id,
          userId,
          fileName: completedItem.fileName,
          timestamp: new Date().toISOString(),
          gatePassed: true,
          score: completedItem.score,
          percentile: completedItem.percentile,
          verdict: completedItem.verdict,
          borderline: completedItem.borderline,
          areaPercent: completedItem.areaPercent,
          region: completedItem.peakRegion,
          sentence: completedItem.sentence,
          latencyMs: latency,
        });
      } catch (err) {
        console.error('Batch scan error:', err);
        updated.push({
          ...item,
          status: 'error',
          error: err instanceof Error ? err.message : 'Processing failed',
        });
      }

      setItems([...updated, ...pendingItems.slice(i + 1)]);
      await new Promise((r) => setTimeout(r, 10)); // Yield to UI
    }

    // Sort by clinical triage priority: Refer > Review > Normal > Rejected
    const priorityWeight = { Refer: 4, Review: 3, Normal: 2, Rejected: 1 };
    updated.sort((a, b) => {
      const pA = priorityWeight[a.verdict] || 0;
      const pB = priorityWeight[b.verdict] || 0;
      if (pB !== pA) return pB - pA;
      return b.score - a.score;
    });

    setItems(updated);
    setIsProcessing(false);
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'refer') return item.verdict === 'Refer';
    if (filter === 'review') return item.verdict === 'Review';
    if (filter === 'normal') return item.verdict === 'Normal';
    if (filter === 'rejected') return item.verdict === 'Rejected';
    return true;
  });

  const handleDownloadPdf = (item: BatchItem) => {
    generateClinicalPdfReport({
      fileName: item.fileName,
      scanId: item.id,
      timestamp: new Date().toISOString(),
      operatorName: session?.name || 'Dr. Alex Morgan',
      operatorRole: session?.role || 'Clinician',
      verdict: item.verdict,
      borderline: item.borderline,
      score: item.score,
      percentile: item.percentile,
      areaPercent: item.areaPercent,
      peakRegion: item.peakRegion,
      summarySentence: item.sentence,
      gatePassed: item.gatePassed,
      gateReasons: item.gateReasons,
      latencyMs: item.latencyMs,
      scanCanvas: item.canvas,
    });
  };

  const handleExportBatchCsv = () => {
    const records: AnalysisRecord[] = items.map((it) => ({
      id: it.id,
      userId,
      fileName: it.fileName,
      timestamp: new Date().toISOString(),
      gatePassed: it.gatePassed,
      gateReasons: it.gateReasons,
      score: it.score,
      percentile: it.percentile,
      verdict: it.verdict,
      borderline: it.borderline,
      areaPercent: it.areaPercent,
      region: it.peakRegion,
      sentence: it.sentence,
      latencyMs: it.latencyMs,
    }));
    exportHistoryToCsv(records);
  };

  return (
    <AppShell title="Clinical Batch Triage Queue" bank={bank}>
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
                Batch Scan Triage &amp; Prioritization
              </h2>
              <span className="rounded bg-teal-500/20 px-2 py-0.5 text-[10px] font-mono text-teal-300">
                High Throughput
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Upload multiple patient scans. ScanKavach ranks cases by clinical urgency (Refer &gt; Review &gt; Normal).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLoadSampleBatch}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 transition-colors disabled:opacity-50"
            >
              <Sparkles size={13} />
              <span>Load sample batch</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <Upload size={13} />
              <span>Add Scans</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.png,.jpg,.jpeg,.webp"
              onChange={(e) => handleFilesAdded(e.target.files)}
              className="hidden"
            />

            {items.length > 0 && (
              <button
                onClick={runBatchProcessing}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors disabled:opacity-50 shadow-sm"
              >
                <RefreshCw size={13} className={isProcessing ? 'animate-spin' : ''} />
                <span>{isProcessing ? `Processing (${progressCount}/${items.length})` : 'Run Batch Screening'}</span>
              </button>
            )}

            {items.length > 0 && (
              <button
                onClick={handleExportBatchCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Triage Summary Bar */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-xl p-3 border text-left transition-all ${
                filter === 'all' ? 'border-teal-500 bg-slate-900 ring-1 ring-teal-500/50' : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <span className="text-slate-400">Total in Queue</span>
              <div className="mt-1 font-mono text-lg font-bold text-slate-100">{items.length}</div>
            </button>

            <button
              onClick={() => setFilter('refer')}
              className={`rounded-xl p-3 border text-left transition-all ${
                filter === 'refer' ? 'border-rose-500 bg-rose-950/20 ring-1 ring-rose-500/50' : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <span className="text-rose-400">Refer (Urgent)</span>
              <div className="mt-1 font-mono text-lg font-bold text-rose-300">
                {items.filter((i) => i.verdict === 'Refer').length}
              </div>
            </button>

            <button
              onClick={() => setFilter('review')}
              className={`rounded-xl p-3 border text-left transition-all ${
                filter === 'review' ? 'border-amber-500 bg-amber-950/20 ring-1 ring-amber-500/50' : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <span className="text-amber-400">Review (Secondary)</span>
              <div className="mt-1 font-mono text-lg font-bold text-amber-300">
                {items.filter((i) => i.verdict === 'Review').length}
              </div>
            </button>

            <button
              onClick={() => setFilter('normal')}
              className={`rounded-xl p-3 border text-left transition-all ${
                filter === 'normal' ? 'border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/50' : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <span className="text-emerald-400">Normal (Baseline)</span>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-300">
                {items.filter((i) => i.verdict === 'Normal').length}
              </div>
            </button>

            <button
              onClick={() => setFilter('rejected')}
              className={`rounded-xl p-3 border text-left transition-all col-span-2 sm:col-span-1 ${
                filter === 'rejected' ? 'border-slate-500 bg-slate-900 ring-1 ring-slate-500/50' : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <span className="text-slate-400">Gate Stopped</span>
              <div className="mt-1 font-mono text-lg font-bold text-slate-300">
                {items.filter((i) => i.verdict === 'Rejected').length}
              </div>
            </button>
          </div>
        )}

        {/* Batch Queue Table */}
        {items.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700/80 bg-slate-950/40 p-12 text-center cursor-pointer hover:border-teal-500/50 transition-all"
          >
            <div className="rounded-2xl bg-teal-500/10 p-4 text-teal-400 border border-teal-500/20 mb-3 shadow-inner">
              <Layers size={32} />
            </div>
            <span className="text-sm font-semibold text-slate-200">
              Drag &amp; drop multiple patient scans or click to browse
            </span>
            <span className="mt-1 text-xs text-slate-400">
              Or click &ldquo;Load sample batch&rdquo; above to preview clinical triage workflow.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th scope="col" className="px-4 py-3">Scan File</th>
                  <th scope="col" className="px-4 py-3">Triage Verdict</th>
                  <th scope="col" className="px-4 py-3 hidden sm:table-cell">Score</th>
                  <th scope="col" className="px-4 py-3 hidden md:table-cell">Percentile</th>
                  <th scope="col" className="px-4 py-3 hidden lg:table-cell">Decision Support Pattern</th>
                  <th scope="col" className="px-4 py-3 hidden xl:table-cell">Latency</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-850/80 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-100 max-w-[180px] truncate">
                      {item.fileName}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.status === 'completed' ? (
                        <VerdictBadge
                          verdict={item.verdict}
                          borderline={item.borderline}
                          size="sm"
                        />
                      ) : (
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                          {item.status === 'processing' ? 'Screening...' : 'Pending'}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell font-mono text-slate-300">
                      {item.gatePassed && item.status === 'completed' ? item.score.toFixed(3) : '—'}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell font-mono text-slate-300">
                      {item.gatePassed && item.status === 'completed' ? `${item.percentile}%` : '—'}
                    </td>

                    <td className="px-4 py-3 hidden lg:table-cell text-slate-300 max-w-[240px] truncate">
                      {item.conditionSuggestion ? (
                        <span className="text-teal-300 text-[11px] font-medium">
                          {item.conditionSuggestion}
                        </span>
                      ) : item.gatePassed ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <span className="text-rose-400 text-[11px]">Gate Halt</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap hidden xl:table-cell font-mono text-slate-400 text-[11px]">
                      {item.latencyMs ? `${item.latencyMs}ms` : '—'}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {item.status === 'completed' && (
                        <button
                          onClick={() => handleDownloadPdf(item)}
                          className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] font-medium text-teal-300 transition-colors"
                          title="Generate clinical PDF report"
                        >
                          <FileText size={12} />
                          <span>PDF</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-lg bg-slate-950/40 p-4 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
          <ShieldCheck size={16} className="text-teal-400 shrink-0" />
          <span>{CLINICAL_DISCLAIMER}</span>
        </div>
      </div>
    </AppShell>
  );
};
