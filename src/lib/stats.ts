/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dashboard Statistics Aggregations
 * Pure utility functions computing summary metrics and Recharts time-series data
 * from screening history records.
 */

import { AnalysisRecord } from './history.ts';

export interface DashboardMetrics {
  totalScans: number;
  gateRejectedCount: number;
  normalCount: number;
  reviewCount: number;
  referCount: number;
  borderlineCount: number;
  averageLatency: number;
  verdictDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  dailyScansLast7Days: Array<{
    date: string;
    displayDate: string;
    total: number;
    normal: number;
    review: number;
    refer: number;
  }>;
  scoreTrendLast30: Array<{
    index: number;
    fileName: string;
    score: number;
    verdict: string;
    timestamp: string;
    borderline: boolean;
  }>;
}

export function computeDashboardMetrics(records: AnalysisRecord[]): DashboardMetrics {
  const totalScans = records.length;
  let gateRejectedCount = 0;
  let normalCount = 0;
  let reviewCount = 0;
  let referCount = 0;
  let borderlineCount = 0;
  let totalLatency = 0;

  for (const r of records) {
    totalLatency += r.latencyMs || 0;
    if (r.borderline) borderlineCount++;

    if (!r.gatePassed || r.verdict === 'Rejected') {
      gateRejectedCount++;
    } else if (r.verdict === 'Normal') {
      normalCount++;
    } else if (r.verdict === 'Review') {
      reviewCount++;
    } else if (r.verdict === 'Refer') {
      referCount++;
    }
  }

  const averageLatency = totalScans > 0 ? Math.round(totalLatency / totalScans) : 0;

  // Donut chart distribution
  const verdictDistribution = [
    { name: 'Normal', value: normalCount, color: '#0d9488' }, // teal-600
    { name: 'Review', value: reviewCount, color: '#f59e0b' }, // amber-500
    { name: 'Refer', value: referCount, color: '#ef4444' }, // red-500
    { name: 'Gate Rejected', value: gateRejectedCount, color: '#94a3b8' }, // slate-400
  ].filter((item) => item.value > 0);

  // Daily scans over last 7 days
  const now = new Date();
  const last7DaysMap = new Map<
    string,
    { total: number; normal: number; review: number; refer: number }
  >();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last7DaysMap.set(key, { total: 0, normal: 0, review: 0, refer: 0 });
  }

  for (const r of records) {
    const key = r.timestamp ? r.timestamp.slice(0, 10) : '';
    if (last7DaysMap.has(key)) {
      const entry = last7DaysMap.get(key)!;
      entry.total++;
      if (r.verdict === 'Normal') entry.normal++;
      else if (r.verdict === 'Review') entry.review++;
      else if (r.verdict === 'Refer') entry.refer++;
    }
  }

  const dailyScansLast7Days = Array.from(last7DaysMap.entries()).map(([dateStr, counts]) => {
    const d = new Date(dateStr + 'T00:00:00');
    const displayDate = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
    return {
      date: dateStr,
      displayDate,
      total: counts.total,
      normal: counts.normal,
      review: counts.review,
      refer: counts.refer,
    };
  });

  // Score trend of last 30 successful scans, sorted chronologically
  const passedScans = records
    .filter((r) => r.gatePassed && r.verdict !== 'Rejected')
    .slice(0, 30)
    .reverse();

  const scoreTrendLast30 = passedScans.map((r, i) => ({
    index: i + 1,
    fileName: r.fileName,
    score: Math.round(r.score * 1000) / 1000,
    verdict: r.verdict,
    timestamp: r.timestamp,
    borderline: r.borderline,
  }));

  return {
    totalScans,
    gateRejectedCount,
    normalCount,
    reviewCount,
    referCount,
    borderlineCount,
    averageLatency,
    verdictDistribution,
    dailyScansLast7Days,
    scoreTrendLast30,
  };
}
