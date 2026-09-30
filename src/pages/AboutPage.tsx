/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Info,
  Shield,
  Layers,
  AlertTriangle,
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  HeartPulse,
  Cpu,
  Globe2,
  BookOpen,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { clearBankFromDb, getActiveBank } from '../lib/memoryBank.ts';
import { clearUserHistory } from '../lib/history.ts';
import { getCurrentSession } from '../lib/auth.ts';
import { runSelfTests, SelfTestItem } from '../lib/selfTest.ts';
import { CLINICAL_DISCLAIMER } from '../config.ts';

export const AboutPage: React.FC = () => {
  const session = getCurrentSession();
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<SelfTestItem[] | null>(null);
  const [clearStatus, setClearStatus] = useState<string | null>(null);

  const handleRunSelfTest = async () => {
    try {
      setIsRunningTests(true);
      const results = await runSelfTests();
      setTestResults(results);
    } catch (err) {
      console.error('Self test execution failed:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleClearAllLocalData = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete ALL local data? This will clear the active reference set, screening history, and local session on this device.'
      )
    ) {
      await clearBankFromDb();
      if (session?.userId) {
        await clearUserHistory(session.userId);
      }
      localStorage.clear();
      setClearStatus('All local databases, caches, and storage cleared successfully.');
    }
  };

  return (
    <AppShell title="About ScanKavach" bank={getActiveBank()}>
      <div className="mx-auto max-w-4xl space-y-8 pb-12">
        {/* Header */}
        <div className="border-b border-slate-800 pb-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
            Label-Free Anomaly Screening for Medical Images
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Methodology, safety architecture, privacy guarantees, clinical caveats, and operational self-diagnostics.
          </p>
        </div>

        {/* 1. How It Works in 4 Steps */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-2 text-teal-400">
            <Layers size={20} />
            <h3 className="font-semibold text-slate-100">How ScanKavach Works in 4 Steps</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-1.5">
              <div className="font-mono text-xs font-bold text-teal-400">01. INGEST NORMALS ONLY</div>
              <p className="text-slate-400 leading-relaxed">
                A reference bank is built solely from verified healthy scans. No disease labels or pathological annotations are ever required, eliminating annotation bottlenecks and label bias.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-1.5">
              <div className="font-mono text-xs font-bold text-teal-400">02. 14x14 PATCH EMBEDDINGS</div>
              <p className="text-slate-400 leading-relaxed">
                MobileNet extracts high-level spatial patch feature vectors (196 patches per scan). Each patch embedding captures local anatomical texture and tissue density.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-1.5">
              <div className="font-mono text-xs font-bold text-teal-400">03. CHUNKED NEAREST-NEIGHBOUR</div>
              <p className="text-slate-400 leading-relaxed">
                During screening, each query patch is compared to the memory bank via chunked matrix multiplication. The image anomaly score is computed as the mean of the top-3 most distant patches.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-1.5">
              <div className="font-mono text-xs font-bold text-teal-400">04. CALIBRATED CUTOFFS</div>
              <p className="text-slate-400 leading-relaxed">
                Screening verdicts (Normal, Review, Refer) are derived from held-out healthy validation percentiles (95th and 99th), flagging borderline scores within a 5% margin for human review.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Safety Gate: Capabilities & Limitations */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-2 text-teal-400">
            <Shield size={20} />
            <h3 className="font-semibold text-slate-100">Input Safety Gate: Scope & Boundaries</h3>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            The safety gate evaluates incoming images before feature scoring to prevent false-alarm outlier scores caused by artifactual inputs:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-4 space-y-2">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={15} />
                <span>What the Safety Gate Catches:</span>
              </div>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                <li>Colour photos & selfies (channel difference check)</li>
                <li>Blank or low-contrast scans (grayscale std &lt; 0.05)</li>
                <li>Severe motion blur (calibrated Laplacian variance)</li>
                <li>Out-of-distribution body parts (embedding distance)</li>
              </ul>
            </div>

            <div className="rounded-lg bg-rose-950/20 border border-rose-500/20 p-4 space-y-2">
              <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                <XCircle size={15} />
                <span>What the Safety Gate Cannot Catch:</span>
              </div>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                <li>Subtle patient rotation or poor inspiratory effort</li>
                <li>Implanted pacemakers, surgical clips, or jewelry</li>
                <li>Image compression noise below the blur threshold</li>
                <li>Clinical history or previous longitudinal changes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 3. The Honest Caveat & Privacy Model */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle size={20} />
            <h3 className="font-semibold text-slate-100">The Honest Caveat & Privacy Architecture</h3>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-200 leading-relaxed font-medium">
            {CLINICAL_DISCLAIMER}
            <span className="block mt-1 text-slate-300 font-normal">
              ScanKavach is an automated pattern-screening aid designed to help prioritize cases for clinical review. It cannot differentiate between infectious lesions, neoplasms, granulomas, or post-surgical changes.
            </span>
          </div>

          <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 text-xs text-slate-300 space-y-2">
            <h4 className="font-semibold text-teal-400">Air-Gapped Device Privacy Model:</h4>
            <ul className="space-y-1.5 text-slate-400">
              <li>
                <strong className="text-slate-200">1. Canvas Metadata Stripping: </strong>
                Incoming files are immediately re-rendered to an offscreen canvas, removing all EXIF and DICOM header tags.
              </li>
              <li>
                <strong className="text-slate-200">2. Local-Only Processing: </strong>
                Inference and memory bank storage run 100% inside your browser&apos;s IndexedDB and WebGL runtime.
              </li>
              <li>
                <strong className="text-slate-200">3. Text-Only AI Assistant: </strong>
                If the AI assistant is used, only numerical summaries (scores, area %, peak region) are transmitted; medical images never leave your machine.
              </li>
            </ul>
          </div>
        </div>

        {/* 4. Sustainable Development Goals (SDG 3, 9, 10) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-2 text-teal-400">
            <Globe2 size={20} />
            <h3 className="font-semibold text-slate-100">UN Sustainable Development Goals Alignment</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800 space-y-1">
              <div className="font-bold text-teal-400 flex items-center gap-1.5">
                <HeartPulse size={14} />
                <span>SDG 3: Good Health</span>
              </div>
              <p className="text-slate-400">
                Enables rapid triage and early anomaly detection in underserved remote clinics without requiring specialized subspecialist radiologists on site.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800 space-y-1">
              <div className="font-bold text-teal-400 flex items-center gap-1.5">
                <Cpu size={14} />
                <span>SDG 9: Innovation</span>
              </div>
              <p className="text-slate-400">
                Brings state-of-the-art vision models directly into client-side browser execution, eliminating server infrastructure overhead and recurring cloud costs.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800 space-y-1">
              <div className="font-bold text-teal-400 flex items-center gap-1.5">
                <Globe2 size={14} />
                <span>SDG 10: Reduced Inequalities</span>
              </div>
              <p className="text-slate-400">
                Democratizes medical imaging AI across low-bandwidth, low-resource settings without prohibitive commercial software licenses.
              </p>
            </div>
          </div>
        </div>

        {/* 5. Limitations & Prior Work */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-teal-400">
            <BookOpen size={18} />
            <h3 className="font-semibold text-slate-100">Prior Work & Scientific Foundation</h3>
          </div>

          <p className="text-slate-400 leading-relaxed">
            ScanKavach is inspired by the PatchCore framework (Roth et al., CVPR 2022) for memory-efficient patch-level anomaly detection. By freezing a compact ImageNet feature extractor (MobileNet v1 0.25 224) and retaining core representative normal patches, the model avoids catastrophic forgetting and catastrophic overfitting common in generative autoencoders.
          </p>

          <div className="mt-2 text-slate-400">
            <strong className="text-slate-200">Backbone Limitations: </strong>
            MobileNet v1 0.25 is optimized for low-latency web browser execution. Differences in scanner manufacturer calibration, beam energy, or grid contrast can shift feature distributions. For best results, reference banks should be built using scans acquired on the same radiological equipment.
          </div>
        </div>

        {/* 6. In-App Self-Test Diagnostic Suite */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <span>In-App Diagnostic Self-Test</span>
                {testResults && (
                  <span className="text-xs text-slate-400">
                    ({testResults.filter((t) => t.passed).length}/{testResults.length} passing)
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Runs live operational tests verifying safety gates and anomaly sensitivity.
              </p>
            </div>

            <button
              onClick={handleRunSelfTest}
              disabled={isRunningTests}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Play size={13} />
              <span>{isRunningTests ? 'Executing Tests...' : 'Run self-test'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-2 text-xs">
              {testResults.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-lg p-3 border flex items-start justify-between gap-3 ${
                    t.passed
                      ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-200'
                      : 'bg-rose-950/20 border-rose-500/20 text-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      {t.passed ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : (
                        <XCircle size={16} className="text-rose-400" />
                      )}
                      <span>{t.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{t.description}</p>
                    <p className="text-[11px] font-mono text-slate-300">{t.message}</p>
                  </div>

                  <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                    {t.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Clear All Local Data Button */}
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-rose-300">
              Reset Application & Clear Local Storage
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Purges all IndexedDB reference banks, screening history records, and authentication tokens.
            </p>
            {clearStatus && (
              <p className="mt-2 text-xs text-emerald-400 font-medium">{clearStatus}</p>
            )}
          </div>

          <button
            onClick={handleClearAllLocalData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 transition-colors"
          >
            <Trash2 size={14} />
            <span>Clear all local data</span>
          </button>
        </div>
      </div>
    </AppShell>
  );
};
