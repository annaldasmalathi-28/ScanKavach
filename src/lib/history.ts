/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Analysis History Persistence
 * Stores per-user screening metadata in IndexedDB.
 * CRITICAL PRIVACY ASSURANCE: Medical scan image pixels are NEVER saved to history.
 */

import { HISTORY_LIMIT } from '../config.ts';

export interface AnalysisRecord {
  id: string;
  userId: string;
  fileName: string;
  timestamp: string;
  gatePassed: boolean;
  gateReasons?: string[];
  score: number;
  percentile: number;
  verdict: 'Normal' | 'Review' | 'Refer' | 'Rejected';
  borderline: boolean;
  areaPercent: number;
  region: string;
  sentence: string;
  latencyMs: number;
}

const DB_NAME = 'scankavach_history_db';
const STORE_NAME = 'history_records';

function openHistoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('History DB open error'));
  });
}

/**
 * Saves a new screening metadata record for a user.
 */
export async function saveHistoryRecord(record: AnalysisRecord): Promise<void> {
  try {
    const db = await openHistoryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('Failed to save history record:', err);
  }
}

/**
 * Retrieves history records for a given user, sorted descending by timestamp.
 */
export async function getUserHistory(userId: string): Promise<AnalysisRecord[]> {
  try {
    const db = await openHistoryDb();
    return new Promise<AnalysisRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const userIndex = store.index('userId');
      const req = userIndex.getAll(userId);

      req.onsuccess = () => {
        const records: AnalysisRecord[] = req.result || [];
        records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(records.slice(0, HISTORY_LIMIT));
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('Failed to load history:', err);
    return [];
  }
}

/**
 * Deletes all analysis history for a given user.
 */
export async function clearUserHistory(userId: string): Promise<void> {
  try {
    const db = await openHistoryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const userIndex = store.index('userId');
      const req = userIndex.openCursor(userId);

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('Failed to clear user history:', err);
  }
}

/**
 * Exports user history records as a CSV string and initiates browser download.
 */
export function exportHistoryToCsv(records: AnalysisRecord[]): void {
  const headers = [
    'Timestamp',
    'FileName',
    'Verdict',
    'Borderline',
    'AnomalyScore',
    'Percentile',
    'AreaPct',
    'Region',
    'GatePassed',
    'LatencyMs',
    'SummarySentence',
  ];

  const escapeCsv = (val: string | number | boolean | undefined) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map((r) => [
    escapeCsv(r.timestamp),
    escapeCsv(r.fileName),
    escapeCsv(r.verdict),
    escapeCsv(r.borderline ? 'Yes' : 'No'),
    escapeCsv(r.score.toFixed(4)),
    escapeCsv(r.percentile),
    escapeCsv(r.areaPercent.toFixed(1)),
    escapeCsv(r.region),
    escapeCsv(r.gatePassed ? 'Passed' : 'Rejected'),
    escapeCsv(r.latencyMs),
    escapeCsv(r.sentence),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scankavach-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Seeds realistic synthetic historical data so the dashboard charts can be previewed immediately.
 */
export async function seedSampleHistory(userId: string): Promise<AnalysisRecord[]> {
  const sampleData: AnalysisRecord[] = [
    {
      id: `rec_sample_1`,
      userId,
      fileName: 'CXR_PA_2026_0142.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      gatePassed: true,
      score: 0.184,
      percentile: 32,
      verdict: 'Normal',
      borderline: false,
      areaPercent: 0,
      region: 'None',
      sentence: 'No region stands out from the healthy reference set.',
      latencyMs: 342,
    },
    {
      id: `rec_sample_2`,
      userId,
      fileName: 'CXR_PA_2026_0143.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      gatePassed: true,
      score: 0.382,
      percentile: 96,
      verdict: 'Review',
      borderline: false,
      areaPercent: 8.2,
      region: 'lower right',
      sentence: 'Unusual pattern in the lower right of the image, about 8% of the area. Not a diagnosis.',
      latencyMs: 388,
    },
    {
      id: `rec_sample_3`,
      userId,
      fileName: 'CXR_AP_2026_0144.jpg',
      timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      gatePassed: true,
      score: 0.541,
      percentile: 99,
      verdict: 'Refer',
      borderline: false,
      areaPercent: 18.5,
      region: 'centre left',
      sentence: 'Unusual pattern in the centre left of the image, about 19% of the area. Not a diagnosis.',
      latencyMs: 412,
    },
    {
      id: `rec_sample_4`,
      userId,
      fileName: 'CXR_PA_2026_0145.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
      gatePassed: true,
      score: 0.355,
      percentile: 94,
      verdict: 'Normal',
      borderline: true,
      areaPercent: 3.1,
      region: 'lower left',
      sentence: 'Unusual pattern in the lower left of the image, about 3% of the area. Not a diagnosis.',
      latencyMs: 365,
    },
    {
      id: `rec_sample_5`,
      userId,
      fileName: 'Patient_Phone_Upload.jpg',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      gatePassed: false,
      gateReasons: ['This is a colour photo. Expected a grayscale medical scan.'],
      score: 0,
      percentile: 0,
      verdict: 'Rejected',
      borderline: false,
      areaPercent: 0,
      region: 'None',
      sentence: 'Rejected by safety gate: Colour photo detected.',
      latencyMs: 48,
    },
    {
      id: `rec_sample_6`,
      userId,
      fileName: 'CXR_PA_2026_0147.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      gatePassed: true,
      score: 0.221,
      percentile: 58,
      verdict: 'Normal',
      borderline: false,
      areaPercent: 0,
      region: 'None',
      sentence: 'No region stands out from the healthy reference set.',
      latencyMs: 320,
    },
    {
      id: `rec_sample_7`,
      userId,
      fileName: 'CXR_PA_2026_0148.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
      gatePassed: true,
      score: 0.402,
      percentile: 97,
      verdict: 'Review',
      borderline: false,
      areaPercent: 11.4,
      region: 'upper right',
      sentence: 'Unusual pattern in the upper right of the image, about 11% of the area. Not a diagnosis.',
      latencyMs: 370,
    },
    {
      id: `rec_sample_8`,
      userId,
      fileName: 'CXR_PA_2026_0149.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      gatePassed: true,
      score: 0.165,
      percentile: 19,
      verdict: 'Normal',
      borderline: false,
      areaPercent: 0,
      region: 'None',
      sentence: 'No region stands out from the healthy reference set.',
      latencyMs: 310,
    },
    {
      id: `rec_sample_9`,
      userId,
      fileName: 'CT_Pelvis_Mistake.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
      gatePassed: false,
      gateReasons: [
        'This does not look like the type of scan the reference set was built from (for example, not a chest X-ray).',
      ],
      score: 0,
      percentile: 0,
      verdict: 'Rejected',
      borderline: false,
      areaPercent: 0,
      region: 'None',
      sentence: 'Rejected by safety gate: Out-of-distribution scan type.',
      latencyMs: 145,
    },
  ];

  for (const record of sampleData) {
    await saveHistoryRecord(record);
  }

  return sampleData;
}
