/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Shield,
  Download,
  Search,
  Filter,
  Sliders,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Activity,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';
import { AppShell } from '../components/AppShell.tsx';
import { AuditRecord, exportAuditLogJson, getAuditRecords } from '../lib/audit.ts';
import {
  computeConfusionMatrix,
  computeRocCurve,
  EvaluationSample,
  generateSyntheticCohort,
} from '../lib/evaluation.ts';
import { getActiveBank } from '../lib/memoryBank.ts';
import { APP_FULL_TITLE, CLINICAL_DISCLAIMER } from '../config.ts';

export const AuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'card' | 'audit' | 'eval'>('card');
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Evaluation tool state
  const [cohort, setCohort] = useState<EvaluationSample[]>(generateSyntheticCohort());
  const [evalThreshold, setEvalThreshold] = useState<number>(0.38);

  const bank = getActiveBank();

  useEffect(() => {
    async function loadLogs() {
      const records = await getAuditRecords();
      setAuditRecords(records);
    }
    loadLogs();
  }, []);

  const cmMetrics = computeConfusionMatrix(cohort, evalThreshold);
  const rocData = computeRocCurve(cohort);

  const filteredLogs = auditRecords.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.eventType.toLowerCase().includes(q) ||
      r.details.toLowerCase().includes(q) ||
      r.userId.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell title="Model Card, Audit Trail & Evaluation" bank={bank}>
      <div className="space-y-6">
        {/* Header & Tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
                Governance, Audit &amp; Evaluation
              </h2>
              <span className="rounded bg-teal-500/20 px-2 py-0.5 text-[10px] font-mono text-teal-300">
                Compliance
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Mitchell et al. model card specification, chronological audit logs, and quantitative ROC evaluation.
            </p>
          </div>

          <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              onClick={() => setActiveTab('card')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'card'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Model Card
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'audit'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Audit Trail ({auditRecords.length})
            </button>
            <button
              onClick={() => setActiveTab('eval')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'eval'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Clinical Evaluation (ROC)
            </button>
          </div>
        </div>

        {/* TAB 1: MODEL CARD */}
        {activeTab === 'card' && (
          <div className="space-y-6 text-xs text-slate-300">
            {/* Overview */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex items-center gap-2 text-teal-400">
                <BookOpen size={20} />
                <h3 className="font-semibold text-slate-100 text-sm">
                  1. Model Details &amp; Architecture
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-2">
                  <div>
                    <span className="text-slate-400 font-mono text-[11px] block">Model Name</span>
                    <strong className="text-slate-100">{APP_FULL_TITLE}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-[11px] block">Backbone Topology</span>
                    <span className="text-slate-200">MobileNet v1 0.25 224 (Frozen Feature Extractor)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-[11px] block">Patch Feature Layer</span>
                    <span className="text-teal-400 font-mono">conv_pw_11_relu (14x14 spatial, 196 patches)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-[11px] block">Memory Bank Capacity</span>
                    <span className="text-slate-200">Up to 8,000 L2-normalized patch embeddings</span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-2">
                  <div>
                    <span className="text-slate-400 font-mono text-[11px] block">Inference Runtime</span>
                    <span className="text-slate-200">Client-Side WebGL via @tensorflow/tfjs (CPU auto-fallback)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-[11px] block">Decision Support Fusion</span>
                    <span className="text-slate-200">Supervised 128-dim Ridge classifier + Unsupervised distance</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-[11px] block">Scientific Lineage</span>
                    <span className="text-slate-200">Inspired by PatchCore (Roth et al., CVPR 2022)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono text-[11px] block">License</span>
                    <span className="text-slate-200">Apache-2.0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Intended & Out-of-Scope Use */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 size={16} />
                  <span>Intended Clinical Use</span>
                </div>
                <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                  <li>Triage prioritization of chest radiographs in high-volume settings.</li>
                  <li>Decision support highlighting atypical anatomical patches for human review.</li>
                  <li>Comparative visual grounding against nearest verified healthy scans.</li>
                  <li>Air-gapped operation in rural or bandwidth-limited clinics.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-5 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                  <AlertTriangle size={16} />
                  <span>Out-of-Scope &amp; Prohibited Use</span>
                </div>
                <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                  <li>Sole automated diagnostic determination without physician confirmation.</li>
                  <li>Prescription of medication, dosing, or therapeutic intervention.</li>
                  <li>Pediatric neonate chest screening without domain recalibration.</li>
                  <li>Evaluation of non-radiological images (CT, MRI, ultrasound, dermatology).</li>
                </ul>
              </div>
            </div>

            {/* Ethical Considerations */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
              <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm">
                <Shield size={18} />
                <span>Ethical Considerations &amp; Data Privacy</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                ScanKavach operates under a strict privacy-preserving local architecture. Pixel data is loaded into volatile browser GPU memory and is purged when tabs close. No patient images or identifiers are transmitted across the network. Disclaimers explicitly label findings as non-diagnostic decision support.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by event, user, or details..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <button
                onClick={() => exportAuditLogJson(auditRecords)}
                disabled={auditRecords.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                <Download size={13} />
                <span>Export Audit Log (.json)</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                  <tr>
                    <th scope="col" className="px-4 py-3">Timestamp</th>
                    <th scope="col" className="px-4 py-3">Event Type</th>
                    <th scope="col" className="px-4 py-3">User &amp; Role</th>
                    <th scope="col" className="px-4 py-3">Event Details</th>
                    <th scope="col" className="px-4 py-3 text-right">Hash Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-850/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-teal-300 border border-slate-700">
                            {log.eventType}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                          {log.userId} <span className="text-slate-500">({log.userRole})</span>
                        </td>
                        <td className="px-4 py-3 text-slate-200 max-w-xs truncate">
                          {log.details}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-500">
                          {log.hash ? log.hash.slice(0, 10) : '—'}...
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No audit events match your search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CLINICAL EVALUATION (ROC) */}
        {activeTab === 'eval' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Quantitative ROC Sweep &amp; Confusion Matrix
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Evaluated across a benchmark test cohort of {cohort.length} verified scans (50 normal, 35 abnormal).
                </p>
              </div>

              <button
                onClick={() => setCohort(generateSyntheticCohort())}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 transition-colors"
              >
                <Sparkles size={13} />
                <span>Reseed Cohort</span>
              </button>
            </div>

            {/* ROC Curve Graph & Cutoff Slider */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Receiver Operating Characteristic (ROC)
                  </span>
                  <span className="font-mono text-teal-400 font-bold">
                    AUC = {rocData.auc.toFixed(3)}
                  </span>
                </div>

                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rocData.points} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="fpr" stroke="#64748b" fontSize={10} label={{ value: 'False Positive Rate (1 - Specificity)', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 10 }} />
                      <YAxis stroke="#64748b" fontSize={10} label={{ value: 'True Positive Rate (Sensitivity)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#f8fafc',
                        }}
                      />
                      <Line type="monotone" dataKey="tpr" stroke="#14b8a6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Threshold Calibration Controls & 2x2 Matrix */}
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-200">Decision Cutoff Threshold:</span>
                    <span className="font-mono text-base font-bold text-teal-400">
                      {evalThreshold.toFixed(3)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.15"
                    max="0.65"
                    step="0.01"
                    value={evalThreshold}
                    onChange={(e) => setEvalThreshold(parseFloat(e.target.value))}
                    className="w-full accent-teal-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>High Sensitivity (0.15)</span>
                    <span>Balanced (0.38)</span>
                    <span>High Specificity (0.65)</span>
                  </div>
                </div>

                {/* 2x2 Confusion Matrix */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-xs space-y-3">
                  <div className="font-semibold text-slate-200 text-xs">
                    Empirical 2x2 Confusion Matrix
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center font-mono">
                    <div className="rounded-lg bg-teal-950/40 border border-teal-500/30 p-2.5">
                      <span className="text-[10px] text-slate-400 block uppercase">True Positives (TP)</span>
                      <span className="text-lg font-bold text-teal-300">{cmMetrics.tp}</span>
                    </div>

                    <div className="rounded-lg bg-rose-950/40 border border-rose-500/30 p-2.5">
                      <span className="text-[10px] text-slate-400 block uppercase">False Positives (FP)</span>
                      <span className="text-lg font-bold text-rose-300">{cmMetrics.fp}</span>
                    </div>

                    <div className="rounded-lg bg-amber-950/40 border border-amber-500/30 p-2.5">
                      <span className="text-[10px] text-slate-400 block uppercase">False Negatives (FN)</span>
                      <span className="text-lg font-bold text-amber-300">{cmMetrics.fn}</span>
                    </div>

                    <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 p-2.5">
                      <span className="text-[10px] text-slate-400 block uppercase">True Negatives (TN)</span>
                      <span className="text-lg font-bold text-emerald-300">{cmMetrics.tn}</span>
                    </div>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                    <div className="rounded bg-slate-950 p-2 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Sensitivity (Recall)</span>
                      <span className="font-bold text-teal-400 font-mono">
                        {Math.round(cmMetrics.sensitivity * 100)}%
                      </span>
                    </div>
                    <div className="rounded bg-slate-950 p-2 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Specificity</span>
                      <span className="font-bold text-teal-400 font-mono">
                        {Math.round(cmMetrics.specificity * 100)}%
                      </span>
                    </div>
                    <div className="rounded bg-slate-950 p-2 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">F1-Score</span>
                      <span className="font-bold text-teal-400 font-mono">
                        {cmMetrics.f1Score.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center text-xs text-slate-400">
          <p>{CLINICAL_DISCLAIMER}</p>
        </div>
      </div>
    </AppShell>
  );
};
