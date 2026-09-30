/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ShieldAlert,
  Clock,
  Database,
  ScanLine,
  MessageSquareText,
  Download,
  Trash2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';
import { AppShell } from '../components/AppShell.tsx';
import { StatCard } from '../components/StatCard.tsx';
import { HistoryTable } from '../components/HistoryTable.tsx';
import { getCurrentSession } from '../lib/auth.ts';
import {
  AnalysisRecord,
  clearUserHistory,
  exportHistoryToCsv,
  getUserHistory,
  seedSampleHistory,
} from '../lib/history.ts';
import { getActiveBank, loadBankFromDb, MemoryBankData } from '../lib/memoryBank.ts';
import { computeDashboardMetrics } from '../lib/stats.ts';
import { RECOMMENDED_NORMALS, REVIEW_PERCENTILE, REFER_PERCENTILE } from '../config.ts';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const session = getCurrentSession();
  const userId = session?.userId || 'guest';

  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [bank, setBank] = useState<MemoryBankData | null>(getActiveBank());
  const [isLoading, setIsLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [loadedHistory, loadedBank] = await Promise.all([
          getUserHistory(userId),
          loadBankFromDb(),
        ]);
        setHistory(loadedHistory);
        setBank(loadedBank);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [userId]);

  const metrics = computeDashboardMetrics(history);

  const handleSeedSample = async () => {
    try {
      const seeded = await seedSampleHistory(userId);
      setHistory(seeded);
    } catch (err) {
      console.error('Failed to seed sample history:', err);
    }
  };

  const handleClearHistory = async () => {
    await clearUserHistory(userId);
    setHistory([]);
    setShowClearConfirm(false);
  };

  const handleExportCsv = () => {
    if (history.length > 0) {
      exportHistoryToCsv(history);
    }
  };

  const reviewCutoff = bank?.calibration.reviewThreshold ?? 0.365;
  const referCutoff = bank?.calibration.referThreshold ?? 0.495;

  return (
    <AppShell title="Clinical Screening Dashboard" bank={bank}>
      <div className="space-y-6">
        {/* Top Overview & Quick Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
              Screening Activity & Trends
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Welcome back, <strong className="text-slate-200">{session?.name}</strong> ({session?.role}). Label-free anomaly metrics computed locally.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/analyze')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-teal-500 transition-colors shadow-sm"
            >
              <ScanLine size={16} />
              <span>Analyze a scan</span>
            </button>

            <button
              onClick={() => navigate('/bank')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Database size={15} />
              <span>Reference Set</span>
            </button>

            <button
              onClick={() => navigate('/assistant')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <MessageSquareText size={15} />
              <span>Ask AI</span>
            </button>
          </div>
        </div>

        {/* 4 Primary Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Scans Screened"
            value={metrics.totalScans}
            subtitle={`${metrics.borderlineCount} borderline cases flagged`}
            icon={Activity}
            badge={{ text: 'All time', variant: 'teal' }}
          />

          <StatCard
            title="Stopped by Safety Gate"
            value={metrics.gateRejectedCount}
            subtitle="Colour, blur, or out-of-distribution"
            icon={ShieldAlert}
            badge={{
              text: `${metrics.totalScans > 0 ? Math.round((metrics.gateRejectedCount / metrics.totalScans) * 100) : 0}%`,
              variant: 'rose',
            }}
          />

          <StatCard
            title="Verdict Breakdown"
            value={`${metrics.normalCount} / ${metrics.reviewCount} / ${metrics.referCount}`}
            subtitle="Normal / Review / Refer"
            icon={FileCheck}
            badge={{ text: 'Calibrated', variant: 'amber' }}
          />

          <StatCard
            title="Average Latency"
            value={`${metrics.averageLatency} ms`}
            subtitle="Local WebGL inference time"
            icon={Clock}
            badge={{ text: '< 1s target', variant: 'slate' }}
          />
        </div>

        {/* Bank Health Card & Calibration Details */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-500/20 p-2 text-teal-400 border border-teal-500/30">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <span>Healthy Reference Bank Health</span>
                  {bank ? (
                    <span className="rounded bg-teal-500/15 px-2 py-0.5 text-[10px] font-mono text-teal-300 border border-teal-500/30">
                      Active
                    </span>
                  ) : (
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-500/30">
                      No Bank Loaded
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {bank
                    ? `Configured with ${bank.healthyScanCount} verified healthy scans (${bank.bankPatchCount} patch embeddings)`
                    : 'A healthy reference bank is required to calibrate cutoffs and screen patient scans.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/bank')}
              className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium self-start sm:self-center"
            >
              <span>Manage Bank & Thresholds</span>
              <span>&rarr;</span>
            </button>
          </div>

          {bank ? (
            <div className="mt-4 space-y-3">
              {bank.healthyScanCount < RECOMMENDED_NORMALS && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/30 p-2.5 text-xs text-amber-300">
                  <AlertTriangle size={15} className="shrink-0 text-amber-400" />
                  <span>
                    <strong>Statistical Recommendation: </strong> Current bank has {bank.healthyScanCount} scans. We recommend at least {RECOMMENDED_NORMALS} healthy scans for optimal clinical calibration.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800">
                  <span className="text-slate-400">Review Cutoff ({REVIEW_PERCENTILE}th %)</span>
                  <div className="mt-1 font-mono text-base font-bold text-amber-400">
                    {bank.calibration.reviewThreshold.toFixed(4)}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800">
                  <span className="text-slate-400">Refer Cutoff ({REFER_PERCENTILE}th %)</span>
                  <div className="mt-1 font-mono text-base font-bold text-rose-400">
                    {bank.calibration.referThreshold.toFixed(4)}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800">
                  <span className="text-slate-400">Patch-level Cutoff</span>
                  <div className="mt-1 font-mono text-base font-bold text-teal-400">
                    {bank.calibration.patchThreshold.toFixed(4)}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800">
                  <span className="text-slate-400">Built Date</span>
                  <div className="mt-1 font-mono text-xs text-slate-300 truncate">
                    {new Date(bank.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg bg-slate-950/40 p-4 border border-slate-800">
              <span className="text-xs text-slate-400">
                You can build your own healthy bank or load our pre-calibrated sample chest X-ray bank instantly.
              </span>
              <button
                onClick={() => navigate('/bank')}
                className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
              >
                Go to Build Bank
              </button>
            </div>
          )}
        </div>

        {/* Charts Grid: 3 Recharts Visualizations */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Chart 1: Verdict Distribution Donut */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-slate-100">
              Verdict Distribution
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Normal vs Review vs Refer breakdown
            </p>

            <div className="mt-3 h-52 flex items-center justify-center">
              {metrics.verdictDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.verdictDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {metrics.verdictDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-xs text-slate-500">
                  No data to display. Screen scans to view distribution.
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
              {metrics.verdictDistribution.map((v, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: v.color }}
                  />
                  <span className="text-slate-300">
                    {v.name}: <strong>{v.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2: Daily Scans (Last 7 Days) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Daily Screening Throughput (Last 7 Days)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Volume of medical images assessed locally per calendar day
            </p>

            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.dailyScansLast7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="displayDate" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#f8fafc',
                    }}
                  />
                  <Bar dataKey="normal" name="Normal" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="review" name="Review" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="refer" name="Refer" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Chart 3: Anomaly Scores Trend (Last 30) with Reference Lines */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Screening Anomaly Scores Trend (Last 30 Scans)
              </h3>
              <p className="text-[11px] text-slate-400">
                Visualizes individual scan scores against calibrated Review ({reviewCutoff.toFixed(3)}) and Refer ({referCutoff.toFixed(3)}) thresholds.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-amber-500" />
                <span className="text-slate-300">Review Cutoff</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-rose-500" />
                <span className="text-slate-300">Refer Cutoff</span>
              </div>
            </div>
          </div>

          <div className="mt-4 h-64">
            {metrics.scoreTrendLast30.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.scoreTrendLast30} margin={{ top: 15, right: 20, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="index" stroke="#64748b" fontSize={11} label={{ value: 'Scan Sequence', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 'auto']} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#f8fafc',
                    }}
                  />
                  <ReferenceLine
                    y={reviewCutoff}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: 'Review', fill: '#f59e0b', fontSize: 10, position: 'right' }}
                  />
                  <ReferenceLine
                    y={referCutoff}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: 'Refer', fill: '#ef4444', fontSize: 10, position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Anomaly Score"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#14b8a6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No successful scans recorded yet. Screen a scan to plot anomaly scores.
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Table & Controls */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Recent Screening History (Last 10)
              </h3>
              <p className="text-xs text-slate-400">
                Click any row to open the complete clinical summary and score breakdown.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSeedSample}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-300 hover:bg-teal-500/20 transition-colors"
                title="Populate synthetic sample screening entries for dashboard review"
              >
                <Sparkles size={13} />
                <span>Load sample data</span>
              </button>

              <button
                onClick={handleExportCsv}
                disabled={history.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                <Download size={13} />
                <span>Export (.csv)</span>
              </button>

              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={history.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
              >
                <Trash2 size={13} />
                <span>Clear history</span>
              </button>
            </div>
          </div>

          <HistoryTable
            records={history.slice(0, 10)}
            onOpenAssistantWithRecord={(rec) => {
              navigate('/assistant', {
                state: {
                  context: {
                    fileName: rec.fileName,
                    score: rec.score,
                    percentile: rec.percentile,
                    verdict: rec.verdict,
                    borderline: rec.borderline,
                    areaPercent: rec.areaPercent,
                    region: rec.region,
                    sentence: rec.sentence,
                    reviewThreshold: bank?.calibration.reviewThreshold,
                    referThreshold: bank?.calibration.referThreshold,
                    gatePassed: rec.gatePassed,
                    gateReasons: rec.gateReasons,
                    healthyScanCount: bank?.healthyScanCount,
                  },
                },
              });
            }}
          />
        </div>
      </div>

      {/* Confirmation Modal for Clearing History */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={24} />
              <h3 className="font-semibold text-slate-100">Clear All Screening History?</h3>
            </div>
            <p className="mt-3 text-xs text-slate-300 leading-relaxed">
              This will remove all {history.length} metadata records stored in IndexedDB for your profile. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
              >
                Yes, Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
