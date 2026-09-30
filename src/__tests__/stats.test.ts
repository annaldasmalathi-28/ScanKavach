/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { computeDashboardMetrics } from '../lib/stats.ts';
import { AnalysisRecord } from '../lib/history.ts';

describe('Dashboard Statistics Aggregations', () => {
  const mockRecords: AnalysisRecord[] = [
    {
      id: '1',
      userId: 'u1',
      fileName: 'cxr1.png',
      timestamp: '2026-09-29T10:00:00.000Z',
      gatePassed: true,
      score: 0.15,
      percentile: 25,
      verdict: 'Normal',
      borderline: false,
      areaPercent: 0,
      region: 'None',
      sentence: 'No region stands out.',
      latencyMs: 300,
    },
    {
      id: '2',
      userId: 'u1',
      fileName: 'cxr2.png',
      timestamp: '2026-09-29T11:00:00.000Z',
      gatePassed: true,
      score: 0.38,
      percentile: 96,
      verdict: 'Review',
      borderline: true,
      areaPercent: 7,
      region: 'lower right',
      sentence: 'Unusual pattern in lower right.',
      latencyMs: 400,
    },
    {
      id: '3',
      userId: 'u1',
      fileName: 'cxr3.png',
      timestamp: '2026-09-28T09:00:00.000Z',
      gatePassed: true,
      score: 0.55,
      percentile: 99,
      verdict: 'Refer',
      borderline: false,
      areaPercent: 18,
      region: 'centre left',
      sentence: 'Unusual pattern in centre left.',
      latencyMs: 500,
    },
    {
      id: '4',
      userId: 'u1',
      fileName: 'photo.jpg',
      timestamp: '2026-09-28T14:00:00.000Z',
      gatePassed: false,
      gateReasons: ['Colour photo detected'],
      score: 0,
      percentile: 0,
      verdict: 'Rejected',
      borderline: false,
      areaPercent: 0,
      region: 'None',
      sentence: 'Rejected by gate.',
      latencyMs: 50,
    },
  ];

  it('computes counts, sums, and latencies accurately on a fixed history array', () => {
    const metrics = computeDashboardMetrics(mockRecords);

    expect(metrics.totalScans).toBe(4);
    expect(metrics.gateRejectedCount).toBe(1);
    expect(metrics.normalCount).toBe(1);
    expect(metrics.reviewCount).toBe(1);
    expect(metrics.referCount).toBe(1);
    expect(metrics.borderlineCount).toBe(1);

    // Average latency: (300 + 400 + 500 + 50) / 4 = 312.5 -> 313
    expect(metrics.averageLatency).toBe(313);

    // Verdict distribution has 4 non-zero entries
    expect(metrics.verdictDistribution.length).toBe(4);

    // Score trend contains the 3 successful scans
    expect(metrics.scoreTrendLast30.length).toBe(3);
  });

  it('handles empty history arrays safely without division by zero', () => {
    const metrics = computeDashboardMetrics([]);

    expect(metrics.totalScans).toBe(0);
    expect(metrics.averageLatency).toBe(0);
    expect(metrics.normalCount).toBe(0);
    expect(metrics.verdictDistribution.length).toBe(0);
    expect(metrics.scoreTrendLast30.length).toBe(0);
  });
});
