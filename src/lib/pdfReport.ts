/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScanKavach Clinical Screening PDF Report Generator
 * Generates audit-ready, single-page clinical decision support reports using jsPDF.
 *
 * MANDATORY SAFETY & COMPLIANCE:
 * - Every report prominently includes: "This flags an unusual pattern for clinician review. It is not a diagnosis."
 * - Condition suggestions are strictly labelled as: "AI-suggested finding (decision support)".
 * - Never includes disease claims or prescription advice.
 */

import { jsPDF } from 'jspdf';
import {
  APP_NAME,
  APP_FULL_TITLE,
  CLINICAL_DISCLAIMER,
  CONDITION_SUGGESTION_DISCLAIMER,
  CONDITION_SUGGESTION_LABEL,
} from '../config.ts';
import { ConditionPrediction } from './classifier.ts';

export interface PdfReportData {
  fileName: string;
  scanId: string;
  timestamp: string;
  operatorName: string;
  operatorRole: string;
  verdict: 'Normal' | 'Review' | 'Refer' | 'Rejected';
  borderline: boolean;
  score: number;
  percentile: number;
  areaPercent: number;
  peakRegion: string;
  summarySentence: string;
  gatePassed: boolean;
  gateReasons?: string[];
  latencyMs: number;
  conditionSuggestion?: ConditionPrediction | null;
  scanCanvas?: HTMLCanvasElement | null;
}

export function generateClinicalPdfReport(data: PdfReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  // 1. Header Banner (Teal Accent)
  doc.setFillColor(13, 148, 136); // #0d9488 (Teal 600)
  doc.rect(margin, y, contentWidth, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(APP_NAME, margin + 4, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('CLINICAL SCREENING & DECISION SUPPORT REPORT', margin + contentWidth - 4, y + 9, {
    align: 'right',
  });

  y += 20;

  // 2. Subheader & Metadata Box
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // Slate 700

  // Left column
  doc.text(`File Name: ${data.fileName}`, margin + 4, y + 6);
  doc.text(`Report ID: ${data.scanId}`, margin + 4, y + 12);
  doc.text(`Acquisition Date: ${new Date(data.timestamp).toLocaleString()}`, margin + 4, y + 18);

  // Right column
  doc.text(`Evaluating Clinician: ${data.operatorName}`, margin + 100, y + 6);
  doc.text(`Clinical Role: ${data.operatorRole}`, margin + 100, y + 12);
  doc.text(`Local Inference Latency: ${data.latencyMs} ms`, margin + 100, y + 18);

  y += 28;

  // 3. Safety Gate Verification Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('1. Input Safety Gate Status', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  if (data.gatePassed) {
    doc.setTextColor(16, 149, 107); // Emerald
    doc.text(
      'PASSED: Quality checks satisfied (grayscale verification, contrast check, blur check, and in-distribution geometry).',
      margin,
      y
    );
  } else {
    doc.setTextColor(225, 29, 72); // Rose
    doc.text(
      `STOPPED BY SAFETY GATE: ${data.gateReasons?.join('; ') || 'Image failed pre-screening criteria.'}`,
      margin,
      y
    );
  }

  y += 9;

  // 4. Primary Screening Findings
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Unsupervised Anomaly Screening Verdict', margin, y);
  y += 5;

  if (data.gatePassed) {
    // Verdict Card
    let verdictColor = [13, 148, 136]; // Teal for Normal
    if (data.verdict === 'Review') verdictColor = [245, 158, 11]; // Amber
    if (data.verdict === 'Refer') verdictColor = [225, 29, 72]; // Rose

    doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
    doc.roundedRect(margin, y, 35, 10, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(data.verdict.toUpperCase(), margin + 17.5, y + 7, { align: 'center' });

    if (data.borderline) {
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(margin + 38, y, 60, 10, 1.5, 1.5, 'FD');
      doc.setTextColor(180, 83, 9);
      doc.setFontSize(8.5);
      doc.text('Borderline: Needs Human Review', margin + 68, y + 6.5, { align: 'center' });
    }

    y += 14;

    // Metrics Table
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    const rowH = 6;
    doc.text(`Anomaly Score (Mean Top-3):`, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.score.toFixed(4)}`, margin + 65, y);

    doc.setFont('helvetica', 'normal');
    doc.text(`Validation Percentile:`, margin, y + rowH);
    doc.setFont('helvetica', 'bold');
    doc.text(`More unusual than ${data.percentile}% of healthy validation scans`, margin + 65, y + rowH);

    doc.setFont('helvetica', 'normal');
    doc.text(`Anomalous Area Coverage:`, margin, y + rowH * 2);
    doc.setFont('helvetica', 'bold');
    doc.text(`${Math.round(data.areaPercent)}% of image area`, margin + 65, y + rowH * 2);

    doc.setFont('helvetica', 'normal');
    doc.text(`Peak Spatial Region (3x3 Grid):`, margin, y + rowH * 3);
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.peakRegion} of the image`, margin + 65, y + rowH * 3);

    y += rowH * 4 + 2;

    // Summary Sentence Box
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Summary: ${data.summarySentence}`, margin + 3, y + 7.5);

    y += 18;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No anomaly score or verdict computed due to safety gate halt.', margin, y);
    y += 12;
  }

  // 5. Condition-Suggestion Decision Support Section
  if (data.gatePassed && data.conditionSuggestion) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Supervised Pattern Suggestion (Decision Support)', margin, y);
    y += 5;

    doc.setFillColor(240, 253, 250); // Teal 50
    doc.setDrawColor(45, 212, 191); // Teal 400
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 118, 110); // Teal 700
    doc.text(CONDITION_SUGGESTION_LABEL, margin + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(data.conditionSuggestion.displayText, margin + 4, y + 12);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(CONDITION_SUGGESTION_DISCLAIMER, margin + 4, y + 17);

    y += 26;
  }

  // 6. Mandatory Clinical Disclaimer Banner
  doc.setFillColor(254, 242, 242); // Rose 50
  doc.setDrawColor(254, 205, 211); // Rose 200
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(190, 18, 60); // Rose 700
  doc.text('MANDATORY SCREENING NOTICE:', margin + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(CLINICAL_DISCLAIMER, margin + 4, y + 10.5);

  y += 20;

  // 7. Clinician Review & Sign-Off Section
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Reviewing Clinician Signature / Notes:', margin, y);
  doc.line(margin + 55, y, margin + contentWidth, y);

  y += 10;
  doc.text('Action Plan: [  ] Refer for diagnostic CT   [  ] Correlate with clinical history   [  ] Routine re-screen', margin, y);

  // 8. Footer
  const footerY = 285;
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${APP_FULL_TITLE} | Privacy Preserved: Local Client-Side Execution | Generated: ${new Date().toISOString()}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  // Trigger download
  doc.save(`scankavach-report-${data.scanId.slice(0, 12)}.pdf`);
}
