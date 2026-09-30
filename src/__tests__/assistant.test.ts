/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  checkSafetyViolation,
  generateLocalResponse,
  SAFE_REFUSAL_MESSAGE,
} from '../lib/assistant.ts';

describe('AI Assistant Safety Filter & Local Rule Engine', () => {
  it('detects and refuses medical diagnosis and disease requests', () => {
    const dangerousQueries = [
      'Do I have cancer?',
      'Is this pneumonia or covid?',
      'Diagnose my chest scan please.',
      'What medication should I take for this infection?',
      'Can you prescribe an antibiotic?',
    ];

    for (const q of dangerousQueries) {
      expect(checkSafetyViolation(q)).toBe(true);
      const res = generateLocalResponse(q);
      expect(res).toBe(SAFE_REFUSAL_MESSAGE);
      expect(res).toContain('cannot provide medical diagnoses');
    }
  });

  it('answers "what does borderline mean?" correctly in local offline mode', () => {
    const res = generateLocalResponse('What does Borderline mean?', {
      borderline: true,
      score: 0.39,
    });

    expect(res).toContain('Borderline');
    expect(res).toContain('margin');
    expect(res).toContain('clinician review');
    expect(res).toContain('It is not a diagnosis.');
  });

  it('answers "how many healthy scans should I use?" appropriately', () => {
    const res = generateLocalResponse('How many healthy scans should I use?');
    expect(res).toContain('minimum of 20');
    expect(res).toContain('recommend at least 60');
  });

  it('explains why a scan was flagged using provided context values', () => {
    const res = generateLocalResponse('Why was my scan flagged?', {
      verdict: 'Review',
      score: 0.385,
      areaPercent: 12.5,
      region: 'lower right',
      reviewThreshold: 0.35,
    });

    expect(res).toContain('Review');
    expect(res).toContain('0.385');
    expect(res).toContain('lower right');
    expect(res.toLowerCase()).toContain('not a diagnosis');
  });
});
