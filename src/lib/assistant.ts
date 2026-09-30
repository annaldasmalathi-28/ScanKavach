/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScanKavach AI Assistant
 * Dual-mode conversational assistant:
 * 1. Offline rule-based local engine (always available, no API key required).
 * 2. Optional Gemini client-side integration if VITE_GEMINI_API_KEY is configured.
 *
 * Enforces strict safety filters preventing medical diagnoses or medication advice.
 * Scans never leave the device; only text summaries are passed.
 */

import { GoogleGenAI } from '@google/genai';
import {
  BORDERLINE_MARGIN,
  CLINICAL_DISCLAIMER,
  GEMINI_MODEL,
  MIN_NORMALS,
  RECOMMENDED_NORMALS,
  REFER_PERCENTILE,
  REVIEW_PERCENTILE,
} from '../config.ts';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  offlineFallback?: boolean;
}

export interface AssistantContext {
  fileName?: string;
  score?: number;
  percentile?: number;
  verdict?: 'Normal' | 'Review' | 'Refer' | 'Rejected';
  borderline?: boolean;
  areaPercent?: number;
  region?: string;
  sentence?: string;
  reviewThreshold?: number;
  referThreshold?: number;
  gatePassed?: boolean;
  gateReasons?: string[];
  healthyScanCount?: number;
}

export const SUGGESTED_QUESTIONS = [
  'Why was my scan flagged?',
  'What does Borderline mean?',
  'How do I get a better scan?',
  'How many healthy scans should I use?',
  'Explain the thresholds',
];

const SAFETY_KEYWORDS = [
  'diagnos',
  'disease',
  'cancer',
  'pneumonia',
  'covid',
  'tuberculosis',
  'tb',
  'tumor',
  'tumour',
  'cure',
  'treat',
  'medicat',
  'prescrib',
  'drug',
  'pill',
  'antibiotic',
  'therapy',
  'am i sick',
  'what do i have',
  'do i have',
  'is this cancer',
  'is it fatal',
];

const SYSTEM_INSTRUCTION =
  'You are ScanKavach Assistant. Explain screening results, thresholds, borderline scores, image-quality issues and how to improve inputs, in plain language for clinicians and students. You are not a doctor. Never diagnose, never name a disease as the cause, never recommend treatment or medication. If asked for a diagnosis or treatment, say you cannot provide it and advise consulting a qualified clinician. Base answers only on the provided result summary and the app\'s documented behaviour. Keep answers under 120 words.';

/**
 * Checks whether the user's query asks for medical diagnosis, disease identification, or medication.
 */
export function checkSafetyViolation(query: string): boolean {
  const lower = query.toLowerCase();
  return SAFETY_KEYWORDS.some((kw) => lower.includes(kw));
}

export const SAFE_REFUSAL_MESSAGE =
  'I cannot provide medical diagnoses, identify diseases, or recommend treatments. ScanKavach is a label-free screening aid that flags anomalous visual patterns against a healthy reference set, not a diagnostic system. Please consult a qualified clinician or radiologist for clinical evaluation. ' +
  CLINICAL_DISCLAIMER;

/**
 * Generates an answer using the offline rule-based knowledge base.
 */
export function generateLocalResponse(query: string, context?: AssistantContext): string {
  const q = query.toLowerCase().trim();

  // Safety refusal first
  if (checkSafetyViolation(q)) {
    return SAFE_REFUSAL_MESSAGE;
  }

  // Why was scan flagged / result question
  if (q.includes('why') && (q.includes('flag') || q.includes('refer') || q.includes('review') || q.includes('score'))) {
    if (context?.verdict) {
      if (context.verdict === 'Normal') {
        return `Your current scan received a 'Normal' verdict with an anomaly score of ${context.score?.toFixed(3) ?? 'N/A'}. Its patch features closely match the healthy reference bank. ${CLINICAL_DISCLAIMER}`;
      }
      if (context.verdict === 'Review') {
        const area = context.areaPercent !== undefined ? `${Math.round(context.areaPercent)}%` : 'a portion';
        const reg = context.region && context.region !== 'None' ? ` in the ${context.region}` : '';
        return `Your scan was marked 'Review' because its anomaly score (${context.score?.toFixed(3)}) exceeded the ${REVIEW_PERCENTILE}th percentile healthy threshold (${context.reviewThreshold?.toFixed(3) ?? '0.35'}). About ${area} of the scan${reg} deviates from normal reference patterns. ${CLINICAL_DISCLAIMER}`;
      }
      if (context.verdict === 'Refer') {
        const area = context.areaPercent !== undefined ? `${Math.round(context.areaPercent)}%` : 'a significant portion';
        const reg = context.region && context.region !== 'None' ? ` in the ${context.region}` : '';
        return `Your scan was marked 'Refer' because its anomaly score (${context.score?.toFixed(3)}) exceeded the ${REFER_PERCENTILE}th percentile healthy threshold (${context.referThreshold?.toFixed(3) ?? '0.50'}). Approximately ${area} of the image${reg} shows notable deviation from normal scans. ${CLINICAL_DISCLAIMER}`;
      }
      if (context.verdict === 'Rejected') {
        return `Your scan was rejected by the safety gate before anomaly scoring: ${context.gateReasons?.join(' ') || 'Image failed quality criteria'}. Please upload a clear grayscale scan.`;
      }
    }
    return `Scans are flagged when patch feature distances to the nearest healthy reference vectors exceed calibrated cutoffs. Scores between the ${REVIEW_PERCENTILE}th and ${REFER_PERCENTILE}th percentile trigger 'Review', while scores at or above the ${REFER_PERCENTILE}th percentile trigger 'Refer'. ${CLINICAL_DISCLAIMER}`;
  }

  // Borderline explanation
  if (q.includes('borderline')) {
    const isBorderline = context?.borderline;
    const borderText = isBorderline ? 'The current scan is flagged Borderline.' : 'The current scan is not borderline.';
    return `${borderText} A 'Borderline' flag indicates the anomaly score falls within a ${Math.round(BORDERLINE_MARGIN * 100)}% margin of either the Review (${REVIEW_PERCENTILE}th percentile) or Refer (${REFER_PERCENTILE}th percentile) thresholds. Because healthy biological variance fluctuates near thresholds, borderline cases especially warrant clinician review. ${CLINICAL_DISCLAIMER}`;
  }

  // How to get better scan / image quality / safety gate
  if (q.includes('better scan') || q.includes('quality') || q.includes('blur') || q.includes('gate') || q.includes('rejected')) {
    return 'For optimal screening results: 1) Ensure the image is in grayscale (colour photos are rejected). 2) Keep the image sharp and in focus (blurry scans below the calibrated Laplacian variance are stopped). 3) Ensure adequate contrast (blank or over-exposed images are rejected). 4) Only scan the exact anatomical region used for your reference bank (e.g. chest X-rays).';
  }

  // Reference bank size advice
  if (q.includes('how many') || q.includes('bank size') || q.includes('reference set') || q.includes('healthy scan')) {
    const count = context?.healthyScanCount ?? 0;
    const currentStatus = count > 0 ? `Your active bank contains ${count} healthy scans.` : 'No reference bank is currently loaded.';
    return `${currentStatus} ScanKavach requires a minimum of ${MIN_NORMALS} healthy scans to build a bank, but we strongly recommend at least ${RECOMMENDED_NORMALS} scans across varied patient demographics and machine settings. Larger, cleaner sets yield tighter, more reliable thresholds.`;
  }

  // Thresholds explanation
  if (q.includes('threshold') || q.includes('percentile') || q.includes('calibration')) {
    const rev = context?.reviewThreshold?.toFixed(3) ?? '95th percentile';
    const ref = context?.referThreshold?.toFixed(3) ?? '99th percentile';
    return `Screening thresholds are calibrated empirically on a held-out validation set of healthy scans (never trained on). The Review threshold (${rev}) corresponds to the ${REVIEW_PERCENTILE}th percentile, meaning ~5% of healthy scans fall here by design. The Refer cutoff (${ref}) marks the ${REFER_PERCENTILE}th percentile for pronounced anomalies.`;
  }

  // Heatmap explanation
  if (q.includes('heatmap') || q.includes('overlay') || q.includes('color') || q.includes('colour')) {
    return 'The heatmap highlights spatial regions with high anomaly distance. Cool/transparent zones match healthy reference patterns, while warm yellow-to-red zones indicate patch embeddings furthest from any known normal pattern in your bank. It guides your eye to where the model detected variation.';
  }

  // Nearest healthy example explanation
  if (q.includes('nearest') || q.includes('healthy example') || q.includes('side by side')) {
    return 'The nearest healthy example shows the scan in your reference bank whose global embedding is closest in cosine distance to the uploaded scan. This side-by-side comparison helps clinicians quickly inspect anatomical alignment and baseline variations.';
  }

  // Default general overview
  return `ScanKavach uses a label-free PatchCore-style memory bank to screen medical scans against known healthy examples without disease labels. Scores reflect patch distance to healthy tissue embeddings. How can I help you interpret your screening results or bank calibration today? ${CLINICAL_DISCLAIMER}`;
}

/**
 * Formats a privacy-preserving text-only summary of the current result.
 * CRITICAL: NEVER includes images, file names, or personal identifiable info.
 */
export function formatResultContextText(context?: AssistantContext): string {
  if (!context) return 'No active scan result context.';

  const parts: string[] = [];
  if (context.verdict) parts.push(`Verdict: ${context.verdict}`);
  if (context.score !== undefined) parts.push(`Anomaly Score: ${context.score.toFixed(4)}`);
  if (context.percentile !== undefined) parts.push(`Percentile: ${context.percentile}%`);
  if (context.borderline !== undefined) parts.push(`Borderline: ${context.borderline ? 'Yes' : 'No'}`);
  if (context.areaPercent !== undefined) parts.push(`Anomalous Area: ${context.areaPercent.toFixed(1)}%`);
  if (context.region) parts.push(`Peak Region: ${context.region}`);
  if (context.sentence) parts.push(`Summary: ${context.sentence}`);
  if (context.reviewThreshold !== undefined) parts.push(`Review Cutoff: ${context.reviewThreshold.toFixed(4)}`);
  if (context.referThreshold !== undefined) parts.push(`Refer Cutoff: ${context.referThreshold.toFixed(4)}`);
  if (context.gatePassed !== undefined) parts.push(`Gate Passed: ${context.gatePassed ? 'Yes' : 'No'}`);
  if (context.gateReasons && context.gateReasons.length > 0) {
    parts.push(`Gate Reasons: ${context.gateReasons.join('; ')}`);
  }

  return parts.join('\n');
}

/**
 * Asynchronously generates an assistant response.
 * Uses Gemini if VITE_GEMINI_API_KEY is available, with a 10s timeout and automatic fallback to Local mode.
 */
export async function askAssistant(
  userQuery: string,
  history: ChatMessage[],
  context?: AssistantContext
): Promise<{ text: string; offlineFallback: boolean }> {
  // Check safety refusal immediately
  if (checkSafetyViolation(userQuery)) {
    return {
      text: SAFE_REFUSAL_MESSAGE,
      offlineFallback: false,
    };
  }

  // Read API key only from environment if configured
  const apiKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('YOUR_GEMINI_API_KEY')) {
    // Pure offline mode
    const text = generateLocalResponse(userQuery, context);
    return { text, offlineFallback: true };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Format privacy-preserving context
    const contextText = formatResultContextText(context);

    // Keep last 10 messages
    const recentHistory = history.slice(-10);
    const conversationPrompt = recentHistory
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = `System Instruction: ${SYSTEM_INSTRUCTION}

Current Result Summary (Text Only):
${contextText}

Conversation History:
${conversationPrompt}

User Question:
${userQuery}

Assistant Response (under 120 words, no diagnosis or treatment, always helpful):`;

    // Timeout promise after 10 seconds
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API request timed out (10s)')), 10000)
    );

    const callPromise = ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const response = await Promise.race([callPromise, timeoutPromise]);
    let responseText = response.text?.trim() || '';

    // Verify response does not violate medical diagnosis refusal
    if (checkSafetyViolation(responseText)) {
      responseText = SAFE_REFUSAL_MESSAGE;
    }

    if (!responseText) {
      const fallbackText = generateLocalResponse(userQuery, context);
      return { text: fallbackText, offlineFallback: true };
    }

    return { text: responseText, offlineFallback: false };
  } catch (err) {
    console.warn('Gemini request failed or timed out, falling back to local assistant:', err);
    const fallbackText = generateLocalResponse(userQuery, context);
    return { text: fallbackText, offlineFallback: true };
  }
}
