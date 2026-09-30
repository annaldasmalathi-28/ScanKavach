/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Database,
  Upload,
  Sparkles,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  RefreshCw,
  Trash2,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';
import { AppShell } from '../components/AppShell.tsx';
import {
  buildMemoryBank,
  BuildProgress,
  clearBankFromDb,
  exportBankToJson,
  importBankFromJson,
  loadBankFromDb,
  MemoryBankData,
  saveBankToDb,
} from '../lib/memoryBank.ts';
import { createSyntheticScanCanvas } from '../lib/imageUtils.ts';
import {
  BANK_FRACTION,
  MIN_NORMALS,
  RECOMMENDED_NORMALS,
  REFER_PERCENTILE,
  REVIEW_PERCENTILE,
} from '../config.ts';

export const BankPage: React.FC = () => {
  const [bank, setBank] = useState<MemoryBankData | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [buildTimeMs, setBuildTimeMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sampleBankAvailable, setSampleBankAvailable] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function init() {
      const active = await loadBankFromDb();
      setBank(active);
    }
    init();
  }, []);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name)) {
        newFiles.push(f);
      }
    }
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleBuild = async () => {
    if (selectedFiles.length < MIN_NORMALS) {
      setError(`At least ${MIN_NORMALS} healthy scans are required. You have selected ${selectedFiles.length}.`);
      return;
    }

    try {
      setIsBuilding(true);
      setError(null);
      setSuccessMessage(null);
      const startTime = performance.now();

      const newBank = await buildMemoryBank(selectedFiles, (p) => {
        setBuildProgress(p);
      });

      const elapsed = Math.round(performance.now() - startTime);
      setBuildTimeMs(elapsed);
      setBank(newBank);
      setSuccessMessage(
        `Memory bank successfully built and calibrated in ${(elapsed / 1000).toFixed(1)}s!`
      );
      setSelectedFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error building memory bank.');
    } finally {
      setIsBuilding(false);
      setBuildProgress(null);
    }
  };

  // Build synthetic normal bank directly in-browser
  const handleBuildSyntheticBank = async (count: number = 24) => {
    try {
      setIsBuilding(true);
      setError(null);
      setSuccessMessage(null);
      const startTime = performance.now();

      setBuildProgress({
        phase: 'extracting_bank',
        current: 0,
        total: count,
        message: `Synthesizing ${count} procedural normal chest radiographs...`,
      });

      const syntheticCanvases: HTMLCanvasElement[] = [];
      for (let i = 0; i < count; i++) {
        // Vary noise slightly to create natural physiological distribution
        const canvas = createSyntheticScanCanvas(224, 224, {
          noiseLevel: 0.03 + (i % 5) * 0.008,
        });
        syntheticCanvases.push(canvas);
      }

      const newBank = await buildMemoryBank(syntheticCanvases, (p) => {
        setBuildProgress(p);
      });

      const elapsed = Math.round(performance.now() - startTime);
      setBuildTimeMs(elapsed);
      setBank(newBank);
      setSuccessMessage(
        `Synthetic reference bank (${count} normal scans) built and calibrated in ${(elapsed / 1000).toFixed(1)}s!`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build synthetic bank.');
    } finally {
      setIsBuilding(false);
      setBuildProgress(null);
    }
  };

  // Load sample bank from /sample-bank.json
  const handleLoadSampleBank = async () => {
    try {
      setIsBuilding(true);
      setError(null);
      const res = await fetch('/sample-bank.json');
      if (!res.ok) {
        throw new Error('Could not find /sample-bank.json on server.');
      }
      const data: MemoryBankData = await res.json();
      await saveBankToDb(data);
      setBank(data);
      setSuccessMessage('Loaded pre-calibrated sample bank successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample bank.');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsBuilding(true);
      setError(null);
      const imported = await importBankFromJson(file);
      setBank(imported);
      setSuccessMessage(`Imported memory bank with ${imported.healthyScanCount} healthy scans.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse memory bank JSON.');
    } finally {
      setIsBuilding(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleExportJson = () => {
    if (bank) {
      exportBankToJson(bank);
    }
  };

  const handleClearBank = async () => {
    if (window.confirm('Are you sure you want to delete the active reference set from local storage?')) {
      await clearBankFromDb();
      setBank(null);
      setSuccessMessage('Reference memory bank cleared.');
    }
  };

  // Prepare Histogram Data from Validation Scores
  const valScores = bank?.calibration.sortedValScores || [];
  const binCount = 10;
  const minScore = valScores.length > 0 ? Math.min(...valScores) : 0;
  const maxScore = valScores.length > 0 ? Math.max(...valScores) : 0.6;
  const binWidth = (maxScore - minScore) / binCount || 0.05;

  const histogramData = Array.from({ length: binCount }).map((_, i) => {
    const binStart = minScore + i * binWidth;
    const binEnd = binStart + binWidth;
    const count = valScores.filter((s) => s >= binStart && (i === binCount - 1 ? s <= binEnd : s < binEnd)).length;
    return {
      binRange: `${binStart.toFixed(2)}`,
      count,
      binStart,
      binEnd,
    };
  });

  return (
    <AppShell title="Build Healthy Reference Set" bank={bank}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
              Healthy Reference Memory Bank
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              ScanKavach learns what normal tissue looks like using a PatchCore-style memory bank. Upload verified healthy scans to calibrate screening cutoffs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sampleBankAvailable && (
              <button
                onClick={handleLoadSampleBank}
                disabled={isBuilding}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 transition-colors disabled:opacity-50"
              >
                <Sparkles size={14} />
                <span>Load sample bank</span>
              </button>
            )}

            <button
              onClick={() => handleBuildSyntheticBank(24)}
              disabled={isBuilding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Generate 24 procedural normal CXR scans and calibrate locally"
            >
              <RefreshCw size={13} className={isBuilding ? 'animate-spin' : ''} />
              <span>Generate 24 normals</span>
            </button>

            {bank && (
              <>
                <button
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <Download size={13} />
                  <span>Export (.json)</span>
                </button>

                <button
                  onClick={handleClearBank}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
                >
                  <Trash2 size={13} />
                  <span>Clear bank</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status / Alert Banners */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-500/30 p-4 text-xs sm:text-sm text-rose-300">
            <AlertTriangle size={18} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-4 text-xs sm:text-sm text-emerald-300">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Active Bank Summary Card (if present) */}
        {bank && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-teal-500/20 p-2 text-teal-400">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">
                    Active Calibrated Memory Bank
                  </h3>
                  <p className="text-xs text-slate-400">
                    Built on {new Date(bank.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <span className="self-start sm:self-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-medium text-emerald-400">
                Ready for Screening
              </span>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800">
                <span className="text-slate-400">Total Healthy Scans</span>
                <div className="mt-1 font-mono text-lg font-bold text-slate-100">
                  {bank.healthyScanCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Split: {Math.round(BANK_FRACTION * 100)}% bank / {Math.round((1 - BANK_FRACTION) * 100)}% val
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800">
                <span className="text-slate-400">Retained Patch Vectors</span>
                <div className="mt-1 font-mono text-lg font-bold text-teal-400">
                  {bank.bankPatchCount.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {bank.dim}-dim L2-normalized
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800">
                <span className="text-slate-400">Review Cutoff ({REVIEW_PERCENTILE}th %)</span>
                <div className="mt-1 font-mono text-lg font-bold text-amber-400">
                  {bank.calibration.reviewThreshold.toFixed(4)}
                </div>
                <div className="text-[10px] text-amber-300/80 mt-0.5">
                  ~5% healthy false-positives
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800">
                <span className="text-slate-400">Refer Cutoff ({REFER_PERCENTILE}th %)</span>
                <div className="mt-1 font-mono text-lg font-bold text-rose-400">
                  {bank.calibration.referThreshold.toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Top 1% anomaly threshold
                </div>
              </div>
            </div>

            {/* Validation Score Histogram with Marked Thresholds */}
            <div className="border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-200">
                  Held-Out Validation Anomaly Score Distribution
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="h-0.5 w-3 bg-amber-400" />
                    <span>Review ({bank.calibration.reviewThreshold.toFixed(3)})</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="h-0.5 w-3 bg-rose-400" />
                    <span>Refer ({bank.calibration.referThreshold.toFixed(3)})</span>
                  </span>
                </div>
              </div>

              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="binRange" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#f8fafc',
                      }}
                    />
                    <ReferenceLine
                      x={histogramData.find((b) => b.binStart >= bank.calibration.reviewThreshold)?.binRange}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                    />
                    <ReferenceLine
                      x={histogramData.find((b) => b.binStart >= bank.calibration.referThreshold)?.binRange}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                    />
                    <Bar dataKey="count" name="Validation Scans" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Upload & Build Section */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Upload New Reference Set
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select multiple healthy scans (PNG, JPG, WebP). Minimum {MIN_NORMALS} required; {RECOMMENDED_NORMALS}+ recommended.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors">
                <Upload size={13} />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700/80 bg-slate-950/40 p-8 text-center cursor-pointer hover:border-teal-500/50 hover:bg-slate-900/40 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.png,.jpg,.jpeg,.webp"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <div className="rounded-full bg-teal-500/10 p-3 text-teal-400 border border-teal-500/20 mb-3">
              <Upload size={24} />
            </div>
            <span className="text-sm font-semibold text-slate-200">
              Drag & drop healthy scan images here, or click to browse
            </span>
            <span className="mt-1 text-xs text-slate-400">
              Select multiple DICOM exports or grayscale scans simultaneously
            </span>
          </div>

          {/* Selected Files Count & Build Button */}
          {selectedFiles.length > 0 && (
            <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <FileCheck size={16} className="text-teal-400" />
                <span className="text-slate-200 font-medium">
                  {selectedFiles.length} healthy scans staged
                </span>
                {selectedFiles.length < MIN_NORMALS ? (
                  <span className="rounded bg-rose-500/15 px-2 py-0.5 text-rose-300 font-mono text-[10px] border border-rose-500/20">
                    Needs {MIN_NORMALS - selectedFiles.length} more
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-300 font-mono text-[10px] border border-emerald-500/20">
                    Valid set size
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  disabled={isBuilding}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Clear Selection
                </button>

                <button
                  type="button"
                  onClick={handleBuild}
                  disabled={isBuilding || selectedFiles.length < MIN_NORMALS}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
                >
                  <Database size={14} />
                  <span>Build Reference Bank</span>
                </button>
              </div>
            </div>
          )}

          {/* Build Progress Display */}
          {isBuilding && buildProgress && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-teal-300 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>{buildProgress.message}</span>
                </span>
                <span className="font-mono text-teal-400">
                  {buildProgress.current} / {buildProgress.total}
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all duration-300"
                  style={{
                    width: `${
                      buildProgress.total > 0
                        ? Math.round((buildProgress.current / buildProgress.total) * 100)
                        : 50
                    }%`,
                  }}
                />
              </div>

              <div className="text-[11px] text-slate-400">
                Extracting MobileNet patch embeddings and deriving held-out percentile thresholds locally...
              </div>
            </div>
          )}

          {/* Clinical Guidance Box */}
          <div className="rounded-lg bg-slate-950/40 p-4 border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Info size={14} className="text-teal-400" />
              <span>Statistical Protocol Notice</span>
            </div>
            <p>
              Scans are split automatically: <strong>70%</strong> populate the patch memory bank and <strong>30%</strong> are held out for calibration. Bank scans are never used to compute thresholds, ensuring unbiased percentile baselines.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
