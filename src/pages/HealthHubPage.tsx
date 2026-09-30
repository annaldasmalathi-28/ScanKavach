/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  HeartPulse,
  Globe2,
  Cpu,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  Stethoscope,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { getActiveBank } from '../lib/memoryBank.ts';
import { CLINICAL_DISCLAIMER } from '../config.ts';

export const HealthHubPage: React.FC = () => {
  const bank = getActiveBank();

  return (
    <AppShell title="Clinical Health Hub & Educational Resources" bank={bank}>
      <div className="mx-auto max-w-4xl space-y-8 pb-12">
        {/* Header */}
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
              ScanKavach Health Hub
            </h2>
            <span className="rounded bg-teal-500/20 px-2 py-0.5 text-[10px] font-mono text-teal-300">
              Clinical Guidelines
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Clinical protocols, triage pathways, patient communication frameworks, and global health impact.
          </p>
        </div>

        {/* 1. Triage Pathway Guidance: When to Refer */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-2 text-teal-400">
            <Stethoscope size={20} />
            <h3 className="font-semibold text-slate-100">
              Clinical Triage Pathway: Action Matrix
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/30 p-4 space-y-2">
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                NORMAL VERDICT
              </span>
              <h4 className="font-semibold text-slate-200">Below 95th Percentile</h4>
              <p className="text-slate-400 leading-relaxed">
                Scan features closely align with the healthy reference set. If patient is asymptomatic, proceed with routine care. If clinical symptoms persist, repeat or escalate based on clinical judgment.
              </p>
            </div>

            <div className="rounded-lg bg-amber-950/20 border border-amber-500/30 p-4 space-y-2">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase">
                REVIEW VERDICT
              </span>
              <h4 className="font-semibold text-slate-200">95th to 99th Percentile</h4>
              <p className="text-slate-400 leading-relaxed">
                Atypical visual pattern detected or borderline threshold proximity. Secondary clinical review by a radiologist or senior clinician is indicated. Correlate with auscultation and pulse oximetry.
              </p>
            </div>

            <div className="rounded-lg bg-rose-950/20 border border-rose-500/30 p-4 space-y-2">
              <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 uppercase">
                REFER VERDICT
              </span>
              <h4 className="font-semibold text-slate-200">&ge; 99th Percentile</h4>
              <p className="text-slate-400 leading-relaxed">
                Marked outlier pattern exceeding 99% of healthy reference scans. Expedite diagnostic imaging (e.g. chest CT, sputum microbiology, or specialist referral) according to facility protocol.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Communicating with Patients */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-2 text-teal-400">
            <HelpCircle size={20} />
            <h3 className="font-semibold text-slate-100">
              Patient Communication Protocol: Reassurance &amp; Clarity
            </h3>
          </div>

          <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 text-xs text-slate-300 space-y-3">
            <div>
              <strong className="text-teal-300">How to explain ScanKavach to patients:</strong>
              <blockquote className="mt-1 pl-3 border-l-2 border-teal-500 text-slate-400 italic">
                &ldquo;We use an automated screening shield called ScanKavach that checks if your X-ray matches typical healthy scans. It does not diagnose diseases; it simply helps doctors double-check whether any part of the image deserves a closer look.&rdquo;
              </blockquote>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px]">
              <div className="rounded bg-slate-900 p-2.5 border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1">DO SAY:</span>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  <li>&ldquo;The screening aid flagged an unusual pattern for our review.&rdquo;</li>
                  <li>&ldquo;This is a safety check to ensure nothing is missed.&rdquo;</li>
                  <li>&ldquo;Your doctor makes all final medical decisions.&rdquo;</li>
                </ul>
              </div>

              <div className="rounded bg-slate-900 p-2.5 border border-slate-800">
                <span className="font-bold text-rose-400 block mb-1">DO NOT SAY:</span>
                <ul className="space-y-1 text-slate-300 list-disc list-inside">
                  <li>&ldquo;The AI diagnosed you with pneumonia / cancer.&rdquo;</li>
                  <li>&ldquo;The algorithm confirmed you are sick / cured.&rdquo;</li>
                  <li>&ldquo;The computer determined your medication.&rdquo;</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Radiological Positioning & Technical Quality Tips */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-2 text-teal-400">
            <FileCheck size={20} />
            <h3 className="font-semibold text-slate-100">
              Radiological Acquisition &amp; Quality Optimization
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-1.5">
              <strong className="text-teal-400 font-semibold">1. Standard PA vs AP Projection</strong>
              <p className="text-slate-400 leading-relaxed">
                Posterior-Anterior (PA) upright radiographs reduce cardiac magnification. If AP portable scans are evaluated against a PA reference bank, mild cardiac baseline shifts can occur.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-1.5">
              <strong className="text-teal-400 font-semibold">2. Inspiratory Effort &amp; Rib Count</strong>
              <p className="text-slate-400 leading-relaxed">
                Adequate inspiration reveals 9-10 posterior ribs above the diaphragm. Poor inspiratory effort increases basilar lung density and can trigger secondary Review verdicts.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-1.5">
              <strong className="text-teal-400 font-semibold">3. Scapular Protraction</strong>
              <p className="text-slate-400 leading-relaxed">
                Ensure arms are positioned forward so scapulae are rolled lateral to the lung fields, avoiding dense osseous overlap over upper peripheral lobes.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800 space-y-1.5">
              <strong className="text-teal-400 font-semibold">4. Grayscale Dynamic Range</strong>
              <p className="text-slate-400 leading-relaxed">
                Avoid camera screenshots of computer monitors. Use direct DICOM or lossless PNG/JPEG exports to ensure proper contrast resolution.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Global Health Alignment (SDGs) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-2 text-teal-400">
            <Globe2 size={20} />
            <h3 className="font-semibold text-slate-100">
              Sustainable Development Goals (SDG) Alignment
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800 space-y-1">
              <span className="font-bold text-teal-300 flex items-center gap-1.5">
                <HeartPulse size={14} />
                <span>SDG 3: Good Health</span>
              </span>
              <p className="text-slate-400">
                Helps frontline healthcare workers prioritize urgent pulmonary anomalies in primary care centers.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800 space-y-1">
              <span className="font-bold text-teal-300 flex items-center gap-1.5">
                <Cpu size={14} />
                <span>SDG 9: Resilient Tech</span>
              </span>
              <p className="text-slate-400">
                Browser-local execution works in offline and rural clinics without expensive server infrastructure.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800 space-y-1">
              <span className="font-bold text-teal-300 flex items-center gap-1.5">
                <Globe2 size={14} />
                <span>SDG 10: Equality</span>
              </span>
              <p className="text-slate-400">
                Democratizes medical imaging decision support across underserved communities with zero per-scan fees.
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer banner */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center text-xs text-slate-400">
          <p>{CLINICAL_DISCLAIMER}</p>
        </div>
      </div>
    </AppShell>
  );
};
