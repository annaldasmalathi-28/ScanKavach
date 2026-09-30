/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Network,
  Sparkles,
  Info,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import {
  addSampleToCondition,
  ConditionClass,
  getConditionModel,
  predictConditionWithFusion,
  resetConditionModel,
} from '../lib/classifier.ts';
import { extractFeatures } from '../lib/extractor.ts';
import { createSyntheticScanCanvas } from '../lib/imageUtils.ts';
import { getActiveBank } from '../lib/memoryBank.ts';
import {
  CONDITION_SUGGESTION_DISCLAIMER,
  CONDITION_SUGGESTION_LABEL,
} from '../config.ts';

export const ClassifierPage: React.FC = () => {
  const [model, setModel] = useState(getConditionModel());
  const [selectedClassId, setSelectedClassId] = useState<string>(model.classes[0]?.id || '');
  const [isTraining, setIsTraining] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live Test Demo Simulator
  const [simScore, setSimScore] = useState<number>(0.42);
  const [testPrediction, setTestPrediction] = useState<ReturnType<typeof predictConditionWithFusion> | null>(null);

  const bank = getActiveBank();
  const reviewThresh = bank?.calibration.reviewThreshold ?? 0.365;
  const referThresh = bank?.calibration.referThreshold ?? 0.495;

  const handleAddSyntheticSamples = async (conditionId: string, count: number = 5) => {
    try {
      setIsTraining(true);
      setSuccessMsg(null);

      for (let i = 0; i < count; i++) {
        // Synthesize varied pattern
        const hasAnomaly = conditionId !== 'normal_pattern';
        const canvas = createSyntheticScanCanvas(224, 224, {
          anomaly: hasAnomaly
            ? {
                x: 60 + (i % 3) * 30,
                y: 110 + (i % 2) * 20,
                radius: 20 + i * 2,
                intensity: 100 + i * 10,
              }
            : undefined,
          noiseLevel: 0.03 + (i % 4) * 0.01,
        });

        const feat = await extractFeatures(canvas);
        const updated = addSampleToCondition(conditionId, feat.globalEmbedding);
        setModel({ ...updated });
      }

      const target = model.classes.find((c) => c.id === conditionId);
      setSuccessMsg(`Added ${count} training examples to "${target?.name}". Prototype centroid updated.`);
    } catch (err) {
      console.error('Training sample error:', err);
    } finally {
      setIsTraining(false);
    }
  };

  const handleSimulateTest = async () => {
    try {
      setIsTraining(true);
      // Generate synthetic query test scan
      const canvas = createSyntheticScanCanvas(224, 224, {
        anomaly: simScore >= reviewThresh ? { x: 75, y: 130, radius: 24, intensity: 110 } : undefined,
      });
      const feat = await extractFeatures(canvas);

      const prediction = predictConditionWithFusion(
        feat.globalEmbedding,
        simScore,
        reviewThresh,
        referThresh,
        true // gate passed
      );
      setTestPrediction(prediction);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsTraining(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset condition classifier prototypes to factory baseline?')) {
      const reset = resetConditionModel();
      setModel(reset);
      setSuccessMsg('Reset condition prototypes to default baseline.');
    }
  };

  return (
    <AppShell title="Condition-Suggestion Classifier" bank={bank}>
      <div className="space-y-6">
        {/* Header & Disclaimer */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
                Condition-Suggestion Classifier &amp; Fusion
              </h2>
              <span className="rounded bg-teal-500/20 px-2 py-0.5 text-[10px] font-mono text-teal-300">
                Decision Support
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Supervised pattern-matching prototype paired with unsupervised anomaly score fusion.
            </p>
          </div>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors self-start sm:self-center"
          >
            <RotateCcw size={13} />
            <span>Reset Prototypes</span>
          </button>
        </div>

        {/* Mandatory Research Prototype Disclaimer Banner */}
        <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-4 text-xs text-teal-200">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-slate-100 font-semibold">
                {CONDITION_SUGGESTION_LABEL}
              </strong>
              <p className="leading-relaxed text-slate-300">
                {CONDITION_SUGGESTION_DISCLAIMER}
              </p>
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Condition Prototypes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {model.classes.map((c) => {
            const isSelected = c.id === selectedClassId;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedClassId(c.id)}
                className={`rounded-xl border p-5 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-teal-500 bg-slate-900/90 shadow-md ring-1 ring-teal-500/50'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100">{c.name}</h3>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
                    {c.sampleCount} samples
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-400 leading-relaxed min-h-[36px]">
                  {c.description}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-slate-500">128-dim centroid</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddSyntheticSamples(c.id, 5);
                    }}
                    disabled={isTraining}
                    className="inline-flex items-center gap-1 rounded bg-teal-600/30 hover:bg-teal-600/50 px-2 py-1 text-[11px] font-medium text-teal-200 transition-colors"
                  >
                    <PlusCircle size={11} />
                    <span>Train +5</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive Fusion Logic Simulator */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders size={18} className="text-teal-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Pattern Similarity &amp; Anomaly Score Fusion Simulator
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                ScanKavach fusions the supervised condition resemblance with the unsupervised patch-level anomaly score. Test how adjusting anomaly score dampens or confirms condition confidence:
              </p>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Simulated Anomaly Score:</span>
                  <span className="font-mono font-bold text-teal-400">{simScore.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.80"
                  step="0.01"
                  value={simScore}
                  onChange={(e) => setSimScore(parseFloat(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>Normal (&lt;{reviewThresh.toFixed(2)})</span>
                  <span>Review ({reviewThresh.toFixed(2)} - {referThresh.toFixed(2)})</span>
                  <span>Refer (&ge;{referThresh.toFixed(2)})</span>
                </div>
              </div>

              <button
                onClick={handleSimulateTest}
                disabled={isTraining}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors"
              >
                <RefreshCw size={14} className={isTraining ? 'animate-spin' : ''} />
                <span>Simulate Inference with Fusion Logic</span>
              </button>
            </div>

            {/* Prediction Output Card */}
            <div className="rounded-xl bg-slate-950/80 p-5 border border-slate-800 text-xs space-y-3">
              <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
                Decision Support Output
              </div>

              {testPrediction ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-teal-950/30 p-3 border border-teal-500/30">
                    <span className="text-[10px] uppercase font-mono font-semibold text-teal-400 block mb-1">
                      {testPrediction.label}
                    </span>
                    <p className="text-sm font-semibold text-slate-100">
                      {testPrediction.displayText}
                    </p>
                    {testPrediction.fusedVerdictNote && (
                      <p className="mt-1 text-xs text-slate-400 italic">
                        {testPrediction.fusedVerdictNote}
                      </p>
                    )}
                  </div>

                  {/* Probabilities breakdown */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-slate-400 font-medium">Relative Pattern Proximity:</span>
                    {testPrediction.probabilities.map((prob, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300">{prob.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-teal-500"
                              style={{ width: `${Math.round(prob.probability * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-slate-400 w-8 text-right">
                            {Math.round(prob.probability * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-500 italic pt-1">
                    {testPrediction.disclaimer}
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Click &ldquo;Simulate Inference with Fusion Logic&rdquo; to test pattern prediction.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
