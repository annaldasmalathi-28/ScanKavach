/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine,
  Upload,
  Camera,
  AlertTriangle,
  Clock,
  MessageSquareText,
  RefreshCw,
  Database,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FileText,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { GateRejectCard } from '../components/GateRejectCard.tsx';
import { SideBySide } from '../components/SideBySide.tsx';
import { VerdictBadge } from '../components/VerdictBadge.tsx';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { getCurrentSession } from '../lib/auth.ts';
import { extractFeatures } from '../lib/extractor.ts';
import { evaluateGate } from '../lib/gate.ts';
import {
  computeImageStats,
  fileToCanvas,
} from '../lib/imageUtils.ts';
import {
  computeMinGlobalDistance,
  findNearestHealthyThumbnail,
  getActiveBank,
  loadBankFromDb,
  MemoryBankData,
  StoredThumbnail,
} from '../lib/memoryBank.ts';
import { scoreQueryPatches } from '../lib/scorer.ts';
import {
  areaPercent,
  buildSentence,
  compute3x3Grid,
  PeakRegion,
  peakRegion,
} from '../lib/explain.ts';
import { verdict, VerdictResult } from '../lib/verdict.ts';
import { AnalysisRecord, saveHistoryRecord } from '../lib/history.ts';
import { predictConditionWithFusion, ConditionPrediction } from '../lib/classifier.ts';
import { generateClinicalPdfReport } from '../lib/pdfReport.ts';
import { logAuditEvent } from '../lib/audit.ts';
import {
  BORDERLINE_MARGIN,
  CLINICAL_DISCLAIMER,
  MAX_UPLOAD_MB,
} from '../config.ts';

export const AnalyzePage: React.FC = () => {
  const navigate = useNavigate();
  const session = getCurrentSession();
  const userId = session?.userId || 'guest';

  const [bank, setBank] = useState<MemoryBankData | null>(getActiveBank());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Analysis Pipeline Results
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [gatePassed, setGatePassed] = useState<boolean | null>(null);
  const [gateReasons, setGateReasons] = useState<string[]>([]);
  const [anomalyScore, setAnomalyScore] = useState<number | null>(null);
  const [patchScores, setPatchScores] = useState<number[]>([]);
  const [verdictResult, setVerdictResult] = useState<VerdictResult | null>(null);
  const [areaCoverage, setAreaCoverage] = useState<number>(0);
  const [peakSpatialRegion, setPeakSpatialRegion] = useState<PeakRegion | null>(null);
  const [summarySentence, setSummarySentence] = useState<string>('');
  const [nearestHealthy, setNearestHealthy] = useState<StoredThumbnail | null>(null);
  const [conditionSuggestion, setConditionSuggestion] = useState<ConditionPrediction | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  // Floating AI Chat modal state
  const [showAiModal, setShowAiModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function init() {
      const active = await loadBankFromDb();
      setBank(active);
    }
    init();
  }, []);

  const handleSelectFile = async (file: File) => {
    if (!file) return;

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setErrorMessage(`File exceeds the ${MAX_UPLOAD_MB}MB size limit.`);
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    await runPipeline(file);
  };

  const runPipeline = async (file: File) => {
    if (!bank) {
      setErrorMessage('No healthy reference bank available. Please build or load a bank first.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      const startTime = performance.now();

      // Step 1: Strip EXIF and metadata by drawing onto canvas
      const canvas = await fileToCanvas(file);
      setSourceCanvas(canvas);

      // Step 2: Compute quality metrics
      const stats = computeImageStats(canvas);

      // Step 3: Extract patch features & global embedding
      const features = await extractFeatures(canvas);

      // Step 4: Out-of-distribution distance
      const minGlobalDist = computeMinGlobalDistance(features.globalEmbedding, bank);

      // Step 5: Input Safety Gate
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

      setGatePassed(gateRes.passed);
      setGateReasons(gateRes.reasons);

      if (!gateRes.passed) {
        // Gate failed: record rejection, do NOT score, do NOT suggest
        const elapsed = Math.round(performance.now() - startTime);
        setLatencyMs(elapsed);
        setConditionSuggestion(null);

        const record: AnalysisRecord = {
          id: `rec_${Date.now()}`,
          userId,
          fileName: file.name,
          timestamp: new Date().toISOString(),
          gatePassed: false,
          gateReasons: gateRes.reasons,
          score: 0,
          percentile: 0,
          verdict: 'Rejected',
          borderline: false,
          areaPercent: 0,
          region: 'None',
          sentence: `Rejected by safety gate: ${gateRes.reasons[0]}`,
          latencyMs: elapsed,
        };
        await saveHistoryRecord(record);

        await logAuditEvent(
          'SAFETY_GATE_HALT',
          userId,
          session?.role || 'Clinician',
          `Gate stopped scan ${file.name}: ${gateRes.reasons[0]}`,
          { fileName: file.name, reasons: gateRes.reasons.join('; ') }
        );
        return;
      }

      // Step 6: Nearest-Neighbour Patch Scoring
      const bankPatches = new Float32Array(bank.patches);
      const scoreRes = scoreQueryPatches(
        features.patchFeatures,
        bankPatches,
        bank.bankPatchCount,
        bank.dim
      );

      // Step 7: Calibrated Verdict
      const vResult = verdict(
        scoreRes.imageScore,
        {
          review: bank.calibration.reviewThreshold,
          refer: bank.calibration.referThreshold,
        },
        BORDERLINE_MARGIN,
        bank.calibration.sortedValScores
      );

      // Step 8: Spatial Localization and Explanation
      const patchThresh = bank.calibration.patchThreshold;
      const areaPct = areaPercent(scoreRes.patchScores, patchThresh);
      const grid3x3 = compute3x3Grid(scoreRes.patchScores, 14);
      const peak = peakRegion(grid3x3);
      const sentence = buildSentence(areaPct > 0 ? peak : null, areaPct);

      // Step 9: Nearest Healthy Scan Thumbnail
      const closestThumb = findNearestHealthyThumbnail(features.globalEmbedding, bank);

      // Step 10: Condition-Suggestion Decision Support (with Fusion)
      const suggestion = predictConditionWithFusion(
        features.globalEmbedding,
        scoreRes.imageScore,
        bank.calibration.reviewThreshold,
        bank.calibration.referThreshold,
        true
      );
      setConditionSuggestion(suggestion);

      const elapsed = Math.round(performance.now() - startTime);
      setLatencyMs(elapsed);

      setAnomalyScore(scoreRes.imageScore);
      setPatchScores(scoreRes.patchScores);
      setVerdictResult(vResult);
      setAreaCoverage(areaPct);
      setPeakSpatialRegion(peak);
      setSummarySentence(sentence);
      setNearestHealthy(closestThumb);

      // Step 11: Persist Metadata ONLY (NO pixels or images)
      const record: AnalysisRecord = {
        id: `rec_${Date.now()}`,
        userId,
        fileName: file.name,
        timestamp: new Date().toISOString(),
        gatePassed: true,
        score: scoreRes.imageScore,
        percentile: vResult.percentile,
        verdict: vResult.label,
        borderline: vResult.borderline,
        areaPercent: areaPct,
        region: peak,
        sentence,
        latencyMs: elapsed,
      };
      await saveHistoryRecord(record);

      await logAuditEvent(
        'SCAN_SCREENED',
        userId,
        session?.role || 'Clinician',
        `Screened ${file.name} -> ${vResult.label} (Score: ${scoreRes.imageScore.toFixed(3)}, ${Math.round(areaPct)}% area)`,
        {
          fileName: file.name,
          verdict: vResult.label,
          score: scoreRes.imageScore,
          borderline: vResult.borderline,
        }
      );
    } catch (err) {
      console.error('Screening pipeline error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An error occurred during scan inference.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSourceCanvas(null);
    setGatePassed(null);
    setGateReasons([]);
    setAnomalyScore(null);
    setPatchScores([]);
    setVerdictResult(null);
    setAreaCoverage(0);
    setPeakSpatialRegion(null);
    setSummarySentence('');
    setNearestHealthy(null);
    setLatencyMs(0);
    setErrorMessage(null);
  };

  return (
    <AppShell title="Scan Anomaly Screening" bank={bank}>
      <div className="space-y-6">
        {/* Missing Bank Warning Header */}
        {!bank && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5 text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-300">
                  No Reference Bank Loaded
                </h3>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  ScanKavach requires a calibrated healthy reference memory bank to assess incoming scans. Please build a bank or load our pre-calibrated sample set.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => navigate('/bank')}
                    className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors"
                  >
                    Go to Build Bank
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Card (shown when no scan is active) */}
        {!selectedFile && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Upload Patient Scan for Anomaly Screening
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Medical images are processed strictly on this device. Privacy preserved.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-lg bg-rose-500/15 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleSelectFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700/80 bg-slate-950/40 p-10 text-center cursor-pointer hover:border-teal-500/50 hover:bg-slate-900/40 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSelectFile(f);
                }}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSelectFile(f);
                }}
                className="hidden"
              />

              <div className="rounded-2xl bg-teal-500/10 p-4 text-teal-400 border border-teal-500/20 mb-4 shadow-inner">
                <ScanLine size={32} />
              </div>

              <span className="text-sm font-semibold text-slate-200">
                Drag & drop medical scan image here, or click to browse
              </span>
              <span className="mt-1.5 text-xs text-slate-400">
                Supports standard DICOM exports, PNG, JPG, or WebP up to {MAX_UPLOAD_MB}MB
              </span>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  <Camera size={14} />
                  <span>Camera Capture</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-slate-950/40 p-3 border border-slate-800 text-[11px] text-slate-400">
              <ShieldCheck size={16} className="text-teal-400 shrink-0" />
              <span>
                Safety checks automatically screen for blur, color photos, low contrast, and non-chest scans.
              </span>
            </div>
          </div>
        )}

        {/* Processing Spinner */}
        {isProcessing && (
          <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-12 text-center space-y-3">
            <RefreshCw size={36} className="animate-spin text-teal-400 mx-auto" />
            <h3 className="text-base font-semibold text-slate-100">
              Executing Local Inference Pipeline...
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Stripping metadata, running safety gate, extracting MobileNet patch features, and comparing against healthy memory bank.
            </p>
          </div>
        )}

        {/* Screening Results (when ready) */}
        {!isProcessing && selectedFile && (
          <div className="space-y-6">
            {/* Top Results Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-teal-500/20 p-2 text-teal-400">
                  <ScanLine size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 font-mono truncate max-w-xs">
                    {selectedFile.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{latencyMs} ms latency</span>
                    </span>
                    <span>•</span>
                    <span>Processed locally</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {gatePassed === true && (
                  <button
                    onClick={() => {
                      if (!selectedFile) return;
                      generateClinicalPdfReport({
                        fileName: selectedFile.name,
                        scanId: `scan_${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        operatorName: session?.name || 'Dr. Alex Morgan',
                        operatorRole: session?.role || 'Clinician',
                        verdict: verdictResult?.label || 'Normal',
                        borderline: verdictResult?.borderline || false,
                        score: anomalyScore || 0,
                        percentile: verdictResult?.percentile || 50,
                        areaPercent: areaCoverage,
                        peakRegion: peakSpatialRegion || 'centre',
                        summarySentence,
                        gatePassed: true,
                        latencyMs,
                        conditionSuggestion,
                        scanCanvas: sourceCanvas,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-teal-300 hover:bg-slate-700 transition-colors"
                    title="Export 1-page clinical screening PDF report"
                  >
                    <FileText size={14} />
                    <span>Download PDF</span>
                  </button>
                )}

                <button
                  onClick={() => setShowAiModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors shadow-sm"
                >
                  <MessageSquareText size={14} />
                  <span>Discuss with AI Assistant</span>
                </button>

                <button
                  onClick={handleReset}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  New Scan
                </button>
              </div>
            </div>

            {/* Safety Gate Failed State */}
            {gatePassed === false && (
              <GateRejectCard reasons={gateReasons} onRetry={handleReset} />
            )}

            {/* Safety Gate Passed: Full Result */}
            {gatePassed === true && verdictResult && (
              <div className="space-y-6">
                {/* Result Summary Banner */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 space-y-4 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                        Screening Verdict
                      </span>
                      <div className="mt-1 flex items-center gap-3">
                        <VerdictBadge
                          verdict={verdictResult.label}
                          borderline={verdictResult.borderline}
                          showBorderlineBanner={true}
                          size="lg"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end">
                      <span className="text-xs text-slate-400">Healthy Validation Comparison</span>
                      <div className="text-sm font-semibold text-teal-300 mt-0.5">
                        More unusual than <strong className="font-mono text-base">{verdictResult.percentile}%</strong> of healthy validation scans
                      </div>
                    </div>
                  </div>

                  {/* 3 Metric Cards */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                    <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800">
                      <span className="text-slate-400">Anomaly Score (Mean Top-3)</span>
                      <div className="mt-1 font-mono text-lg font-bold text-slate-100">
                        {anomalyScore?.toFixed(4)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Review cutoff: {bank?.calibration.reviewThreshold.toFixed(3)}
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800">
                      <span className="text-slate-400">Anomalous Area Coverage</span>
                      <div className="mt-1 font-mono text-lg font-bold text-teal-400">
                        {Math.round(areaCoverage)}%
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Patches exceeding cutoff
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800">
                      <span className="text-slate-400">Peak Spatial Region (3x3)</span>
                      <div className="mt-1 capitalize text-base font-bold text-slate-200">
                        {peakSpatialRegion}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Spatial coordinates of image
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Clinical Disclaimer Banner */}
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center text-xs text-amber-300 font-medium">
                    {CLINICAL_DISCLAIMER}
                  </div>
                </div>

                {/* Condition-Suggestion Decision Support Finding (Phase B) */}
                {conditionSuggestion && (
                  <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-teal-500/20 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-teal-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                          {conditionSuggestion.label}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-teal-400">
                        {conditionSuggestion.confidence}% match
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-100">
                      {conditionSuggestion.displayText}
                    </p>

                    {conditionSuggestion.fusedVerdictNote && (
                      <p className="text-xs text-slate-300 italic">
                        {conditionSuggestion.fusedVerdictNote}
                      </p>
                    )}

                    <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                      {conditionSuggestion.disclaimer}
                    </div>
                  </div>
                )}

                {/* Side-by-Side Visual Comparison & Heatmap */}
                <SideBySide
                  sourceCanvas={sourceCanvas}
                  patchScores={patchScores}
                  patchThreshold={bank?.calibration.patchThreshold ?? 0.5}
                  nearestHealthy={nearestHealthy}
                  areaPercent={areaCoverage}
                  peakRegion={peakSpatialRegion || 'centre'}
                  summarySentence={summarySentence}
                />
              </div>
            )}
          </div>
        )}

        {/* Floating Ask AI Button */}
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 rounded-full bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl hover:bg-teal-500 transition-all hover:scale-105"
            title="Open AI Assistant for result explanation"
          >
            <MessageSquareText size={18} />
            <span>Ask AI</span>
          </button>
        </div>

        {/* Modal for Assistant Chat */}
        {showAiModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
            onClick={() => setShowAiModal(false)}
          >
            <div
              className="w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <ChatPanel
                initialContext={{
                  fileName: selectedFile?.name,
                  score: anomalyScore ?? undefined,
                  percentile: verdictResult?.percentile,
                  verdict: verdictResult?.label,
                  borderline: verdictResult?.borderline,
                  areaPercent: areaCoverage,
                  region: peakSpatialRegion || undefined,
                  sentence: summarySentence,
                  reviewThreshold: bank?.calibration.reviewThreshold,
                  referThreshold: bank?.calibration.referThreshold,
                  gatePassed: gatePassed ?? undefined,
                  gateReasons,
                  healthyScanCount: bank?.healthyScanCount,
                }}
                heightClass="h-[620px]"
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
